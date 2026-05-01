import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  id: number;
  filePath: string;
  format: string;
  title: string;
  modifiedAt: string;
  titleHighlight: string;
  snippet: string;
  tags: string;
}

interface Tag {
  id: number;
  name: string;
  color: string | null;
}

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (filePath: string, query: string) => void;
}

export default function SearchPanel({ open, onClose, onOpenNote }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<'all' | 'md' | 'tex'>('all');
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load tags
  useEffect(() => {
    if (open) {
      window.mtexAPI.tags.list().then((t) => setTags(t as Tag[]));
    }
  }, [open]);

  const doSearch = useCallback(async () => {
    if (!query.trim() && tagFilter.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 30 };
      if (query.trim()) params.query = query.trim();
      if (format !== 'all') params.format = format;
      if (tagFilter.length > 0) params.tags = tagFilter;
      const r = await window.mtexAPI.search.query(params);
      setResults(r as SearchResult[]);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, format, tagFilter]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doSearch, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [doSearch]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setFormat('all');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIdx]) {
        onOpenNote(results[selectedIdx].filePath, query.trim());
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Global Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 dark:bg-black/50">
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search notes... (↑↓ navigate, Enter open, Esc close)"
              className="flex-1 bg-transparent border-none outline-none text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-gray-400 dark:text-gray-500">Format:</span>
            {(['all', 'md', 'tex'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                  format === f
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'md' ? '.md' : '.tex'}
              </button>
            ))}
            {tags.length > 0 && (
              <>
                <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setTagFilter((prev) =>
                      prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                    )}
                    className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 ${
                      tagFilter.includes(tag.id)
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#9ca3af' }} />
                    {tag.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && query.trim() ? (
            <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
              {loading ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            results.map((result, idx) => (
              <button
                key={result.id}
                onClick={() => { onOpenNote(result.filePath, query.trim()); onClose(); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors ${
                  idx === selectedIdx
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                }`}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                    result.format === 'md'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  }`}>
                    {result.format === 'md' ? 'MD' : 'TEX'}
                  </span>
                  <span
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                    dangerouslySetInnerHTML={{ __html: result.titleHighlight || result.title }}
                  />
                  {result.tags && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
                      🏷️ {result.tags}
                    </span>
                  )}
                </div>
                {result.snippet && (
                  <p
                    className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 ml-14"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-14 truncate">
                  {result.filePath}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>{results.length} results</span>
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
        </div>
      </div>
    </div>
  );
}
