import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    try {
      fetch('/api/admin/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: error.message, stack: String(errorInfo.componentStack || '').substring(0, 500) }),
      });
    } catch (e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 max-w-lg w-full">
            <h1 className="text-xl text-white mb-2">Something went wrong</h1>
            <p className="text-red-400 text-sm mb-4">{this.state.error?.message}</p>
            <pre className="text-gray-400 text-xs overflow-auto max-h-40 mb-4">{String(this.state.error?.stack || '')}</pre>
            <a href="/" className="text-purple-400 hover:text-purple-300">← Go Home</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
