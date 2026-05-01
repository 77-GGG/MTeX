import { Menu, BrowserWindow } from 'electron';

export function buildMenu(mainWindow: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'MTeX',
      submenu: [
        { label: 'About MTeX', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'Cmd+,', enabled: false },
        { type: 'separator' },
        { label: 'Services', role: 'services' },
        { type: 'separator' },
        { label: 'Hide MTeX', accelerator: 'Cmd+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Cmd+Shift+H', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Cmd+Q', role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace...',
          accelerator: 'Cmd+O',
          click: () => { mainWindow.webContents.send('menu:openWorkspace'); },
        },
        { type: 'separator' },
        {
          label: 'Close Workspace',
          accelerator: 'Cmd+W',
          click: () => { mainWindow.webContents.send('menu:closeWorkspace'); },
        },
        { type: 'separator' },
        {
          label: 'New Markdown Note',
          accelerator: 'Cmd+N',
          click: () => { mainWindow.webContents.send('menu:newMarkdown'); },
        },
        {
          label: 'New LaTeX Document',
          click: () => { mainWindow.webContents.send('menu:newLatex'); },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'Cmd+S',
          click: () => { mainWindow.webContents.send('menu:save'); },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Cmd+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Cmd+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Cmd+X', role: 'cut' },
        { label: 'Copy', accelerator: 'Cmd+C', role: 'copy' },
        { label: 'Paste', accelerator: 'Cmd+V', role: 'paste' },
        { label: 'Select All', accelerator: 'Cmd+A', role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Search Notes...',
          accelerator: 'Cmd+Shift+F',
          click: () => { mainWindow.webContents.send('menu:search'); },
        },
        {
          label: 'Command Palette...',
          accelerator: 'Cmd+P',
          click: () => { mainWindow.webContents.send('menu:commandPalette'); },
        },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'Cmd+Option+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'Cmd+R', role: 'reload' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'MTeX Help',
          click: () => { /* TODO */ },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
