import { useState, useEffect } from 'react';

interface Template {
  name: string;
  filename: string;
  source: 'builtin' | 'user';
}

interface TemplatePickerProps {
  open: boolean;
  format: 'md' | 'tex';
  currentContent?: string;
  onSelect: (content: string | null) => void;
  onClose: () => void;
}

export default function TemplatePicker({ open, format, currentContent, onSelect, onClose }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (open) {
      window.mtexAPI.templates.list(format).then((t) => setTemplates(t as Template[]));
      setPreview(null);
      setPreviewTpl(null);
      setShowSave(false);
      setMsg('');
    }
  }, [open, format]);

  const handlePreview = async (tpl: Template) => {
    const content = await window.mtexAPI.templates.read(format, tpl.filename, tpl.source);
    setPreview(content);
    setPreviewTpl(tpl);
  };

  const handleDoubleClick = async (tpl: Template) => {
    const content = await window.mtexAPI.templates.read(format, tpl.filename, tpl.source);
    onSelect(content);
  };

  const handleDelete = async (tpl: Template) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    const ok = await window.mtexAPI.templates.deleteUser(format, tpl.filename);
    if (ok) {
      setTemplates((prev) => prev.filter((t) => t.filename !== tpl.filename));
      if (previewTpl?.filename === tpl.filename) { setPreview(null); setPreviewTpl(null); }
    }
  };

  const handleSave = async () => {
    if (!saveName.trim() || !currentContent) return;
    const ext = format === 'md' ? '.md' : '.tex';
    const filename = saveName.trim() + ext;
    const ok = await window.mtexAPI.templates.saveUser(format, saveName.trim(), currentContent);
    if (ok) {
      setMsg('Template saved!');
      setShowSave(false);
      setSaveName('');
      // Refresh list
      window.mtexAPI.templates.list(format).then((t) => setTemplates(t as Template[]));
    } else {
      setMsg('Failed to save');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {format === 'md' ? '📝' : '📜'} New {format === 'md' ? 'Markdown' : 'LaTeX'} Note
          </h2>
          <div className="flex items-center gap-2">
            {currentContent && (
              <button
                onClick={() => setShowSave(!showSave)}
                className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-pointer transition-colors"
              >
                💾 Save Current as Template
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer leading-none">×</button>
          </div>
        </div>

        {/* Save form */}
        {showSave && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Template name..."
              className="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:border-blue-400"
              autoFocus
            />
            <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white cursor-pointer transition-colors">Save</button>
            <button onClick={() => setShowSave(false)} className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700 cursor-pointer">Cancel</button>
            {msg && <span className="text-xs text-green-600 dark:text-green-400">{msg}</span>}
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* Template list */}
          <div className="w-52 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-2 space-y-1 shrink-0">
            {templates.map((tpl) => (
              <div key={tpl.filename + tpl.source} className="flex items-center gap-1 group">
                <button
                  onClick={() => handlePreview(tpl)}
                  onDoubleClick={() => handleDoubleClick(tpl)}
                  className={`flex-1 text-left px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    previewTpl?.filename === tpl.filename
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs shrink-0">{tpl.source === 'builtin' ? '📦' : '👤'}</span>
                    <span className="truncate">{tpl.name}</span>
                  </span>
                </button>
                {tpl.source === 'user' && (
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="text-xs text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-1"
                    title="Delete"
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {preview ? (
              <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                {preview}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                <div className="text-center space-y-2">
                  <p>Click a template to preview</p>
                  <p className="text-xs">📦 = Built-in &nbsp; 👤 = Your template</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            Double-click to select · {currentContent ? '💾 Save current as template' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onSelect(null)}
              className="px-4 py-1.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer transition-colors"
            >
              Skip (Blank)
            </button>
            <button
              onClick={async () => {
                if (previewTpl) {
                  const content = await window.mtexAPI.templates.read(format, previewTpl.filename, previewTpl.source);
                  onSelect(content);
                }
              }}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
              disabled={!previewTpl}
            >
              Use "{previewTpl?.name || '...'}"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
