import { useEffect, useState } from 'react';

interface Backlink {
  filePath: string;
  title: string;
}

interface BacklinksPanelProps {
  activeNote: string | null;
  onOpenNote: (filePath: string) => void;
  /** Bump to force a refresh (e.g. after the active note is saved). */
  refreshKey?: unknown;
}

export default function BacklinksPanel({ activeNote, onOpenNote, refreshKey }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (!activeNote) {
      setBacklinks([]);
      return;
    }
    let cancelled = false;
    window.mtexAPI.links
      .backlinks(activeNote)
      .then((bl) => {
        if (!cancelled) setBacklinks(bl);
      })
      .catch(() => {
        if (!cancelled) setBacklinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeNote, refreshKey]);

  if (backlinks.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 max-h-44 overflow-y-auto">
      <div className="sticky top-0 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
        🔗 反向链接 ({backlinks.length})
      </div>
      <ul className="pb-2">
        {backlinks.map((bl) => (
          <li key={bl.filePath}>
            <button
              onClick={() => onOpenNote(bl.filePath)}
              className="w-full text-left px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer truncate"
              title={bl.filePath}
            >
              {bl.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
