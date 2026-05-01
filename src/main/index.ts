import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { registerIpcHandlers } from './ipc-handlers';
import { fileManager } from './file-manager';
import { initDatabase, closeDatabase, getDb } from './database';
import { buildMenu } from './menu';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Restore window state
  let winWidth = 1400, winHeight = 900;
  try {
    const db = getDb();
    const w = db.prepare("SELECT value FROM workspace_config WHERE key='winWidth'").get() as { value: string } | undefined;
    const h = db.prepare("SELECT value FROM workspace_config WHERE key='winHeight'").get() as { value: string } | undefined;
    if (w) winWidth = parseInt(w.value);
    if (h) winHeight = parseInt(h.value);
  } catch { /* DB not ready yet */ }

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 900,
    minHeight: 500,
    title: 'MTeX',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Save window state on resize
  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getSize();
    try {
      const db = getDb();
      db.prepare("INSERT OR REPLACE INTO workspace_config (key, value) VALUES ('winWidth', ?)").run(String(w));
      db.prepare("INSERT OR REPLACE INTO workspace_config (key, value) VALUES ('winHeight', ?)").run(String(h));
    } catch { /* ignore */ }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // DevTools can be opened with Cmd+Option+I in the window
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register custom protocol for serving local PDFs
  protocol.handle('local-pdf', (request) => {
    const filePath = request.url.replace('local-pdf://', '');
    return net.fetch('file://' + filePath);
  });

  initDatabase();
  createWindow();
  buildMenu(mainWindow!);
  registerIpcHandlers(mainWindow!);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ---- IPC Handlers (stubs for now) ----

ipcMain.handle('workspace:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Open Notebook Workspace',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0];
  await fileManager.setWorkspace(dir);
  // Save to recent workspaces
  try {
    const db = getDb();
    db.prepare("DELETE FROM workspace_config WHERE value = ?").run(dir);
    const idx = db.prepare("SELECT COALESCE(MAX(CAST(REPLACE(key, 'recent_', '') AS INTEGER)), -1) + 1 AS next FROM workspace_config WHERE key LIKE 'recent_%'").get() as { next: number };
    const key = 'recent_' + String(idx.next).padStart(3, '0');
    db.prepare("INSERT INTO workspace_config (key, value) VALUES (?, ?)").run(key, dir);
  } catch { /* ignore */ }
  return dir;
});

ipcMain.handle('workspace:listRecent', async () => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT value FROM workspace_config WHERE key LIKE 'recent_%' ORDER BY key DESC LIMIT 10").all() as Array<{ value: string }>;
    return rows.map((r) => r.value);
  } catch { return []; }
});

ipcMain.handle('workspace:getConfig', async () => {
  return { workspaceRoot: null };
});

ipcMain.handle('workspace:setConfig', async (_event, config) => {
  // TODO: persist to database
  return true;
});
