import { getDb } from './database';

export interface SearchParams {
  query?: string;
  tags?: number[];
  format?: 'md' | 'tex';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'modified' | 'created' | 'title';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: number;
  filePath: string;
  format: string;
  title: string;
  modifiedAt: string;
  titleHighlight: string;
  snippet: string;
  tags: string;
  rank: number;
}

export class SearchEngine {
  search(params: SearchParams): SearchResult[] {
    const db = getDb();
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    let useLike = false;
    if (params.query && params.query.trim()) {
      const q = params.query.trim();
      // Detect CJK characters: use LIKE for better Chinese search
      if (/[一-鿿㐀-䶿]/.test(q)) {
        useLike = true;
        conditions.push(`(n.title LIKE ? OR n.content LIKE ?)`);
        bindings.push(`%${q}%`, `%${q}%`);
      } else {
        const sanitized = this.sanitizeQuery(q);
        conditions.push('notes_fts MATCH ?');
        bindings.push(sanitized);
      }
    }

    if (params.format) {
      conditions.push('n.format = ?');
      bindings.push(params.format);
    }

    if (params.dateFrom) {
      conditions.push('n.modified_at >= ?');
      bindings.push(params.dateFrom);
    }

    if (params.dateTo) {
      conditions.push('n.modified_at <= ?');
      bindings.push(params.dateTo);
    }

    const orderBy = params.sortBy === 'modified' ? 'n.modified_at DESC' :
      params.sortBy === 'created' ? 'n.created_at DESC' :
      params.sortBy === 'title' ? 'n.title ASC' :
      useLike ? 'n.modified_at DESC' : 'rank';

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    let tagFilter = '';

    if (params.tags && params.tags.length > 0) {
      const tagPlaceholders = params.tags.map(() => '?').join(',');
      tagFilter = `AND n.id IN (SELECT nt2.note_id FROM note_tags nt2 WHERE nt2.tag_id IN (${tagPlaceholders}))`;
      bindings.push(...params.tags);
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    let sql: string;
    if (useLike) {
      sql = `
        SELECT
          n.id,
          n.file_path AS filePath,
          n.format,
          COALESCE(n.title, '') as title,
          n.modified_at AS modifiedAt,
          n.title AS titleHighlight,
          n.content AS snippet,
          COALESCE(GROUP_CONCAT(t.name, ', '), '') AS tags,
          0.0 AS rank
        FROM notes n
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        LEFT JOIN tags t ON nt.tag_id = t.id
        ${where}
        ${tagFilter}
        GROUP BY n.id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;
    } else {
      // Subquery approach: FTS5 functions can't work with GROUP BY
      sql = `
        SELECT
          fts.id,
          fts.filePath,
          fts.format,
          fts.title,
          fts.modifiedAt,
          fts.titleHighlight,
          fts.snippet,
          COALESCE(GROUP_CONCAT(t.name, ', '), '') AS tags,
          fts.rank
        FROM (
          SELECT
            n.id,
            n.file_path AS filePath,
            n.format,
            COALESCE(n.title, '') as title,
            n.modified_at AS modifiedAt,
            highlight(notes_fts, 0, '<mark>', '</mark>') AS titleHighlight,
            highlight(notes_fts, 1, '<mark>', '</mark>') AS snippet,
            bm25(notes_fts) AS rank
          FROM notes_fts
          JOIN notes n ON n.id = notes_fts.rowid
          ${where}
          ${tagFilter}
          ORDER BY rank
          LIMIT ? OFFSET ?
        ) AS fts
        LEFT JOIN note_tags nt ON fts.id = nt.note_id
        LEFT JOIN tags t ON nt.tag_id = t.id
        GROUP BY fts.id
        ORDER BY fts.rank
      `;
    }

    bindings.push(limit, offset);

    try {
      const stmt = db.prepare(sql);
      return stmt.all(...bindings) as SearchResult[];
    } catch {
      return [];
    }
  }

  /** Cheap check: is the on-disk content already indexed with this hash? */
  needsReindex(filePath: string, contentHash: string): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT content_hash FROM notes WHERE file_path = ?').get(filePath) as { content_hash: string } | undefined;
    return !existing || existing.content_hash !== contentHash;
  }

  /** Bump modified_at without touching the (unchanged) indexed content. */
  touchModified(filePath: string): void {
    const db = getDb();
    db.prepare("UPDATE notes SET modified_at = datetime('now') WHERE file_path = ?").run(filePath);
  }

  indexNote(filePath: string, format: 'md' | 'tex', title: string, plainContent: string, contentHash: string, fileSize: number, wordCount: number): void {
    const db = getDb();
    const existing = db.prepare('SELECT id, content_hash FROM notes WHERE file_path = ?').get(filePath) as { id: number; content_hash: string } | undefined;

    if (existing && existing.content_hash === contentHash) {
      db.prepare("UPDATE notes SET modified_at = datetime('now') WHERE id = ?").run(existing.id);
      return;
    }

    if (existing) {
      db.prepare(
        "UPDATE notes SET format=?, title=?, content=?, content_hash=?, file_size=?, word_count=?, modified_at=datetime('now') WHERE id=?"
      ).run(format, title, plainContent, contentHash, fileSize, wordCount, existing.id);
    } else {
      db.prepare(
        "INSERT INTO notes (file_path, format, title, content, content_hash, file_size, word_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(filePath, format, title, plainContent, contentHash, fileSize, wordCount);
    }
  }

  removeNote(filePath: string): void {
    const db = getDb();
    db.prepare('DELETE FROM notes WHERE file_path = ?').run(filePath);
  }

  addSearchHistory(query: string, resultCount: number): void {
    const db = getDb();
    db.prepare('INSERT INTO search_history (query, result_count) VALUES (?, ?)').run(query, resultCount);
  }

  getSearchSuggestions(prefix: string, limit = 8): string[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT query, COUNT(*) as cnt FROM search_history WHERE query LIKE ? GROUP BY query ORDER BY MAX(searched_at) DESC LIMIT ?'
    ).all(`${prefix}%`, limit) as Array<{ query: string }>;
    return rows.map((r) => r.query);
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/['"*()^~\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => `${w}*`)
      .join(' AND ');
  }
}

export const searchEngine = new SearchEngine();
