import { useState } from 'react';
import ContextMenu, { ContextMenuItem } from '../common/ContextMenu';
import type { FileTreeNode } from './Sidebar';

interface FileTreeProps {
  files: FileTreeNode[];
  activeNote: string | null;
  onSelectNote: (path: string) => void;
  onRefresh: () => void;
  workspaceRoot: string;
  bookmarkedPaths?: Set<string>;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileTreeNode | null; // null means workspace root
}

function getWorkspaceName(root: string): string {
  const parts = root.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || root;
}

function FileTreeItem({
  node,
  depth,
  activeNote,
  onSelectNote,
  onContextMenu,
  bookmarkedPaths,
}: {
  node: FileTreeNode;
  depth: number;
  activeNote: string | null;
  onSelectNote: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  bookmarkedPaths?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => onContextMenu(e, node)}
          className="flex items-center gap-1.5 w-full py-1 px-1 text-left text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded cursor-pointer"
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          <span className="text-xs w-3 shrink-0">{expanded ? '▾' : '▸'}</span>
          <span className="truncate">📁 {node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                activeNote={activeNote}
                onSelectNote={onSelectNote}
                onContextMenu={onContextMenu}
                bookmarkedPaths={bookmarkedPaths}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = node.path === activeNote;
  const isBookmarked = bookmarkedPaths?.has(node.path);

  return (
    <button
      onClick={() => onSelectNote(node.path)}
      onContextMenu={(e) => onContextMenu(e, node)}
      className={`flex items-center gap-1.5 w-full py-1 px-1 text-left text-sm rounded cursor-pointer truncate
        ${isActive
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
        }`}
      style={{ paddingLeft: `${depth * 20 + 12}px` }}
    >
      <span className="text-xs w-4 shrink-0 text-center">
        {node.format === 'md' ? '📝' : node.format === 'tex' ? '📜' : '📄'}
      </span>
      <span className="truncate">{node.name}</span>
      {isBookmarked && <span className="text-yellow-500 text-xs shrink-0 ml-auto">★</span>}
    </button>
  );
}

export default function FileTree({ files, activeNote, onSelectNote, onRefresh, workspaceRoot, bookmarkedPaths }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const workspaceName = getWorkspaceName(workspaceRoot);

  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleWorkspaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
  };

  const makeItems = (): ContextMenuItem[] => {
    const node = contextMenu?.node;

    if (!node) {
      // Workspace root context menu
      return [
        { label: `📂 ${workspaceName}`, disabled: true, action: () => {} },
        { label: '', separator: true, action: () => {} },
        { label: 'New Markdown Note', shortcut: '⌘N', action: () => createNote('md') },
        { label: 'New LaTeX Document', action: () => createNote('tex') },
        { label: 'New Folder', action: () => createFolder() },
        { label: '', separator: true, action: () => {} },
        { label: 'Reveal in Finder', action: () => window.mtexAPI.shell.revealInFinder('') },
      ];
    }

    if (node.type === 'directory') {
      return [
        { label: `📁 ${node.name}`, disabled: true, action: () => {} },
        { label: '', separator: true, action: () => {} },
        { label: 'New Markdown Note', action: () => createNoteInDir(node.path, 'md') },
        { label: 'New LaTeX Document', action: () => createNoteInDir(node.path, 'tex') },
        { label: 'New Folder', action: () => createFolderInDir(node.path) },
        { label: '', separator: true, action: () => {} },
        { label: 'Rename', action: () => renameNode(node) },
        { label: '', separator: true, action: () => {} },
        { label: 'Delete Folder', danger: true, action: () => deleteNode(node) },
        { label: '', separator: true, action: () => {} },
        { label: 'Reveal in Finder', action: () => window.mtexAPI.shell.revealInFinder(node.path) },
      ];
    }

    return [
      { label: node.format === 'tex' ? '📜 LaTeX Document' : '📝 Markdown Note', disabled: true, action: () => {} },
      { label: '', separator: true, action: () => {} },
      { label: 'Open', action: () => onSelectNote(node.path) },
      { label: '', separator: true, action: () => {} },
      { label: 'Rename', action: () => renameNode(node) },
      { label: '', separator: true, action: () => {} },
      { label: 'Delete', shortcut: '⌫', danger: true, action: () => deleteNode(node) },
      { label: '', separator: true, action: () => {} },
      { label: 'Reveal in Finder', action: () => window.mtexAPI.shell.revealInFinder(node.path) },
    ];
  };

  const createNote = async (format: 'md' | 'tex') => {
    const ext = format === 'md' ? '.md' : '.tex';
    const baseName = format === 'md' ? 'Untitled' : 'Untitled';
    let fileName = `${baseName}${ext}`;
    let counter = 1;
    while (files.some((f) => f.name === fileName)) {
      fileName = `${baseName} ${counter}${ext}`;
      counter++;
    }
    await window.mtexAPI.note.create(fileName, format);
    onRefresh();
    onSelectNote(fileName);
  };

  const createNoteInDir = async (dirPath: string, format: 'md' | 'tex') => {
    const ext = format === 'md' ? '.md' : '.tex';
    const baseName = format === 'md' ? 'Untitled' : 'Untitled';
    const dirNode = findNode(files, dirPath);
    const siblings = dirNode?.children || [];
    let fileName = `${dirPath}/${baseName}${ext}`;
    let counter = 1;
    while (siblings.some((f) => f.name === `${baseName} ${counter}${ext}` || (counter === 1 && f.name === `${baseName}${ext}`))) {
      counter++;
      if (counter === 2) fileName = `${dirPath}/${baseName} ${counter}${ext}`;
    }
    await window.mtexAPI.note.create(fileName, format);
    onRefresh();
    onSelectNote(fileName);
  };

  const createFolder = async () => {
    let dirName = 'New Folder';
    let counter = 1;
    while (files.some((f) => f.name === dirName)) {
      dirName = `New Folder ${counter}`;
      counter++;
    }
    await window.mtexAPI.note.createFolder(dirName);
    onRefresh();
  };

  const createFolderInDir = async (dirPath: string) => {
    let dirName = 'New Folder';
    await window.mtexAPI.note.createFolder(`${dirPath}/${dirName}`);
    onRefresh();
  };

  const renameNode = async (node: FileTreeNode) => {
    const newName = prompt('New name:', node.name);
    if (!newName || newName === node.name) return;
    const dir = node.path.substring(0, node.path.lastIndexOf('/'));
    const newPath = dir ? `${dir}/${newName}` : newName;
    await window.mtexAPI.note.rename(node.path, newPath);
    if (activeNote === node.path) onSelectNote(newPath);
    onRefresh();
  };

  const deleteNode = async (node: FileTreeNode) => {
    const msg = node.type === 'directory'
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete "${node.name}"?`;
    if (!confirm(msg)) return;
    await window.mtexAPI.note.delete(node.path);
    if (activeNote === node.path) onSelectNote('');
    onRefresh();
  };

  if (files.length === 0) {
    return (
      <div>
        <div
          className="flex items-center px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 select-none"
          onContextMenu={handleWorkspaceContextMenu}
        >
          📂 {workspaceName}
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No notes yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Right-click to create a new note
          </p>
        </div>
        {contextMenu && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} items={makeItems()} onClose={() => setContextMenu(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      <div
        className="flex items-center px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 select-none"
        onContextMenu={handleWorkspaceContextMenu}
      >
        📂 {workspaceName}
      </div>
      {files.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          activeNote={activeNote}
          onSelectNote={onSelectNote}
          onContextMenu={handleContextMenu}
          bookmarkedPaths={bookmarkedPaths}
        />
      ))}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={makeItems()} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}

function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}
