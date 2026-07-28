package skill

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// maxInstallBytes caps download size for skill installation.
	maxInstallBytes = 20 << 20 // 20 MiB
	// installTimeout bounds the whole download + install operation.
	installTimeout = 60 * time.Second
)

// Download base URLs; package vars so tests can point them at httptest servers.
var (
	codeloadBase = "https://codeload.github.com"
	rawBase      = "https://raw.githubusercontent.com"
)

// githubRef is a parsed github.com URL.
type githubRef struct {
	owner   string
	repo    string
	ref     string // branch/tag; empty = HEAD
	subPath string // path inside the repo (tree/blob suffix)
	isFile  bool   // URL points directly at a file (/blob/.../SKILL.md)
}

// Install downloads skills from a GitHub repository URL or a direct SKILL.md
// URL into destRoot, returning the installed skill names.
func Install(ctx context.Context, source, destRoot string, overwrite bool) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, installTimeout)
	defer cancel()

	if strings.Contains(source, "github.com") {
		ref, err := parseGitHubURL(source)
		if err != nil {
			return nil, err
		}
		return installFromGitHub(ctx, ref, destRoot, overwrite)
	}
	if u, err := url.Parse(source); err == nil &&
		(u.Scheme == "http" || u.Scheme == "https") &&
		strings.HasSuffix(u.Path, "/SKILL.md") {
		return installFromFileURL(ctx, source, destRoot, overwrite)
	}
	return nil, fmt.Errorf("unsupported source %q: expected a GitHub repository URL or a direct SKILL.md URL", source)
}

// parseGitHubURL parses https://github.com/owner/repo[/tree|blob/<ref>/<path>].
func parseGitHubURL(source string) (*githubRef, error) {
	u, err := url.Parse(source)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("invalid GitHub URL %q", source)
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid GitHub URL %q: expected /owner/repo", source)
	}
	ref := &githubRef{owner: parts[0], repo: parts[1]}
	if len(parts) > 2 {
		if parts[2] != "tree" && parts[2] != "blob" {
			return nil, fmt.Errorf("unsupported GitHub URL %q: only /tree/ and /blob/ paths are supported", source)
		}
		if len(parts) < 4 {
			return nil, fmt.Errorf("invalid GitHub URL %q: missing ref after /%s/", source, parts[2])
		}
		ref.ref = parts[3]
		ref.subPath = strings.Join(parts[4:], "/")
		ref.isFile = parts[2] == "blob"
	}
	if ref.isFile && !strings.HasSuffix(ref.subPath, "/SKILL.md") && !strings.EqualFold(ref.subPath, "SKILL.md") {
		return nil, fmt.Errorf("GitHub file URL must point to a SKILL.md: %q", source)
	}
	return ref, nil
}

// installFromGitHub installs skills from a GitHub repo (tarball or single file).
func installFromGitHub(ctx context.Context, ref *githubRef, destRoot string, overwrite bool) ([]string, error) {
	gitRef := ref.ref
	if gitRef == "" {
		gitRef = "HEAD"
	}

	if ref.isFile {
		raw := fmt.Sprintf("%s/%s/%s/%s/%s", rawBase, ref.owner, ref.repo, gitRef, ref.subPath)
		return installFromFileURL(ctx, raw, destRoot, overwrite)
	}

	tarball := fmt.Sprintf("%s/%s/%s/tar.gz/%s", codeloadBase, ref.owner, ref.repo, gitRef)
	data, err := fetchBytes(ctx, tarball)
	if err != nil {
		return nil, fmt.Errorf("download repository: %w", err)
	}

	tmp, err := os.MkdirTemp("", "skill-install-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmp)

	if err := extractTarGz(data, tmp); err != nil {
		return nil, fmt.Errorf("extract repository: %w", err)
	}

	repoRoot, err := singleChildDir(tmp)
	if err != nil {
		return nil, err
	}
	candidates, err := findSkillDirs(filepath.Join(repoRoot, ref.subPath))
	if err != nil {
		return nil, err
	}

	installed := make([]string, 0, len(candidates))
	for _, dir := range candidates {
		name, err := installSkillDir(dir, destRoot, overwrite)
		if err != nil {
			return installed, err
		}
		installed = append(installed, name)
	}
	return installed, nil
}

// installFromFileURL installs a single skill from a direct SKILL.md URL.
func installFromFileURL(ctx context.Context, fileURL, destRoot string, overwrite bool) ([]string, error) {
	data, err := fetchBytes(ctx, fileURL)
	if err != nil {
		return nil, fmt.Errorf("download SKILL.md: %w", err)
	}

	fm, _, err := parseSkillMD(data)
	if err != nil {
		return nil, fmt.Errorf("parse SKILL.md: %w", err)
	}
	if err := fm.Validate(); err != nil {
		return nil, fmt.Errorf("validate skill: %w", err)
	}

	dest := filepath.Join(destRoot, fm.Name)
	if err := guardExisting(dest, overwrite); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return nil, fmt.Errorf("create skill dir: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dest, "SKILL.md"), data, 0o644); err != nil {
		return nil, fmt.Errorf("write SKILL.md: %w", err)
	}
	return []string{fm.Name}, nil
}

// fetchBytes downloads a URL with a size cap.
func fetchBytes(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: HTTP %d", url, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxInstallBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if len(data) > maxInstallBytes {
		return nil, fmt.Errorf("download exceeds %d MiB limit", maxInstallBytes>>20)
	}
	return data, nil
}

