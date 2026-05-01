import { useState, useEffect } from 'react';

interface Tag {
  id: number;
  name: string;
  color: string | null;
}

interface TagListProps {
  onFilterByTag?: (tagId: number) => void;
  activeTagId?: number | null;
  onFilterByBookmark?: () => void;
  bookmarkActive?: boolean;
}

const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function TagList({ onFilterByTag, activeTagId, onFilterByBookmark, bookmarkActive }: TagListProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const loadTags = async () => {
    const t = await window.mtexAPI.tags.list();
    setTags(t as Tag[]);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    await window.mtexAPI.tags.create(newTagName.trim(), color);
    setNewTagName('');
    setShowInput(false);
    await loadTags();
  };

  const handleDelete = async (tagId: number) => {
    await window.mtexAPI.tags.delete(tagId);
    await loadTags();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') { setShowInput(false); setNewTagName(''); }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 py-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
      >
        <span>Tags</span>
        <span className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer"
            title="Add tag"
          >
            +
          </button>
          <span className="text-xs">{expanded ? '▾' : '▸'}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-2 space-y-0.5">
          {/* New tag input */}
          {showInput && (
            <div className="flex items-center gap-1 px-1 py-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (!newTagName.trim()) { setShowInput(false); } }}
                placeholder="Tag name..."
                className="flex-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
          )}

          {/* Bookmark pseudo-tag */}
          <div className="flex items-center gap-1 group">
            <button
              onClick={() => onFilterByBookmark?.()}
              className={`flex items-center gap-1.5 flex-1 px-1 py-0.5 rounded cursor-pointer
                ${bookmarkActive
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
            >
              <span className="text-yellow-500 text-xs shrink-0">★</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">收藏</span>
            </button>
          </div>

          {/* Tag list */}
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1 group"
            >
              <button
                onClick={() => onFilterByTag?.(tag.id)}
                className={`flex items-center gap-1.5 flex-1 px-1 py-0.5 rounded cursor-pointer
                  ${activeTagId === tag.id
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color || '#9ca3af' }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{tag.name}</span>
              </button>
              <button
                onClick={() => handleDelete(tag.id)}
                className="text-gray-400 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-0.5"
                title="Delete tag"
              >
                ×
              </button>
            </div>
          ))}

          {tags.length === 0 && !showInput && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-1">No tags yet</p>
          )}
        </div>
      )}
    </div>
  );
}
