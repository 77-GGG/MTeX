import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { registerIpcHandlers } from './ipc-handlers';
import { fileManager } from './file-manager';
import { initDatabase, closeDatabase } from './database';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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
  return dir;
});

ipcMain.handle('workspace:getConfig', async () => {
  return { workspaceRoot: null };
});

ipcMain.handle('workspace:setConfig', async (_event, config) => {
  // TODO: persist to database
  return true;
});
