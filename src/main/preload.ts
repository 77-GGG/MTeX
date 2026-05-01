import { contextBridge, ipcRenderer } from 'electron';

export interface MTeXAPI {
  note: {
    create: (filePath: string, format: 'md' | 'tex') => Promise<unknown>;
    read: (filePath: string) => Promise<{ filePath: string; content: string; format: string }>;
    write: (filePath: string, content: string) => Promise<void>;
    delete: (filePath: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    list: (directory: string) => Promise<unknown[]>;
    createFolder: (dirPath: string) => Promise<void>;
  };
  search: {
    query: (params: unknown) => Promise<unknown[]>;
    suggestions: (prefix: string) => Promise<string[]>;
  };
  tags: {
    list: () => Promise<unknown[]>;
    create: (name: string, color?: string) => Promise<number>;
    delete: (tagId: number) => Promise<void>;
    attach: (noteFilePath: string, tagId: number) => Promise<void>;
    detach: (noteFilePath: string, tagId: number) => Promise<void>;
    getForNote: (noteFilePath: string) => Promise<unknown[]>;
  };
  bookmarks: {
    list: () => Promise<unknown[]>;
    toggle: (noteFilePath: string) => Promise<boolean>;
    isBookmarked: (noteFilePath: string) => Promise<boolean>;
  };
  shell: {
    revealInFinder: (filePath: string) => Promise<void>;
  };
  latex: {
    status: () => Promise<{ available: boolean }>;
    compile: (filePath: string) => Promise<{
      success: boolean;
      pdfUrl?: string;
      log?: string;
      errors: string[];
    }>;
  };
  exportPdf: {
    save: (content: string, format: 'md' | 'tex') => Promise<{ success: boolean; pdfBase64?: string }>;
  };
  templates: {
    list: (format: 'md' | 'tex') => Promise<Array<{ name: string; filename: string; source: 'builtin' | 'user' }>>;
    read: (format: 'md' | 'tex', filename: string, source?: string) => Promise<string | null>;
    saveUser: (format: 'md' | 'tex', name: string, content: string) => Promise<boolean>;
    deleteUser: (format: 'md' | 'tex', filename: string) => Promise<boolean>;
  };
  workspace: {
    getConfig: () => Promise<{ workspaceRoot: string | null }>;
    setConfig: (config: unknown) => Promise<boolean>;
    openDirectory: () => Promise<string | null>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

const api: MTeXAPI = {
  note: {
    create: (filePath, format) => ipcRenderer.invoke('note:create', filePath, format),
    read: (filePath) => ipcRenderer.invoke('note:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('note:write', filePath, content),
    delete: (filePath) => ipcRenderer.invoke('note:delete', filePath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('note:rename', oldPath, newPath),
    list: (directory) => ipcRenderer.invoke('note:list', directory),
    createFolder: (dirPath) => ipcRenderer.invoke('note:createFolder', dirPath),
  },
  search: {
    query: (params) => ipcRenderer.invoke('search:query', params),
    suggestions: (prefix) => ipcRenderer.invoke('search:suggestions', prefix),
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (name, color) => ipcRenderer.invoke('tags:create', name, color),
    delete: (tagId) => ipcRenderer.invoke('tags:delete', tagId),
    attach: (noteFilePath, tagId) => ipcRenderer.invoke('tags:attach', noteFilePath, tagId),
    detach: (noteFilePath, tagId) => ipcRenderer.invoke('tags:detach', noteFilePath, tagId),
    getForNote: (noteFilePath) => ipcRenderer.invoke('tags:getForNote', noteFilePath),
  },
  bookmarks: {
    list: () => ipcRenderer.invoke('bookmarks:list'),
    toggle: (noteFilePath) => ipcRenderer.invoke('bookmarks:toggle', noteFilePath),
    isBookmarked: (noteFilePath) => ipcRenderer.invoke('bookmarks:isBookmarked', noteFilePath),
  },
  shell: {
    revealInFinder: (filePath) => ipcRenderer.invoke('shell:revealInFinder', filePath),
  },
  latex: {
    status: () => ipcRenderer.invoke('latex:status'),
    compile: (filePath) => ipcRenderer.invoke('latex:compile', filePath),
  },
  exportPdf: {
    save: (content, format) => ipcRenderer.invoke('export:savePdf', content, format),
  },
  templates: {
    list: (format) => ipcRenderer.invoke('templates:list', format),
    read: (format, filename, source) => ipcRenderer.invoke('templates:read', format, filename, source),
    saveUser: (format, name, content) => ipcRenderer.invoke('templates:saveUser', format, name, content),
    deleteUser: (format, filename) => ipcRenderer.invoke('templates:deleteUser', format, filename),
  },
  workspace: {
    getConfig: () => ipcRenderer.invoke('workspace:getConfig'),
    setConfig: (config) => ipcRenderer.invoke('workspace:setConfig', config),
    openDirectory: () => ipcRenderer.invoke('workspace:openDirectory'),
  },
  on: (channel, callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('mtexAPI', api);
