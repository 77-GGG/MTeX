import { useState, useEffect, useRef, useCallback } from 'react';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  category: 'file' | 'command';
  action: () => void;
}

interface FileItem { name: string; path: string; format: string; }

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  workspaceRoot: string | null;
  activeNote: string | null;
  onOpenFile: (path: string) => void;
  onNewMarkdown: () => void;
  onNewLatex: () => void;
  onOpenSearch: () => void;
  onToggleTheme: () => void;
}

export default function CommandPalette({
  open, onClose, workspaceRoot, activeNote, onOpenFile,
  onNewMarkdown, onNewLatex, onOpenSearch, onToggleTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load files on open
  useEffect(() => {
    if (open && workspaceRoot) {
      window.mtexAPI.note.list(workspaceRoot).then((tree) => {
        const flat: FileItem[] = [];
        function walk(nodes: Array<{ name: string; path: string; type: string; format?: string; children?: unknown[] }>) {
          for (const n of nodes) {
            if (n.type === 'file' && n.format) flat.push({ name: n.name, path: n.path, format: n.format });
            if (n.type === 'directory' && n.children) walk(n.children as typeof nodes);
          }
        }
        walk(tree as typeof nodes);
        setFiles(flat);
      });
    }
  }, [open, workspaceRoot]);

  const getCommands = useCallback((): CommandItem[] => [
    { id: 'new-md', label: 'New Markdown Note', shortcut: '⌘N', category: 'command', action: () => { onNewMarkdown(); onClose(); } },
    { id: 'new-tex', label: 'New LaTeX Document', shortcut: '', category: 'command', action: () => { onNewLatex(); onClose(); } },
    { id: 'bookmark', label: 'Toggle Bookmark', shortcut: '⌘B', category: 'command', action: () => {
      if (activeNote) window.mtexAPI.bookmarks.toggle(activeNote); onClose();
    }},
    { id: 'search', label: 'Search Notes...', shortcut: '⌘⇧F', category: 'command', action: () => { onOpenSearch(); onClose(); } },
    { id: 'theme', label: 'Toggle Dark/Light Theme', shortcut: '', category: 'command', action: () => { onToggleTheme(); onClose(); } },
  ], [onClose, onNewMarkdown, onNewLatex, onOpenSearch, onToggleTheme, activeNote]);

  const filteredItems = useCallback((): CommandItem[] => {
    const q = query.trim().toLowerCase();
    const commands = getCommands();

    if (!q) {
      // Show all: recent commands + files
      const fileItems: CommandItem[] = files.slice(0, 10).map((f) => ({
        id: 'file:' + f.path,
        label: f.name,
        shortcut: f.format === 'md' ? 'MD' : 'TEX',
        category: 'file' as const,
        action: () => { onOpenFile(f.path); onClose(); },
      }));
      return [...fileItems, ...commands];
    }

    // Fuzzy match
    const matchedFiles: CommandItem[] = files
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((f) => ({
        id: 'file:' + f.path,
        label: f.name,
        shortcut: f.format === 'md' ? 'MD' : 'TEX',
        category: 'file' as const,
        action: () => { onOpenFile(f.path); onClose(); },
      }));

    const matchedCommands = commands.filter((c) =>
      c.label.toLowerCase().includes(q)
    );

    return [...matchedFiles, ...matchedCommands];
  }, [query, files, onClose, onOpenFile, getCommands]);

  const items = filteredItems();
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[safeIdx]) items[safeIdx].action();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/30 dark:bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg text-gray-400">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search files or commands..."
            className="flex-1 bg-transparent border-none outline-none text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                idx === safeIdx
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm shrink-0">
                  {item.category === 'file' ? '📄' : '⚡'}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{item.shortcut}</span>
              )}
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No matches found</div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
          <span>{items.length} items</span>
          <span>↑↓ Navigate · Enter Select · Esc Close</span>
        </div>
      </div>
    </div>
  );
}
