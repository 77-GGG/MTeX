import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import EditorPane from './components/editor/EditorPane';
import PreviewPane from './components/preview/PreviewPane';
import SearchPanel from './components/search/SearchPanel';
import CommandPalette from './components/command/CommandPalette';
import WelcomeScreen from './components/WelcomeScreen';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState('');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [darkTheme, setDarkTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleOpenWorkspace = async (recentDir?: string) => {
    try {
      if (recentDir) {
        setWorkspaceRoot(recentDir);
      } else {
        const dir = await window.mtexAPI.workspace.openDirectory();
        if (dir) setWorkspaceRoot(dir);
      }
    } catch (err) {
      console.error('Failed to open workspace:', err);
    }
  };

  const handleContentChange = useCallback((content: string) => {
    setEditorContent(content);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Cmd+Shift+F: search panel
      if (mod && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      // Cmd+P: command palette
      if (mod && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCmdPaletteOpen((v) => !v);
      }
      // Cmd+N handled by native menu
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNewMarkdown = useCallback(async () => {
    let fileName = 'Untitled.md';
    let counter = 1;
    // Simple file creation without checking existing (will be refined)
    await window.mtexAPI.note.create(fileName, 'md');
    setActiveNote(fileName);
  }, []);

  const handleNewLatex = useCallback(async () => {
    let fileName = 'Untitled.tex';
    await window.mtexAPI.note.create(fileName, 'tex');
    setActiveNote(fileName);
  }, []);

  // Native menu events
  useEffect(() => {
    const unsubs = [
      window.mtexAPI.on('menu:openWorkspace', () => handleOpenWorkspace()),
      window.mtexAPI.on('menu:closeWorkspace', () => setWorkspaceRoot(null)),
      window.mtexAPI.on('menu:newMarkdown', handleNewMarkdown),
      window.mtexAPI.on('menu:newLatex', handleNewLatex),
      window.mtexAPI.on('menu:search', () => setSearchOpen(true)),
      window.mtexAPI.on('menu:commandPalette', () => setCmdPaletteOpen(true)),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [handleNewMarkdown, handleNewLatex]);

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
          editorContent={editorContent}
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

      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        workspaceRoot={workspaceRoot}
        activeNote={activeNote}
        onOpenFile={setActiveNote}
        onNewMarkdown={handleNewMarkdown}
        onNewLatex={handleNewLatex}
        onOpenSearch={() => { setSearchOpen(true); }}
        onToggleTheme={() => setDarkTheme((v) => !v)}
      />
    </ErrorBoundary>
  );
}
