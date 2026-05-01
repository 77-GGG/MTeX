import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'mtex.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
}

function runMigrations(): void {
  // Simple version-based migration
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const currentVersion = db.prepare(
    'SELECT MAX(version) as v FROM _migrations'
  ).get() as { v: number | null };

  const version = currentVersion?.v || 0;

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE IF NOT EXISTS notes (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path       TEXT NOT NULL UNIQUE,
          format          TEXT NOT NULL CHECK(format IN ('md', 'tex')),
          title           TEXT,
          plain_content   TEXT,
          content_hash    TEXT,
          file_size       INTEGER,
          word_count      INTEGER,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          modified_at     TEXT NOT NULL DEFAULT (datetime('now')),
          frontmatter     TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_notes_format ON notes(format);
        CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified_at);
        CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);

        CREATE TABLE IF NOT EXISTS tags (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
          color       TEXT,
          parent_id   INTEGER REFERENCES tags(id),
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS note_tags (
          note_id   INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (note_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
          title,
          content,
          format,
          file_path UNINDEXED,
          content='notes',
          content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.plain_content, new.format, new.file_path);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content, format, file_path)
          VALUES ('delete', old.id, old.title, old.plain_content, old.format, old.file_path);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content, format, file_path)
          VALUES ('delete', old.id, old.title, old.plain_content, old.format, old.file_path);
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.plain_content, new.format, new.file_path);
        END;

        CREATE TABLE IF NOT EXISTS note_links (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          source_note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          target_note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          context         TEXT,
          UNIQUE(source_note_id, target_note_id)
        );

        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);

        CREATE TABLE IF NOT EXISTS search_history (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          query         TEXT NOT NULL,
          result_count  INTEGER,
          searched_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(searched_at DESC);

        CREATE TABLE IF NOT EXISTS bookmarks (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          note_id     INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(note_id)
        );

        CREATE TABLE IF NOT EXISTS workspace_config (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `,
    },
    {
      version: 2,
      sql: `
        ALTER TABLE notes RENAME COLUMN plain_content TO content;

        DROP TRIGGER IF EXISTS notes_ai;
        DROP TRIGGER IF EXISTS notes_ad;
        DROP TRIGGER IF EXISTS notes_au;
        DROP TABLE IF EXISTS notes_fts;

        CREATE VIRTUAL TABLE notes_fts USING fts5(
          title,
          content,
          format,
          file_path UNINDEXED
        );

        CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.content, new.format, new.file_path);
        END;

        CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content, format, file_path)
          VALUES ('delete', old.id, old.title, old.content, old.format, old.file_path);
        END;

        CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
          INSERT INTO notes_fts(notes_fts, rowid, title, content, format, file_path)
          VALUES ('delete', old.id, old.title, old.content, old.format, old.file_path);
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.content, new.format, new.file_path);
        END;

        INSERT INTO notes_fts(rowid, title, content, format, file_path)
        SELECT id, title, content, format, file_path FROM notes;
      `,
    },
    {
      version: 3,
      sql: `
        DROP TRIGGER IF EXISTS notes_ai;
        DROP TRIGGER IF EXISTS notes_ad;
        DROP TRIGGER IF EXISTS notes_au;

        CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.content, new.format, new.file_path);
        END;

        CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
          DELETE FROM notes_fts WHERE rowid = old.id;
        END;

        CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
          DELETE FROM notes_fts WHERE rowid = old.id;
          INSERT INTO notes_fts(rowid, title, content, format, file_path)
          VALUES (new.id, new.title, new.content, new.format, new.file_path);
        END;
      `,
    },
  ];

  for (const migration of migrations) {
    if (migration.version > version) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(migration.version);
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
