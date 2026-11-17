import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unexpected interface error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E5E8EE] p-8 space-y-4">
            <h1 className="font-serif text-2xl font-semibold text-[#0B172A]">Service Notice</h1>
            <p className="text-sm text-[#4A5260]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-xs font-semibold bg-[#0B172A] text-white"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
