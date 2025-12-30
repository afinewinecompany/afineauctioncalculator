import { useState } from 'react';
import { DollarSign, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

/**
 * RFC 5322 compliant email validation regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Helper to get properly formatted API URL
function getApiUrl(): string {
  let url = import.meta.env.VITE_API_URL || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

interface ForgotPasswordPageProps {
  onBack: () => void;
  onBackToLogin: () => void;
}

export function ForgotPasswordPage({ onBack, onBackToLogin }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          setError('Too many requests. Please wait a few minutes before trying again.');
          return;
        }
        // Handle validation errors
        if (data.details && data.details.length > 0) {
          setError(data.details[0].message);
          return;
        }
        setError(data.message || 'An error occurred. Please try again.');
        return;
      }

      // Success - show confirmation message
      setIsSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Unable to connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8 animate-fadeIn">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl text-white mb-2">Check Your Email</h1>
            <p className="text-slate-400">We've sent password reset instructions</p>
          </div>

          {/* Success Message */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm animate-slideInLeft">
            <div className="text-center">
              <p className="text-slate-300 mb-6">
                If an account exists for <span className="text-white font-semibold">{email}</span>,
                you will receive an email with instructions to reset your password.
              </p>
              <p className="text-slate-400 text-sm mb-6">
                Didn't receive the email? Check your spam folder or try again with a different email address.
              </p>

              <div className="space-y-3">
                <button
                  onClick={onBackToLogin}
                  className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
                >
                  Back to Login
                </button>

                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail('');
                  }}
                  className="w-full px-4 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-all border border-slate-700"
                >
                  Try Another Email
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="mt-4 w-full px-4 py-2 text-slate-400 hover:text-white transition-colors text-center flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Request form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/50">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl text-white mb-2">Forgot Password?</h1>
          <p className="text-slate-400">Enter your email to reset your password</p>
        </div>

        {/* Form */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm animate-slideInLeft">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder="Enter your email"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-center text-slate-400 text-sm">
              Remember your password?{' '}
              <button
                onClick={onBackToLogin}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Back to Login
              </button>
            </p>
          </div>
        </div>

        <button
          onClick={onBack}
          className="mt-4 w-full px-4 py-2 text-slate-400 hover:text-white transition-colors text-center flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
