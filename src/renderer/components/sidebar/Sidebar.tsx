import { useState, useEffect, useMemo, useRef } from 'react';
import FileTree from './FileTree';
import SearchBar from './SearchBar';
import TagList from './TagList';
import TemplatePicker from '../common/TemplatePicker';

interface SidebarProps {
  workspaceRoot: string;
  activeNote: string | null;
  onSelectNote: (path: string) => void;
  editorContent?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  format?: 'md' | 'tex' | 'other';
  children?: FileTreeNode[];
}

export default function Sidebar({ workspaceRoot, activeNote, onSelectNote, editorContent }: SidebarProps) {
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [bookmarkFilter, setBookmarkFilter] = useState(false);
  const [bookmarkedPaths, setBookmarkedPaths] = useState<Set<string>>(new Set());
  const [tagFilteredPaths, setTagFilteredPaths] = useState<Set<string> | null>(null);
  const [templatePicker, setTemplatePicker] = useState<{ open: boolean; format: 'md' | 'tex' }>({ open: false, format: 'md' });
  const pendingCreateDir = useRef('');

  const loadBookmarks = async () => {
    try {
      const bm = await window.mtexAPI.bookmarks.list();
      const paths = new Set((bm as Array<{ file_path: string }>).map((b) => b.file_path));
      setBookmarkedPaths(paths);
    } catch {
      setBookmarkedPaths(new Set());
    }
  };

  const loadFiles = async () => {
    try {
      const tree = await window.mtexAPI.note.list(workspaceRoot);
      setFiles(tree as FileTreeNode[]);
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => {
    loadFiles();
    loadBookmarks();
  }, [workspaceRoot]);

  useEffect(() => {
    loadBookmarks();
  }, [activeNote]);

  // When tag filter changes, fetch matching file paths
  useEffect(() => {
    if (tagFilter) {
      window.mtexAPI.search.query({ tags: [tagFilter], limit: 1000 }).then((results) => {
        const paths = new Set((results as Array<{ filePath: string }>).map((r) => r.filePath));
        setTagFilteredPaths(paths);
      });
    } else {
      setTagFilteredPaths(null);
    }
  }, [tagFilter]);

  // Filter file tree based on active filters
  const filteredFiles = useMemo(() => {
    let activeFilter: Set<string> | null = null;
    if (tagFilteredPaths) activeFilter = tagFilteredPaths;
    if (bookmarkFilter) {
      activeFilter = activeFilter
        ? new Set([...activeFilter].filter((p) => bookmarkedPaths.has(p)))
        : bookmarkedPaths;
    }

    if (!activeFilter) return files;

    return filterTree(files, activeFilter);
  }, [files, tagFilteredPaths, bookmarkFilter, bookmarkedPaths]);

  const handleCreateNote = (format: 'md' | 'tex') => {
    setTemplatePicker({ open: true, format });
  };

  const handleTemplateSelect = async (content: string | null) => {
    setTemplatePicker({ open: false, format: templatePicker.format });
    const format = templatePicker.format;
    const ext = format === 'md' ? '.md' : '.tex';
    const dir = pendingCreateDir.current;
    pendingCreateDir.current = '';

    // Generate unique filename
    const baseName = format === 'md' ? 'Untitled' : 'Untitled';
    let fileName = dir ? `${dir}/${baseName}${ext}` : `${baseName}${ext}`;
    let counter = 1;
    while (files.some((f) => f.path === fileName || f.name === (dir ? fileName.replace(dir + '/', '') : fileName))) {
      fileName = dir ? `${dir}/${baseName} ${counter}${ext}` : `${baseName} ${counter}${ext}`;
      counter++;
    }

    // Create file with template content or blank
    if (content) {
      await window.mtexAPI.note.create(fileName, format);
      await window.mtexAPI.note.write(fileName, content);
    } else {
      await window.mtexAPI.note.create(fileName, format);
    }
    await loadFiles();
    onSelectNote(fileName);
  };

  const handleFilterByTag = (tagId: number) => {
    setBookmarkFilter(false);
    setTagFilter(tagId === tagFilter ? null : tagId);
  };

  const handleClearFilters = () => {
    setTagFilter(null);
    setBookmarkFilter(false);
  };

  const hasFilter = tagFilter || bookmarkFilter;

  return (
    <aside className="w-[260px] min-w-[200px] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
      <div className="drag-region h-12 flex items-center border-b border-gray-200 dark:border-gray-700" style={{ paddingLeft: '80px', paddingRight: '12px' }}>
        {hasFilter && (
          <button
            onClick={handleClearFilters}
            className="no-drag text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full cursor-pointer"
          >
            Filtered ×
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <SearchBar
          workspaceRoot={workspaceRoot}
          onSelectNote={onSelectNote}
          tagFilter={tagFilter}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-1">
            <FileTree
              files={filteredFiles}
              activeNote={activeNote}
              onSelectNote={onSelectNote}
              onRefresh={loadFiles}
              workspaceRoot={workspaceRoot}
              bookmarkedPaths={bookmarkedPaths}
              onCreateWithTemplate={(format, dirPath) => {
                pendingCreateDir.current = dirPath || '';
                setTemplatePicker({ open: true, format });
              }}
            />
          </div>
          <TagList
            onFilterByTag={handleFilterByTag}
            activeTagId={tagFilter}
            onFilterByBookmark={() => { setBookmarkFilter(!bookmarkFilter); setTagFilter(null); }}
            bookmarkActive={bookmarkFilter}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex gap-1">
          <button
            onClick={() => handleCreateNote('md')}
            className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="New Markdown note"
          >
            + .md
          </button>
          <button
            onClick={() => handleCreateNote('tex')}
            className="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="New LaTeX document"
          >
            + .tex
          </button>
        </div>
      </div>

      <TemplatePicker
        open={templatePicker.open}
        format={templatePicker.format}
        currentContent={editorContent}
        onSelect={handleTemplateSelect}
        onClose={() => setTemplatePicker({ open: false, format: templatePicker.format })}
      />
    </aside>
  );
}

function filterTree(nodes: FileTreeNode[], allowedPaths: Set<string>): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      const filteredChildren = filterTree(node.children, allowedPaths);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    } else if (node.type === 'file' && allowedPaths.has(node.path)) {
      result.push(node);
    }
  }
  return result;
}
