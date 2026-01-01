import { Component, ErrorInfo, ReactNode } from 'react';
import { reportComponentError } from '../lib/errorReporter';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional callback to navigate back to a safe screen instead of refreshing */
  onReset?: () => void;
  /** Name of the screen for better error messages */
  screenName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console for debugging (dev only)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    this.setState({ errorInfo });

    // Report error to backend for admin diagnostics
    reportComponentError(error, errorInfo.componentStack, this.props.screenName);
  }

  handleRetry = (): void => {
    // Reset state and attempt to re-render children
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // If an onReset callback is provided, use it instead of refreshing
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      // Force a page refresh to ensure clean state
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-4">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700 rounded-xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-100 mb-3">
              {this.props.screenName
                ? `Error in ${this.props.screenName}`
                : 'Something went wrong'}
            </h2>

            <p className="text-slate-400 mb-6">
              An unexpected error occurred. We apologize for the inconvenience.
              {this.props.onReset
                ? ' Click below to return to a safe screen.'
                : ' Please try refreshing the page.'}
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 text-left">
                <details className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                    Error Details
                  </summary>
                  <pre className="mt-3 text-xs text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            <button
              onClick={this.handleRetry}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              {this.props.onReset ? 'Go to Dashboard' : 'Refresh Page'}
            </button>

            <p className="mt-4 text-xs text-slate-500">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
