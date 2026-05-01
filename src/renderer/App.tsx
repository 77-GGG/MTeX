import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import EditorPane from './components/editor/EditorPane';
import PreviewPane from './components/preview/PreviewPane';
import SearchPanel from './components/search/SearchPanel';
import WelcomeScreen from './components/WelcomeScreen';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState('');

  const handleOpenWorkspace = async () => {
    try {
      const dir = await window.mtexAPI.workspace.openDirectory();
      if (dir) {
        setWorkspaceRoot(dir);
      }
    } catch (err) {
      console.error('Failed to open workspace:', err);
    }
  };

  const handleContentChange = useCallback((content: string) => {
    setEditorContent(content);
  }, []);

  // Cmd+Shift+F to toggle search panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleWikilinkClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.wikilink') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    const notePath = target.getAttribute('data-target');
    if (notePath) {
      setActiveNote(notePath.endsWith('.md') ? notePath : `${notePath}.md`);
    }
  }, []);

  if (!workspaceRoot) {
    return <WelcomeScreen onOpenWorkspace={handleOpenWorkspace} />;
  }

  const format = activeNote?.endsWith('.tex') ? 'tex' : 'md';

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-800">
        {/* Left: Sidebar */}
        <Sidebar
          workspaceRoot={workspaceRoot}
          activeNote={activeNote}
          onSelectNote={setActiveNote}
        />

        {/* Center: Editor */}
        <div className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <EditorPane
            workspaceRoot={workspaceRoot}
            activeNote={activeNote}
            onContentChange={handleContentChange}
            searchHighlight={searchHighlight}
          />
        </div>

        {/* Right: Preview */}
        <div
          className="flex-1 min-w-0 overflow-y-auto"
          onClick={handleWikilinkClick}
        >
          <PreviewPane
            content={editorContent}
            format={format}
            visible={true}
            notePath={activeNote}
          />
        </div>
      </div>

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenNote={(filePath, query) => {
          setActiveNote(filePath);
          setSearchHighlight(query);
        }}
      />
    </ErrorBoundary>
  );
}
