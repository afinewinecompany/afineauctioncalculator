/**
 * Frontend Error Reporter
 * Captures and reports frontend errors to the backend for admin diagnostics
 */

import { getAccessToken } from './authApi';

// Get API base URL from environment variables
function getApiUrl(): string {
  const rawUrl = import.meta.env.VITE_API_URL;
  const isDev = import.meta.env.DEV;

  if (!rawUrl && isDev) {
    return '';
  }

  let url = rawUrl || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_URL = getApiUrl();
const ERRORS_ENDPOINT = `${API_URL}/api/errors`;

// Error queue for batching
let errorQueue: ErrorReport[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

// Configuration
const BATCH_SIZE = 5;
const FLUSH_DELAY_MS = 5000; // Flush every 5 seconds if there are pending errors
const MAX_QUEUE_SIZE = 20; // Don't queue more than 20 errors

interface ErrorReport {
  errorMessage: string;
  errorCode?: string;
  stackTrace?: string;
  source: 'frontend' | 'backend';
  severity: 'error' | 'warning' | 'info';
  context?: {
    component?: string;
    action?: string;
    url?: string;
    userAgent?: string;
    screenSize?: string;
    timestamp?: string;
    additionalData?: Record<string, unknown>;
  };
}

/**
 * Get browser context for error reports
 */
function getBrowserContext(): Partial<ErrorReport['context']> {
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Report an error to the backend
 * Errors are batched to reduce network requests
 */
export async function reportError(
  error: Error | string,
  context?: {
    component?: string;
    action?: string;
    additionalData?: Record<string, unknown>;
  }
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const stackTrace = error instanceof Error ? error.stack : undefined;

  const report: ErrorReport = {
    errorMessage,
    stackTrace,
    source: 'frontend',
    severity: 'error',
    context: {
      ...getBrowserContext(),
      ...context,
    },
  };

  // Add to queue
  if (errorQueue.length < MAX_QUEUE_SIZE) {
    errorQueue.push(report);
  }

  // Flush immediately if queue is full
  if (errorQueue.length >= BATCH_SIZE) {
    await flushErrors();
  } else if (!flushTimeout) {
    // Schedule a flush
    flushTimeout = setTimeout(() => {
      flushErrors();
    }, FLUSH_DELAY_MS);
  }
}

/**
 * Report a warning (less severe than error)
 */
export async function reportWarning(
  message: string,
  context?: {
    component?: string;
    action?: string;
    additionalData?: Record<string, unknown>;
  }
): Promise<void> {
  const report: ErrorReport = {
    errorMessage: message,
    source: 'frontend',
    severity: 'warning',
    context: {
      ...getBrowserContext(),
      ...context,
    },
  };

  if (errorQueue.length < MAX_QUEUE_SIZE) {
    errorQueue.push(report);
  }

  // Schedule flush for warnings (lower priority)
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushErrors();
    }, FLUSH_DELAY_MS);
  }
}

/**
 * Report a React component error (from ErrorBoundary)
 */
export async function reportComponentError(
  error: Error,
  componentStack: string | null,
  screenName?: string
): Promise<void> {
  const report: ErrorReport = {
    errorMessage: error.message,
    stackTrace: error.stack,
    source: 'frontend',
    severity: 'error',
    context: {
      ...getBrowserContext(),
      component: screenName,
      additionalData: {
        componentStack,
        errorName: error.name,
      },
    },
  };

  // Component errors are more critical - send immediately
  if (errorQueue.length < MAX_QUEUE_SIZE) {
    errorQueue.push(report);
  }

  await flushErrors();
}

/**
 * Report an API error
 */
export async function reportApiError(
  endpoint: string,
  status: number,
  errorMessage: string,
  additionalContext?: Record<string, unknown>
): Promise<void> {
  const report: ErrorReport = {
    errorMessage: `API Error: ${endpoint} - ${status} - ${errorMessage}`,
    errorCode: `API_${status}`,
    source: 'frontend',
    severity: status >= 500 ? 'error' : 'warning',
    context: {
      ...getBrowserContext(),
      action: `API call to ${endpoint}`,
      additionalData: {
        endpoint,
        status,
        ...additionalContext,
      },
    },
  };

  if (errorQueue.length < MAX_QUEUE_SIZE) {
    errorQueue.push(report);
  }

  // 500 errors are critical - send immediately
  if (status >= 500) {
    await flushErrors();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushErrors();
    }, FLUSH_DELAY_MS);
  }
}

/**
 * Flush all queued errors to the backend
 */
async function flushErrors(): Promise<void> {
  // Clear timeout if it exists
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Nothing to flush
  if (errorQueue.length === 0) {
    return;
  }

  // Take current queue and reset
  const errorsToSend = [...errorQueue];
  errorQueue = [];

  try {
    const token = getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available (for user context)
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    if (errorsToSend.length === 1) {
      // Single error - use regular endpoint
      await fetch(ERRORS_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(errorsToSend[0]),
      });
    } else {
      // Multiple errors - use batch endpoint
      await fetch(`${ERRORS_ENDPOINT}/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ errors: errorsToSend }),
      });
    }
  } catch (error) {
    // Don't recursively report errors from the error reporter
    if (import.meta.env.DEV) {
      console.error('[ErrorReporter] Failed to send errors to backend:', error);
    }
  }
}

/**
 * Flush errors immediately (e.g., before page unload)
 */
export function flushErrorsSync(): void {
  if (errorQueue.length === 0) return;

  const errorsToSend = [...errorQueue];
  errorQueue = [];

  // Use sendBeacon for reliability during page unload
  const token = getAccessToken();
  const payload = errorsToSend.length === 1
    ? JSON.stringify(errorsToSend[0])
    : JSON.stringify({ errors: errorsToSend });

  const endpoint = errorsToSend.length === 1
    ? ERRORS_ENDPOINT
    : `${ERRORS_ENDPOINT}/batch`;

  // sendBeacon doesn't support custom headers, so we pass token in query
  const url = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint;

  navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
}

// Flush errors before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushErrorsSync);
}

// Setup global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, {
      action: 'Global error handler',
      additionalData: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    reportError(error, {
      action: 'Unhandled promise rejection',
    });
  });
}
