import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  id: number;
  filePath: string;
  format: string;
  title: string;
  titleHighlight: string;
  snippet: string;
  tags: string;
}

interface SearchBarProps {
  workspaceRoot: string;
  onSelectNote: (path: string) => void;
  tagFilter?: number | null;
}

export default function SearchBar({ workspaceRoot, onSelectNote, tagFilter }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string, tagId?: number | null) => {
    if (!q.trim() && !tagId) {
      setResults([]);
      return;
    }
    try {
      const params: Record<string, unknown> = { limit: 8 };
      if (q.trim()) params.query = q.trim();
      if (tagId) params.tags = [tagId];
      const r = await window.mtexAPI.search.query(params);
      setResults(r as SearchResult[]);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    }
  }, []);

  // Debounced search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, tagFilter);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tagFilter, doSearch]);

  // Handle click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        onSelectNote(results[selectedIdx].filePath);
        setFocused(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      setQuery('');
    }
  };

  const showDropdown = focused && (results.length > 0 || query.trim());

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm transition-colors
          ${focused
            ? 'border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-900 ring-1 ring-blue-400/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
          }`}
      >
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={tagFilter ? 'Filter notes...' : 'Search notes... ⌘⇧F'}
          className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
        />
        {(query || tagFilter) && (
          <button
            onClick={() => { setQuery(''); doSearch('', null); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim() ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              No results found
            </div>
          ) : (
            results.map((result, idx) => (
              <button
                key={result.id}
                onClick={() => {
                  onSelectNote(result.filePath);
                  setFocused(false);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0
                  ${idx === selectedIdx
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-1 rounded
                    ${result.format === 'md'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    }`}
                  >
                    {result.format === 'md' ? 'MD' : 'TEX'}
                  </span>
                  <span
                    className="text-sm text-gray-700 dark:text-gray-200 truncate"
                    dangerouslySetInnerHTML={{ __html: result.titleHighlight || result.title || result.filePath }}
                  />
                </div>
                {result.snippet && (
                  <p
                    className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate ml-10"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
                {result.tags && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-10">
                    🏷️ {result.tags}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
