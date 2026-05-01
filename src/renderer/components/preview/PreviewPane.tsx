import { useState, useEffect, useRef } from 'react';
import MarkdownPreview from './MarkdownPreview';

interface PreviewPaneProps {
  content: string;
  format: 'md' | 'tex';
  visible: boolean;
  notePath?: string | null;
}

export default function PreviewPane({ content, format, visible, notePath }: PreviewPaneProps) {
  const [compiling, setCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState('');
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [texAvailable, setTexAvailable] = useState<boolean | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (format === 'tex') {
      window.mtexAPI.latex.status().then((s) => setTexAvailable(s.available));
    }
  }, [format]);

  // Clear PDF when note changes
  useEffect(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
    setCompileLog('');
    setCompileErrors([]);
  }, [notePath]);

  const handleCompile = async () => {
    if (!notePath) return;
    setCompiling(true);
    setCompileLog('');
    setCompileErrors([]);
    setPdfUrl(null);
    try {
      const result = await window.mtexAPI.latex.compile(notePath);
      if (result.success && (result as { pdfUrl?: string }).pdfUrl) {
        const url = (result as { pdfUrl: string }).pdfUrl;
        pdfUrlRef.current = url;
        setPdfUrl(url);
        setCompileLog(result.log || 'Compilation successful');
      } else {
        setCompileErrors(result.errors || ['Unknown error']);
        setCompileLog(result.log || '');
      }
    } catch (e) {
      setCompileErrors([String(e)]);
    } finally {
      setCompiling(false);
    }
  };

  const handleSavePdf = async () => {
    try {
      if (format === 'tex' && pdfUrlRef.current) {
        // Save from local-pdf:// URL - fetch and download
        const response = await fetch(pdfUrlRef.current);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = (notePath || 'document').replace(/\.\w+$/, '') + '.pdf';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      // For .md: use Electron printToPDF
      const result = await window.mtexAPI.exportPdf.save(content, format);
      if (result.success && result.pdfBase64) {
        const link = document.createElement('a');
        link.download = (notePath || 'document').replace(/\.\w+$/, '') + '.pdf';
        link.href = 'data:application/pdf;base64,' + result.pdfBase64;
        link.click();
      }
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  if (!visible) return null;

  // Toolbar
  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
      {format === 'tex' && (
        <>
          <button
            onClick={handleCompile}
            disabled={compiling}
            className={`text-xs px-3 py-1 rounded-md cursor-pointer font-medium transition-colors ${
              compiling
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {compiling ? '⏳ Compiling...' : '▶ Compile'}
          </button>
          {texAvailable === false && (
            <span className="text-xs text-red-400">TeX not found</span>
          )}
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={handleSavePdf}
        className="text-xs px-3 py-1 rounded-md cursor-pointer font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
      >
        📄 Save PDF
      </button>
    </div>
  );

  if (format === 'tex') {
    // Show TeX preview
    if (!pdfUrl && !compiling && compileErrors.length === 0) {
      return (
        <div className="flex flex-col h-full min-h-0">
          {toolbar}
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 text-sm">
            <div className="text-center space-y-3">
              <div className="text-4xl">📜</div>
              <p>Click <strong>Compile</strong> to build LaTeX document</p>
              {texAvailable === false && (
                <p className="text-xs text-red-400">Install MacTeX: https://tug.org/mactex/</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        {toolbar}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          {/* Compile errors */}
          {compileErrors.length > 0 && (
            <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shrink-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Compilation Errors</p>
              {compileErrors.map((err, i) => (
                <pre key={i} className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{err}</pre>
              ))}
            </div>
          )}

          {/* PDF preview */}
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              className="w-full flex-1 border-0"
              title="PDF Preview"
            />
          )}
        </div>
      </div>
    );
  }

  // Markdown: existing render + toolbar
  return (
    <div className="flex flex-col h-full min-h-0">
      {toolbar}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <MarkdownPreview content={content} />
      </div>
    </div>
  );
}
