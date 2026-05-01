import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-950 p-8">
          <div className="max-w-md text-center">
            <div className="text-4xl mb-4">💥</div>
            <h1 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Render Error</h1>
            <pre className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-lg p-3 text-left overflow-auto max-h-60">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
