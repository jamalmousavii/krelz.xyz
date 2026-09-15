import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl text-white mb-4">Something went wrong</h1>
            <a href="/" className="text-purple-400 hover:text-purple-300">← Go Home</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
