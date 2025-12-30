import { useEffect, useState } from 'react';
import { handleGoogleCallback } from '../lib/authApi';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface GoogleCallbackHandlerProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function GoogleCallbackHandler({ onSuccess, onError }: GoogleCallbackHandlerProps) {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        // Get the code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Google login was cancelled or failed: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Google');
        }

        // Exchange code for tokens
        await handleGoogleCallback(code);

        // Refresh auth context with new user
        await refreshUser();

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname.replace('/auth/google/callback', '/'));

        setStatus('success');

        // Short delay to show success message
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } catch (err) {
        console.error('Google OAuth callback failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to complete Google login';
        setErrorMessage(message);
        setStatus('error');

        // Clean up URL on error too
        window.history.replaceState({}, document.title, '/');

        setTimeout(() => {
          onError(message);
        }, 3000);
      }
    }

    processCallback();
  }, [onSuccess, onError, refreshUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center max-w-md">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl text-white mb-2">Completing Sign In...</h2>
            <p className="text-slate-400">Please wait while we finish setting up your account.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl text-white mb-2">Sign In Successful!</h2>
            <p className="text-slate-400">Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl text-white mb-2">Sign In Failed</h2>
            <p className="text-red-300 mb-4">{errorMessage}</p>
            <p className="text-slate-400 text-sm">Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  );
}
