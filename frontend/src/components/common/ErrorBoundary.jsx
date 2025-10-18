import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report error to monitoring service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error reporting service
    this.reportError(error, errorInfo);
  }

  reportError = async (error, errorInfo) => {
    try {
      // In production, send to error reporting service
      if (import.meta.env.PROD) {
        // Example: Sentry error reporting
        // const eventId = Sentry.captureException(error, {
        //   contexts: {
        //     react: {
        //       componentStack: errorInfo.componentStack,
        //     },
        //   },
        // });
        // this.setState({ eventId });
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleTryAgain = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Oops! Something went wrong
              </h1>

              {/* Error Description */}
              <p className="text-gray-600 mb-6">
                We're sorry, but something unexpected happened. Our team has been notified and we're working to fix the issue.
              </p>

              {/* Error ID */}
              {this.state.eventId && (
                <div className="bg-gray-100 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    Error ID: <code className="font-mono text-gray-800">{this.state.eventId}</code>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Please include this ID when reporting the issue.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                <button
                  onClick={this.handleTryAgain}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
              </div>

              {/* Help Links */}
              <div className="border-t pt-6">
                <p className="text-sm text-gray-500 mb-3">
                  Need help? Contact our support team:
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
                  <a
                    href="mailto:support@polymarket-fhevm.com"
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    support@polymarket-fhevm.com
                  </a>
                  <a
                    href="https://discord.gg/polymarket-fhevm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Discord Support
                  </a>
                  <a
                    href="https://github.com/polymarket-fhevm/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Bug className="w-4 h-4" />
                    Report Bug
                  </a>
                </div>
              </div>

              {/* Development Error Details */}
              {isDevelopment && error && (
                <details className="mt-8 text-left">
                  <summary className="cursor-pointer text-gray-700 font-medium mb-4 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Developer Information
                  </summary>
                  
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto">
                    <div className="mb-4">
                      <h3 className="text-red-400 font-semibold mb-2">Error:</h3>
                      <pre className="text-sm whitespace-pre-wrap">
                        {error.toString()}
                      </pre>
                    </div>
                    
                    {error.stack && (
                      <div className="mb-4">
                        <h3 className="text-red-400 font-semibold mb-2">Stack Trace:</h3>
                        <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    
                    {errorInfo && errorInfo.componentStack && (
                      <div>
                        <h3 className="text-red-400 font-semibold mb-2">Component Stack:</h3>
                        <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for functional components
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WithErrorBoundaryComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WithErrorBoundaryComponent;
};

// Hook for error reporting
export const useErrorHandler = () => {
  const reportError = React.useCallback((error, errorInfo = {}) => {
    console.error('Manual error report:', error, errorInfo);
    
    // Report to error service
    if (import.meta.env.PROD) {
      // Send to error reporting service
      try {
        // Example error reporting
        fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: error.toString(),
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            ...errorInfo,
          }),
        }).catch(reportingError => {
          console.error('Failed to report error:', reportingError);
        });
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }, []);

  return { reportError };
};

export default ErrorBoundary;