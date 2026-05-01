interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
}

export default function WelcomeScreen({ onOpenWorkspace }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md px-8">
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
            onClick={onOpenWorkspace}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
          >
            Open Workspace Folder
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Choose a folder to store your notes. All files are stored locally.
          </p>
        </div>

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
