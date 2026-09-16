import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <div className="text-center max-w-lg mx-auto p-6">
            <h1 className="text-xl text-white mb-4">Something went wrong</h1>
            <pre className="text-xs text-red-300 bg-black/30 p-3 rounded-lg mb-4 text-left overflow-auto max-h-40">{this.state.error?.message || 'Unknown error'}</pre>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="text-purple-400 hover:text-purple-300 underline">Try Again</button>
            <br /><a href="/" className="text-gray-400 hover:text-gray-300 text-sm mt-2 inline-block">← Go Home</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
