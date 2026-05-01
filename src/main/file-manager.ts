import fs from 'fs/promises';
import path from 'path';
import { watch, FSWatcher } from 'chokidar';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  format?: 'md' | 'tex' | 'other';
  children?: FileTreeNode[];
}

const NOTE_EXTENSIONS = new Set(['.md', '.tex']);
const ALLOWED_EXTENSIONS = new Set(['.md', '.tex', '.txt', '.bib', '.cls', '.sty']);

function getFormat(filePath: string): 'md' | 'tex' | 'other' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md') return 'md';
  if (ext === '.tex') return 'tex';
  return 'other';
}

function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const MAX_DEPTH = 10;

async function buildFileTree(dirPath: string, rootDir: string, depth = 0): Promise<FileTreeNode[]> {
  if (depth > MAX_DEPTH) return [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, rootDir, depth + 1);
      if (children.length > 0 || true) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      }
    } else if (ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        format: getFormat(entry.name),
      });
    }
  }

  return sortTreeNodes(nodes);
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
}

export class FileManager {
  private workspaceRoot: string | null = null;
  private watcher: FSWatcher | null = null;
  private onChangeCallbacks: Array<(event: FileChangeEvent) => void> = [];

  get workspace(): string | null {
    return this.workspaceRoot;
  }

  async setWorkspace(root: string): Promise<void> {
    this.workspaceRoot = root;

    if (this.watcher) {
      try {
        this.watcher.close();
        // Don't await - close() can hang on large directories
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
      } catch {
        // ignore close errors
      }
    }

    this.watcher = watch(root, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      depth: 99,
    });

    this.watcher.on('add', (fullPath: string) => this.notifyChange('add', fullPath));
    this.watcher.on('change', (fullPath: string) => this.notifyChange('change', fullPath));
    this.watcher.on('unlink', (fullPath: string) => this.notifyChange('unlink', fullPath));
    this.watcher.on('addDir', () => this.notifyChange('add', ''));
    this.watcher.on('unlinkDir', () => this.notifyChange('unlink', ''));
  }

  onChanged(callback: (event: FileChangeEvent) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  private notifyChange(type: FileChangeEvent['type'], fullPath: string): void {
    const filePath = this.workspaceRoot && fullPath
      ? fullPath.replace(this.workspaceRoot + '/', '')
      : fullPath;
    for (const cb of this.onChangeCallbacks) {
      cb({ type, filePath });
    }
  }

  async listFiles(): Promise<FileTreeNode[]> {
    if (!this.workspaceRoot) return [];
    return buildFileTree(this.workspaceRoot, this.workspaceRoot);
  }

  async readFile(relativePath: string): Promise<{ filePath: string; content: string; format: string }> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const fullPath = path.join(this.workspaceRoot, relativePath);

    // Security: ensure path is within workspace
    if (!fullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return {
      filePath: relativePath,
      content,
      format: getFormat(relativePath),
    };
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const fullPath = path.join(this.workspaceRoot, relativePath);

    if (!fullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Atomic write: write to temp file then rename
    const tmpPath = fullPath + '.tmp.' + Date.now();
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, fullPath);
  }

  async createFile(relativePath: string, format: 'md' | 'tex'): Promise<void> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const fullPath = path.join(this.workspaceRoot, relativePath);

    if (!fullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const template = format === 'md'
      ? '# Untitled\n\nStart writing here...\n'
      : '\\documentclass{article}\n\\begin{document}\n\nStart writing here...\n\n\\end{document}\n';

    await fs.writeFile(fullPath, template, 'utf-8');
  }

  async deleteFile(relativePath: string): Promise<void> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const fullPath = path.join(this.workspaceRoot, relativePath);

    if (!fullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    await fs.rm(fullPath, { recursive: true });
  }

  async createFolder(relativePath: string): Promise<void> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const fullPath = path.join(this.workspaceRoot, relativePath);

    if (!fullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    await fs.mkdir(fullPath, { recursive: true });
  }

  async renameFile(oldRelativePath: string, newRelativePath: string): Promise<void> {
    if (!this.workspaceRoot) throw new Error('No workspace open');
    const oldFullPath = path.join(this.workspaceRoot, oldRelativePath);
    const newFullPath = path.join(this.workspaceRoot, newRelativePath);

    if (!oldFullPath.startsWith(this.workspaceRoot) || !newFullPath.startsWith(this.workspaceRoot)) {
      throw new Error('Path traversal detected');
    }

    await fs.mkdir(path.dirname(newFullPath), { recursive: true });
    await fs.rename(oldFullPath, newFullPath);
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

export const fileManager = new FileManager();
