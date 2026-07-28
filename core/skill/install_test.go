package skill

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

const sampleSkillMD = `---
name: pdf-tools
description: Extract PDF text and fill forms.
license: Apache-2.0
---

# PDF Tools

Run scripts/extract.py to extract text.
`

func TestParseGitHubURL(t *testing.T) {
	tests := []struct {
		url     string
		want    *githubRef
		wantErr bool
	}{
		{
			url:  "https://github.com/owner/repo",
			want: &githubRef{owner: "owner", repo: "repo"},
		},
		{
			url:  "https://github.com/owner/repo/tree/main/skills/pdf",
			want: &githubRef{owner: "owner", repo: "repo", ref: "main", subPath: "skills/pdf"},
		},
		{
			url:  "https://github.com/owner/repo/blob/main/skills/pdf/SKILL.md",
			want: &githubRef{owner: "owner", repo: "repo", ref: "main", subPath: "skills/pdf/SKILL.md", isFile: true},
		},
		{url: "https://github.com/owner", wantErr: true},
		{url: "https://github.com/owner/repo/releases/v1", wantErr: true},
		{url: "https://github.com/owner/repo/blob/main/README.md", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got, err := parseGitHubURL(tt.url)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %+v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if *got != *tt.want {
				t.Errorf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestInstallFromFileURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(sampleSkillMD))
	}))
	defer srv.Close()

	dest := t.TempDir()
	installed, err := Install(context.Background(), srv.URL+"/SKILL.md", dest, false)
	if err != nil {
		t.Fatalf("Install: %v", err)
	}
	if len(installed) != 1 || installed[0] != "pdf-tools" {
		t.Fatalf("installed = %v", installed)
	}
	if _, err := os.Stat(filepath.Join(dest, "pdf-tools", "SKILL.md")); err != nil {
		t.Errorf("SKILL.md not written: %v", err)
	}

	// Duplicate install without overwrite fails; with overwrite succeeds.
	if _, err := Install(context.Background(), srv.URL+"/SKILL.md", dest, false); err == nil {
		t.Errorf("duplicate install should fail without overwrite")
	}
	if _, err := Install(context.Background(), srv.URL+"/SKILL.md", dest, true); err != nil {
		t.Errorf("overwrite install should succeed: %v", err)
	}
}

func TestInstallUnsupportedSource(t *testing.T) {
	if _, err := Install(context.Background(), "https://example.com/skill.zip", t.TempDir(), false); err == nil {
		t.Fatal("expected error for unsupported source")
	}
}

func TestInstallFromGitHubTarball(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		files := map[string]string{
			"repo-main/skills/pdf-tools/SKILL.md":           sampleSkillMD,
			"repo-main/skills/pdf-tools/scripts/extract.py": "print('hi')\n",
			"repo-main/README.md":                           "# repo\n",
		}
		w.Write(makeTarGz(t, files))
	}))
	defer srv.Close()

	oldCodeload, oldRaw := codeloadBase, rawBase
	codeloadBase, rawBase = srv.URL, srv.URL
	defer func() { codeloadBase, rawBase = oldCodeload, oldRaw }()

	dest := t.TempDir()
	installed, err := installFromGitHub(context.Background(), &githubRef{owner: "o", repo: "r", ref: "main"}, dest, false)
	if err != nil {
		t.Fatalf("installFromGitHub: %v", err)
	}
	if len(installed) != 1 || installed[0] != "pdf-tools" {
		t.Fatalf("installed = %v", installed)
	}
	if _, err := os.Stat(filepath.Join(dest, "pdf-tools", "scripts", "extract.py")); err != nil {
		t.Errorf("bundled script should be copied: %v", err)
	}
}

func TestExtractTarGzZipSlip(t *testing.T) {
	data := makeTarGz(t, map[string]string{"../evil.txt": "pwned"})
	if err := extractTarGz(data, t.TempDir()); err == nil {
		t.Fatal("expected zip-slip rejection")
	}
}

func TestFindSkillDirs(t *testing.T) {
	t.Run("root SKILL.md", func(t *testing.T) {
		root := t.TempDir()
		writeTestSkill(t, root, "solo", "at root")
		dirs, err := findSkillDirs(filepath.Join(root, "solo"))
		if err != nil || len(dirs) != 1 {
			t.Fatalf("dirs = %v, err = %v", dirs, err)
		}
	})

	t.Run("skills subdirectory multi", func(t *testing.T) {
		root := t.TempDir()
		writeTestSkill(t, filepath.Join(root, "skills"), "one", "first")
		writeTestSkill(t, filepath.Join(root, "skills"), "two", "second")
		dirs, err := findSkillDirs(root)
		if err != nil || len(dirs) != 2 {
			t.Fatalf("dirs = %v, err = %v", dirs, err)
		}
	})

	t.Run("none found", func(t *testing.T) {
		if _, err := findSkillDirs(t.TempDir()); err == nil {
			t.Fatal("expected error when no SKILL.md exists")
		}
	})
}

// makeTarGz builds an in-memory .tar.gz from name→content entries.
func makeTarGz(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for name, content := range files {
		hdr := &tar.Header{Name: name, Mode: 0o644, Size: int64(len(content)), Typeflag: tar.TypeReg}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
