import { ipcMain, BrowserWindow, shell, app } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { fileManager, FileTreeNode } from './file-manager';
import { searchEngine, SearchParams } from './search-engine';
import { getDb } from './database';
import fs from 'fs/promises';
import MarkdownIt from 'markdown-it';
import { extractPlainContent } from './utils/content-extractor';
import { parseFrontmatter, updateFrontmatterTags, extractTitle } from './utils/frontmatter';
import { compileLatex, getTexBin } from './latex-compiler';

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function indexFile(filePath: string, content: string, format: 'md' | 'tex'): void {
  const h = hashContent(content);
  // Fast path: content unchanged since last index — skip the expensive
  // plain-text extraction and just refresh the timestamp.
  if (searchEngine.needsReindex(filePath, h)) {
    const plainContent = extractPlainContent(content, format);
    const title = extractTitle(filePath, content, format);
    searchEngine.indexNote(filePath, format, title, plainContent, h, Buffer.byteLength(content, 'utf-8'), plainContent.split(/\s+/).filter(Boolean).length);
  } else {
    searchEngine.touchModified(filePath);
  }
  // Wikilinks: cheap regex, refreshed every time so backlinks stay correct
  // and pre-existing notes get backfilled on first run after the v4 migration.
  searchEngine.updateWikilinks(filePath, content);
}

