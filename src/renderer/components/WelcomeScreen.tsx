import { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  onOpenWorkspace: (dir?: string) => void;
}

export default function WelcomeScreen({ onOpenWorkspace }: WelcomeScreenProps) {
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  useEffect(() => {
    window.mtexAPI.workspace.listRecent().then((paths) => setRecentPaths(paths as string[]));
  }, []);

  const getFolderName = (p: string) => {
    const parts = p.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || p;
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md px-8 w-full">
        <div className="mb-6">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            MTeX
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Markdown & LaTeX Notebook
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            A powerful note-taking app with full <strong>Markdown</strong> and <strong>LaTeX</strong> support,
            fast full-text search, and bidirectional linking.
          </p>

          <button
            onClick={() => onOpenWorkspace()}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
          >
            Open Workspace Folder
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Choose a folder to store your notes. All files are stored locally.
          </p>
        </div>

        {/* Recent workspaces */}
        {recentPaths.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
              Recent Workspaces
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {recentPaths.slice(0, 5).map((p) => (
                <button
                  key={p}
                  onClick={() => onOpenWorkspace(p)}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📂</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white">
                      {getFolderName(p)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 ml-7">
                    {p}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-4 justify-center text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            .md
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
            .tex
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
            FTS Search
          </span>
        </div>
      </div>
    </div>
  );
}
