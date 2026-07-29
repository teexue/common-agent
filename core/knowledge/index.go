package knowledge

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"math"
	"time"

	_ "github.com/glebarez/go-sqlite"
)

type indexDB struct {
	db *sql.DB
}

func openIndex(path string) (*indexDB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open index: %w", err)
	}
	idx := &indexDB{db: db}
	if err := idx.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return idx, nil
}

func (idx *indexDB) Close() error {
	return idx.db.Close()
}

func (idx *indexDB) migrate() error {
	_, err := idx.db.Exec(`
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL,
  FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
`)
	return err
}

func (idx *indexDB) counts() (docs, chunks int, err error) {
	err = idx.db.QueryRow(`SELECT COUNT(*) FROM documents`).Scan(&docs)
	if err != nil {
		return
	}
	err = idx.db.QueryRow(`SELECT COUNT(*) FROM chunks`).Scan(&chunks)
	return
}

func (idx *indexDB) listDocuments() ([]Document, error) {
	rows, err := idx.db.Query(`
SELECT d.id, d.filename, d.size, d.created_at,
       (SELECT COUNT(*) FROM chunks c WHERE c.doc_id = d.id)
FROM documents d ORDER BY d.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Document
	for rows.Next() {
		var d Document
		var created string
		if err := rows.Scan(&d.ID, &d.Filename, &d.Size, &created, &d.ChunkCount); err != nil {
			return nil, err
		}
		d.CreatedAt, _ = time.Parse(time.RFC3339, created)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (idx *indexDB) deleteDocument(docID string) error {
	tx, err := idx.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM chunks WHERE doc_id = ?`, docID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM documents WHERE id = ?`, docID); err != nil {
		return err
	}
	return tx.Commit()
}

func (idx *indexDB) upsertDocument(doc Document, chunks []chunkRow) error {
	tx, err := idx.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM chunks WHERE doc_id = ?`, doc.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM documents WHERE id = ?`, doc.ID); err != nil {
		return err
	}
	created := doc.CreatedAt.UTC().Format(time.RFC3339)
	if _, err := tx.Exec(
		`INSERT INTO documents(id, filename, size, created_at) VALUES(?,?,?,?)`,
		doc.ID, doc.Filename, doc.Size, created,
	); err != nil {
		return err
	}
	stmt, err := tx.Prepare(`INSERT INTO chunks(doc_id, chunk_index, text, embedding) VALUES(?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, c := range chunks {
		if _, err := stmt.Exec(doc.ID, c.Index, c.Text, encodeEmbedding(c.Embedding)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

type chunkRow struct {
	Index     int
	Text      string
	Embedding []float32
	DocID     string
	Filename  string
}

func (idx *indexDB) allChunks() ([]chunkRow, error) {
	rows, err := idx.db.Query(`
SELECT c.doc_id, d.filename, c.chunk_index, c.text, c.embedding
FROM chunks c JOIN documents d ON d.id = c.doc_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []chunkRow
	for rows.Next() {
		var c chunkRow
		var blob []byte
		if err := rows.Scan(&c.DocID, &c.Filename, &c.Index, &c.Text, &blob); err != nil {
			return nil, err
		}
		c.Embedding = decodeEmbedding(blob)
		out = append(out, c)
	}
	return out, rows.Err()
}

func encodeEmbedding(v []float32) []byte {
	buf := make([]byte, 4*len(v))
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

func decodeEmbedding(b []byte) []float32 {
	n := len(b) / 4
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		out[i] = math.Float32frombits(binary.LittleEndian.Uint32(b[i*4:]))
	}
	return out
}

func cosine(a, b []float32) float32 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return float32(dot / (math.Sqrt(na) * math.Sqrt(nb)))
}