async function scanAndIndexFiles(nodes: FileTreeNode[]): Promise<void> {
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      await scanAndIndexFiles(node.children);
    } else if (node.type === 'file' && node.format && (node.format === 'md' || node.format === 'tex')) {
      try {
        const result = await fileManager.readFile(node.path);
        indexFile(node.path, result.content, node.format);
      } catch {
        // skip files that can't be read
      }
    }
  }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  fileManager.onChanged((change) => {
    mainWindow.webContents.send('file:changed', change);
  });

  // ---- Note handlers ----

  ipcMain.handle('note:list', async (_event, directory: string) => {
    if (fileManager.workspace !== directory) {
      await fileManager.setWorkspace(directory);
    }

    const fileTree = await fileManager.listFiles();

    // Index existing files in the background so the file tree renders
    // immediately. Search results become available as indexing completes;
    // unchanged files are skipped cheaply via content-hash short-circuit.
    void scanAndIndexFiles(fileTree).catch(() => {
      // non-fatal
    });

    return fileTree;
  });

  ipcMain.handle('note:read', async (_event, filePath: string) => {
    const result = await fileManager.readFile(filePath);
    try {
      indexFile(filePath, result.content, result.format as 'md' | 'tex');
    } catch {
      // indexing failure should not block reading
    }
    return result;
  });

  ipcMain.handle('note:write', async (_event, filePath: string, content: string) => {
    await fileManager.writeFile(filePath, content);
    const format = filePath.endsWith('.tex') ? 'tex' : 'md';
    indexFile(filePath, content, format);
  });

  ipcMain.handle('note:create', async (_event, filePath: string, format: 'md' | 'tex') => {
    await fileManager.createFile(filePath, format);
    const result = await fileManager.readFile(filePath);
    indexFile(filePath, result.content, format);
  });

  ipcMain.handle('note:delete', async (_event, filePath: string) => {
    await fileManager.deleteFile(filePath);
    searchEngine.removeNote(filePath);
  });

  ipcMain.handle('note:rename', async (_event, oldPath: string, newPath: string) => {
    await fileManager.renameFile(oldPath, newPath);
    searchEngine.removeNote(oldPath);
    const result = await fileManager.readFile(newPath);
    const format = newPath.endsWith('.tex') ? 'tex' : 'md';
    indexFile(newPath, result.content, format);
  });

  ipcMain.handle('note:createFolder', async (_event, dirPath: string) => {
    await fileManager.createFolder(dirPath);
  });

  ipcMain.handle('note:saveAsset', async (_event, data: Uint8Array, ext: string) => {
    return fileManager.saveAsset(data, ext);
  });

  // ---- Search handlers ----

  ipcMain.handle('search:query', async (_event, params: SearchParams) => {
    const results = searchEngine.search(params);
    searchEngine.addSearchHistory(params.query || '', results.length);
    return results;
  });

  ipcMain.handle('search:suggestions', async (_event, prefix: string) => {
    return searchEngine.getSearchSuggestions(prefix);
  });

  // ---- Backlinks ----

  ipcMain.handle('links:backlinks', async (_event, filePath: string) => {
    return searchEngine.getBacklinks(filePath);
  });

  // ---- Tag handlers ----

  ipcMain.handle('tags:list', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
  });

  ipcMain.handle('tags:create', async (_event, name: string, color?: string) => {
    const db = getDb();
    const result = db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)').run(name, color || null);
    return result.lastInsertRowid;
  });

  ipcMain.handle('tags:delete', async (_event, tagId: number) => {
    const db = getDb();
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
  });

  ipcMain.handle('tags:attach', async (_event, noteFilePath: string, tagId: number) => {
    const db = getDb();
    const note = db.prepare('SELECT id FROM notes WHERE file_path = ?').get(noteFilePath) as { id: number } | undefined;
    if (!note) return;
    db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(note.id, tagId);

    // Sync to file frontmatter (for .md files)
    if (noteFilePath.endsWith('.md')) {
      const allTags = db.prepare(`
        SELECT t.name FROM tags t
        JOIN note_tags nt ON t.id = nt.tag_id
        JOIN notes n ON nt.note_id = n.id
        WHERE n.file_path = ?
      `).all(noteFilePath) as Array<{ name: string }>;

      const result = await fileManager.readFile(noteFilePath);
      const newContent = updateFrontmatterTags(result.content, allTags.map((t) => t.name));
      await fileManager.writeFile(noteFilePath, newContent);
      indexFile(noteFilePath, newContent, 'md');
    }
  });

  ipcMain.handle('tags:detach', async (_event, noteFilePath: string, tagId: number) => {
    const db = getDb();
    const note = db.prepare('SELECT id FROM notes WHERE file_path = ?').get(noteFilePath) as { id: number } | undefined;
    if (!note) return;
    db.prepare('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?').run(note.id, tagId);

    if (noteFilePath.endsWith('.md')) {
      const allTags = db.prepare(`
        SELECT t.name FROM tags t
        JOIN note_tags nt ON t.id = nt.tag_id
        JOIN notes n ON nt.note_id = n.id
        WHERE n.file_path = ?
      `).all(noteFilePath) as Array<{ name: string }>;

      const result = await fileManager.readFile(noteFilePath);
      const newContent = updateFrontmatterTags(result.content, allTags.map((t) => t.name));
      await fileManager.writeFile(noteFilePath, newContent);
      indexFile(noteFilePath, newContent, 'md');
    }
  });

  ipcMain.handle('tags:getForNote', async (_event, noteFilePath: string) => {
    const db = getDb();
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      JOIN notes n ON nt.note_id = n.id
      WHERE n.file_path = ?
    `).all(noteFilePath);
  });

  // ---- Shell handlers ----

  ipcMain.handle('shell:revealInFinder', async (_event, filePath: string) => {
    if (!fileManager.workspace) return;
    try {
      const fullPath = fileManager.resolveInWorkspace(filePath);
      shell.showItemInFolder(fullPath);
    } catch {
      // path traversal attempt — ignore
    }
  });

  // ---- Bookmarks handlers ----

  ipcMain.handle('bookmarks:list', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT n.* FROM notes n JOIN bookmarks b ON n.id = b.note_id ORDER BY b.created_at DESC
    `).all();
  });

  ipcMain.handle('bookmarks:toggle', async (_event, noteFilePath: string) => {
    const db = getDb();
    const note = db.prepare('SELECT id FROM notes WHERE file_path = ?').get(noteFilePath) as { id: number } | undefined;
    if (!note) return false;

    const existing = db.prepare('SELECT id FROM bookmarks WHERE note_id = ?').get(note.id);
    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE note_id = ?').run(note.id);
      return false;
    } else {
      db.prepare('INSERT INTO bookmarks (note_id) VALUES (?)').run(note.id);
      return true;
    }
  });

  ipcMain.handle('bookmarks:isBookmarked', async (_event, noteFilePath: string) => {
    const db = getDb();
    const note = db.prepare('SELECT id FROM notes WHERE file_path = ?').get(noteFilePath) as { id: number } | undefined;
    if (!note) return false;
    const bm = db.prepare('SELECT id FROM bookmarks WHERE note_id = ?').get(note.id);
    return !!bm;
  });

  // ---- LaTeX handlers ----

  ipcMain.handle('latex:status', async () => {
    const bins = getTexBin();
    return { available: !!bins, compiler: bins ? path.basename(bins.latex) : null };
  });

  ipcMain.handle('latex:compile', async (_event, filePath: string) => {
    if (!fileManager.workspace) {
      return { success: false, errors: ['No workspace open'] };
    }
    // Only compile .tex files that live inside the workspace.
    if (!filePath.endsWith('.tex')) {
      return { success: false, errors: ['Not a .tex file'] };
    }
    try {
      fileManager.resolveInWorkspace(filePath);
    } catch {
      return { success: false, errors: ['Invalid file path'] };
    }
    try {
      const result = await compileLatex(filePath, fileManager.workspace);
      if (result.success && result.pdfPath) {
        // Verify the PDF was actually produced before handing back a URL.
        try {
          await fs.stat(result.pdfPath);
        } catch {
          return { success: false, errors: ['PDF file not found'] };
        }
        return { ...result, pdfUrl: 'local-pdf://' + result.pdfPath };
      }
      return result;
    } catch (e) {
      console.error('[latex:compile] exception:', e);
      return { success: false, errors: [String(e)] };
    }
  });

  // ---- Template handlers ----

  const builtinTemplatesDir = path.join(__dirname, '../../resources/templates');

  function getUserTemplatesDir(): string {
    return path.join(app.getPath('userData'), 'templates');
  }

  /**
   * Resolve a template path inside `baseDir`, rejecting any path traversal.
   * `segments` come from the renderer and are otherwise untrusted.
   */
  function safeTemplatePath(baseDir: string, ...segments: string[]): string {
    const root = path.resolve(baseDir);
    const full = path.resolve(root, ...segments);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error('Invalid template path');
    }
    return full;
  }

  /** A template name must be a single, safe filename component. */
  function isSafeName(name: string): boolean {
    return !!name && !name.includes('/') && !name.includes('\\') &&
      name !== '.' && name !== '..' && !path.isAbsolute(name);
  }

  async function listTemplatesIn(dir: string, format: 'md' | 'tex'): Promise<Array<{ name: string; filename: string; source: 'builtin' | 'user' }>> {
    try {
      const subDir = path.join(dir, format);
      const files = await fs.readdir(subDir);
      return files
        .filter((f: string) => f.endsWith(format === 'md' ? '.md' : '.tex'))
        .map((f: string) => ({
          name: f.replace(/\.(md|tex)$/, ''),
          filename: f,
          source: dir === builtinTemplatesDir ? 'builtin' as const : 'user' as const,
        }));
    } catch {
      return [];
    }
  }

  ipcMain.handle('templates:list', async (_event, format: 'md' | 'tex') => {
    const builtin = await listTemplatesIn(builtinTemplatesDir, format);
    const userTpl = await listTemplatesIn(getUserTemplatesDir(), format);
    // User templates override built-in with same name
    const userNames = new Set(userTpl.map((t) => t.name));
    const merged = [...userTpl, ...builtin.filter((t) => !userNames.has(t.name))];
    return merged;
  });

  ipcMain.handle('templates:read', async (_event, format: 'md' | 'tex', filename: string, source?: string) => {
    try {
      if (format !== 'md' && format !== 'tex') return null;
      if (!isSafeName(filename)) return null;
      const baseDir = source === 'user' ? getUserTemplatesDir() : builtinTemplatesDir;
      const filePath = safeTemplatePath(baseDir, format, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      return content.replace(/\{\{date\}\}/g, today);
    } catch {
      return null;
    }
  });

  ipcMain.handle('templates:saveUser', async (_event, format: 'md' | 'tex', name: string, content: string) => {
    try {
      if (format !== 'md' && format !== 'tex') return false;
      if (!isSafeName(name)) return false;
      const dir = path.join(getUserTemplatesDir(), format);
      await fs.mkdir(dir, { recursive: true });
      const ext = format === 'md' ? '.md' : '.tex';
      const filePath = safeTemplatePath(getUserTemplatesDir(), format, name + ext);
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('templates:deleteUser', async (_event, format: 'md' | 'tex', filename: string) => {
    try {
      if (format !== 'md' && format !== 'tex') return false;
      if (!isSafeName(filename)) return false;
      const filePath = safeTemplatePath(getUserTemplatesDir(), format, filename);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // ---- Export ----

  ipcMain.handle('export:savePdf', async (_event, content: string, format: 'md' | 'tex') => {
    try {
      if (format === 'tex') {
        return { success: false, errors: ['Use Compile first, then click Save PDF again'] };
      }
      // Render markdown to HTML
      const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });
      const rendered = md.render(content);

      // Create hidden window to render markdown alone
      const printWin = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 2em; max-width: 700px; margin: 0 auto; line-height: 1.7; color: #1a1a1a; }
  h1 { font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; }
  pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
  code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.5em; }
  blockquote { border-left: 3px solid #ddd; padding-left: 1em; color: #666; }
  img { max-width: 100%; }
  a { color: #2563eb; }
</style></head><body>${rendered}</body></html>`;

      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise(resolve => setTimeout(resolve, 500));

      const pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
      });

      printWin.close();
      return { success: true, pdfBase64: pdfData.toString('base64') };
    } catch (e) {
      return { success: false, errors: [String(e)] };
    }
  });
}
