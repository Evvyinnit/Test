import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('UI error boundary:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
          <div className="max-w-lg w-full bg-[#12121a] border border-white/10 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
              <span className="material-icons-outlined text-rose-400 text-2xl">error_outline</span>
            </div>
            <h1 className="text-lg font-semibold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-4">
              The interface encountered an unexpected error. Reloading will usually fix it.
            </p>
            <button onClick={this.handleReload} className="btn-primary text-sm px-4">
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