// extractTarGz extracts a .tar.gz payload into dest, rejecting path traversal.
func extractTarGz(data []byte, dest string) error {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("gzip reader: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read tar entry: %w", err)
		}
		target := filepath.Join(dest, hdr.Name)
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("tar entry escapes destination: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return fmt.Errorf("create dir: %w", err)
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return fmt.Errorf("create dir: %w", err)
			}
			if err := writeTarFile(tr, target, hdr.FileInfo().Mode()); err != nil {
				return err
			}
		}
	}
}

// writeTarFile writes one regular tar entry to disk.
func writeTarFile(r io.Reader, target string, mode os.FileMode) error {
	f, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	return nil
}

// singleChildDir returns the only subdirectory of dir (tarball root folder).
func singleChildDir(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("read extracted repo: %w", err)
	}
	if len(entries) == 1 && entries[0].IsDir() {
		return filepath.Join(dir, entries[0].Name()), nil
	}
	return dir, nil
}

// findSkillDirs locates skill directories under root: root itself, its
// first-level children, or children of a skills/ subdirectory.
func findSkillDirs(root string) ([]string, error) {
	if hasSkillMD(root) {
		return []string{root}, nil
	}

	var found []string
	scan := func(dir string) error {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if e.IsDir() && hasSkillMD(filepath.Join(dir, e.Name())) {
				found = append(found, filepath.Join(dir, e.Name()))
			}
		}
		return nil
	}
	if err := scan(root); err != nil {
		return nil, fmt.Errorf("scan repository: %w", err)
	}
	if len(found) == 0 {
		if entries, err := os.ReadDir(root); err == nil {
			for _, e := range entries {
				if e.IsDir() && e.Name() == "skills" {
					if err := scan(filepath.Join(root, "skills")); err != nil {
						return nil, fmt.Errorf("scan skills dir: %w", err)
					}
				}
			}
		}
	}
	if len(found) == 0 {
		return nil, fmt.Errorf("no SKILL.md found in repository")
	}
	return found, nil
}

// hasSkillMD reports whether dir directly contains a SKILL.md.
func hasSkillMD(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "SKILL.md"))
	return err == nil
}

// installSkillDir validates and copies a skill directory into destRoot.
func installSkillDir(src, destRoot string, overwrite bool) (string, error) {
	md, err := LoadSkillMD(src)
	if err != nil {
		return "", fmt.Errorf("validate %s: %w", filepath.Base(src), err)
	}
	name := md.Frontmatter.Name
	dest := filepath.Join(destRoot, name)
	if err := guardExisting(dest, overwrite); err != nil {
		return "", err
	}
	if err := os.MkdirAll(destRoot, 0o755); err != nil {
		return "", fmt.Errorf("create skills dir: %w", err)
	}
	if err := copyDir(src, dest); err != nil {
		return "", fmt.Errorf("install skill %s: %w", name, err)
	}
	return name, nil
}

// guardExisting rejects existing installs unless overwrite is set.
func guardExisting(dest string, overwrite bool) error {
	if _, err := os.Stat(dest); err != nil {
		return nil
	}
	if !overwrite {
		return fmt.Errorf("skill already exists at %s (use overwrite to replace)", dest)
	}
	if err := os.RemoveAll(dest); err != nil {
		return fmt.Errorf("remove existing skill: %w", err)
	}
	return nil
}

// copyDir recursively copies a directory tree.
func copyDir(src, dest string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dest, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode())
	})
}
