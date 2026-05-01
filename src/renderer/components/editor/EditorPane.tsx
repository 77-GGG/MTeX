import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLineGutter,
  crosshairCursor,
  rectangularSelection,
} from '@codemirror/view';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  bracketMatching,
  foldGutter,
  indentOnInput,
  StreamLanguage,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, SearchCursor } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';
import { useDebounce } from '../../hooks/useDebounce';

interface EditorPaneProps {
  workspaceRoot: string;
  activeNote: string | null;
  onContentChange?: (content: string) => void;
  searchHighlight?: string;
}

const baseExtensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  crosshairCursor(),
  rectangularSelection(),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
];

function createState(doc: string, format: 'md' | 'tex', dark: boolean): EditorState {
  const formatExt = format === 'md'
    ? markdown({ codeLanguages: languages })
    : StreamLanguage.define(stex);

  return EditorState.create({
    doc,
    extensions: [
      ...baseExtensions,
      formatExt,
      ...(dark ? [oneDark] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const saveHandler = (update.view as EditorView & { _save?: () => void })._save;
          saveHandler?.();
        }
      }),
    ],
  });
}

export default function EditorPane({ workspaceRoot, activeNote, onContentChange, searchHighlight }: EditorPaneProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const currentFilePathRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'md' | 'tex'>('md');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [dark, setDark] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [noteTags, setNoteTags] = useState<Array<{ id: number; name: string; color: string | null }>>([]);
  const [allTags, setAllTags] = useState<Array<{ id: number; name: string; color: string | null }>>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  const getFormat = (path: string): 'md' | 'tex' =>
    path.endsWith('.tex') ? 'tex' : 'md';

  const doSave = useCallback(async (filePath: string, content: string) => {
    setSaveStatus('saving');
    try {
      await window.mtexAPI.note.write(filePath, content);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, []);

  const debouncedSave = useDebounce((filePath: string, content: string) => {
    doSave(filePath, content);
  }, 2000);

  const debouncedPreview = useDebounce((content: string) => {
    onContentChange?.(content);
  }, 300);

  const save = useCallback(() => {
    const view = editorViewRef.current;
    const filePath = currentFilePathRef.current;
    if (!view || !filePath) return;
    const content = view.state.doc.toString();
    debouncedSave(filePath, content);
    debouncedPreview(content);
    setSaveStatus('unsaved');
  }, [debouncedSave, debouncedPreview]);

  // Listen for dark mode preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load note content when activeNote changes
  useEffect(() => {
    if (!activeNote) {
      setTitle('');
      return;
    }

    const loadNote = async () => {
      isLoadingRef.current = true;
      try {
        const note = await window.mtexAPI.note.read(activeNote);
        const fmt = getFormat(activeNote);
        setFormat(fmt);
        setTitle(activeNote);
        onContentChange?.(note.content);

        // Load bookmark status & tags
        window.mtexAPI.bookmarks.isBookmarked(activeNote).then(setIsBookmarked);
        window.mtexAPI.tags.getForNote(activeNote).then((t) => setNoteTags(t as Array<{ id: number; name: string; color: string | null }>));
        window.mtexAPI.tags.list().then((t) => setAllTags(t as Array<{ id: number; name: string; color: string | null }>));

        if (editorViewRef.current) {
          editorViewRef.current.destroy();
        }

        if (editorContainerRef.current) {
          const state = createState(note.content, fmt, dark);
          const view = new EditorView({
            state,
            parent: editorContainerRef.current,
          });
          (view as EditorView & { _save?: () => void })._save = save;
          editorViewRef.current = view;
          currentFilePathRef.current = activeNote;
          applyHighlight(view, searchHighlight);
        }
      } catch {
        setTitle('');
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadNote();
  }, [activeNote, dark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recreate editor when dark mode changes
  useEffect(() => {
    const filePath = currentFilePathRef.current;
    const view = editorViewRef.current;
    if (!filePath || !view) return;

    const content = view.state.doc.toString();
    view.destroy();

    if (editorContainerRef.current) {
      const state = createState(content, format, dark);
      const newView = new EditorView({
        state,
        parent: editorContainerRef.current,
      });
      (newView as EditorView & { _save?: () => void })._save = save;
      editorViewRef.current = newView;
    }
  }, [dark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle external file changes
  useEffect(() => {
    const unsub = window.mtexAPI.on('file:changed', (data: unknown) => {
      const { filePath } = data as { filePath: string };
      if (filePath !== currentFilePathRef.current) return;
      if (isLoadingRef.current) return;

      // Reload the file content
      window.mtexAPI.note.read(filePath).then((note) => {
        const view = editorViewRef.current;
        if (!view) return;
        const currentContent = view.state.doc.toString();
        if (note.content === currentContent) return;

        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: note.content,
          },
        });
      });
    });

    return unsub;
  }, []);

  function applyHighlight(view: EditorView, query?: string) {
    if (!query) return;
    const cursor = new SearchCursor(view.state.doc, query);
    const result = cursor.next();
    if (result.done) return;

    const { from, to } = result.value;
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
    });

    setTimeout(() => {
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({ selection: { anchor: from } });
      }
    }, 4000);
  }

  // Search term temporary highlight
  useEffect(() => {
    if (!searchHighlight || !editorViewRef.current) return;
    applyHighlight(editorViewRef.current, searchHighlight);
  }, [searchHighlight]);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, []);

  if (!activeNote) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center space-y-3">
          <div className="text-6xl text-gray-300 dark:text-gray-700 select-none">
            <svg className="w-20 h-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Select a note from the sidebar or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Editor Toolbar */}
      <div className="h-10 flex items-center px-4 border-b border-gray-200 dark:border-gray-700 gap-2 shrink-0">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0
            ${format === 'md'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            }`}
          >
            {format === 'md' ? 'MD' : 'TEX'}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{title}</span>

          {/* Tag chips */}
          {noteTags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"
              style={{ backgroundColor: (tag.color || '#9ca3af') + '20', color: tag.color || '#6b7280' }}
            >
              {tag.name}
              <button
                onClick={async () => {
                  await window.mtexAPI.tags.detach(activeNote, tag.id);
                  const updated = await window.mtexAPI.tags.getForNote(activeNote);
                  setNoteTags(updated as Array<{ id: number; name: string; color: string | null }>);
                }}
                className="no-drag text-xs hover:text-red-500 cursor-pointer leading-none"
              >
                ×
              </button>
            </span>
          ))}

          {/* Add tag button */}
          <div className="relative no-drag">
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer shrink-0"
            >
              + tag
            </button>
            {showTagPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-40 overflow-y-auto min-w-[120px]">
                {allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id)).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={async () => {
                      await window.mtexAPI.tags.attach(activeNote, tag.id);
                      const updated = await window.mtexAPI.tags.getForNote(activeNote);
                      setNoteTags(updated as Array<{ id: number; name: string; color: string | null }>);
                      setShowTagPicker(false);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || '#9ca3af' }}
                    />
                    {tag.name}
                  </button>
                ))}
                {allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id)).length === 0 && (
                  <p className="px-3 py-1 text-xs text-gray-400">No more tags available</p>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={async () => {
            const result = await window.mtexAPI.bookmarks.toggle(activeNote);
            setIsBookmarked(result);
          }}
          className={`no-drag text-sm cursor-pointer transition-colors shrink-0 ${
            isBookmarked ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
        <span className={`text-xs shrink-0 ${
          saveStatus === 'saved' ? 'text-green-500' :
          saveStatus === 'saving' ? 'text-yellow-500' :
          'text-red-400'
        }`}>
          {saveStatus === 'saved' ? 'Saved' :
           saveStatus === 'saving' ? 'Saving...' :
           'Unsaved'}
        </span>
      </div>

      {/* CodeMirror Editor */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-hidden"
      />
    </div>
  );
}
