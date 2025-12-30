import { useState, useEffect } from 'react';
import { DollarSign, Lock, Loader2, AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';

// Helper to get properly formatted API URL
function getApiUrl(): string {
  let url = import.meta.env.VITE_API_URL || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

// Password validation rules
const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
};

interface ResetPasswordPageProps {
  token: string;
  onBack: () => void;
  onBackToLogin: () => void;
}

export function ResetPasswordPage({ token, onBack, onBackToLogin }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    number: false,
  });

  // Validate password strength in real-time
  useEffect(() => {
    setPasswordStrength({
      length: password.length >= PASSWORD_RULES.minLength,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
    });
  }, [password]);

  const isPasswordValid = passwordStrength.length && passwordStrength.uppercase && passwordStrength.number;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet the requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (data.details && data.details.length > 0) {
          setError(data.details[0].message);
          return;
        }
        // Handle token errors
        if (data.code === 'INVALID_RESET_TOKEN') {
          setError('This password reset link is invalid or has expired. Please request a new one.');
          return;
        }
        setError(data.message || 'An error occurred. Please try again.');
        return;
      }

      // Success
      setIsSuccess(true);
    } catch (err) {
      console.error('Reset password error:', err);
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
            <h1 className="text-3xl text-white mb-2">Password Reset!</h1>
            <p className="text-slate-400">Your password has been successfully changed</p>
          </div>

          {/* Success Message */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm animate-slideInLeft">
            <div className="text-center">
              <p className="text-slate-300 mb-6">
                You can now log in with your new password. Your account is secure.
              </p>

              <button
                onClick={onBackToLogin}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
              >
                Go to Login
              </button>
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

  // No token provided
  if (!token) {
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
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl text-white mb-2">Invalid Link</h1>
            <p className="text-slate-400">This password reset link is invalid</p>
          </div>

          {/* Error Message */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm animate-slideInLeft">
            <div className="text-center">
              <p className="text-slate-300 mb-6">
                The password reset link you clicked is invalid or has expired.
                Please request a new password reset.
              </p>

              <button
                onClick={onBackToLogin}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
              >
                Back to Login
              </button>
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

  // Reset form
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
          <h1 className="text-3xl text-white mb-2">Reset Password</h1>
          <p className="text-slate-400">Enter your new password</p>
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
                <Lock className="w-4 h-4 inline mr-2" />
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Enter new password"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Indicators */}
              <div className="mt-2 space-y-1">
                <div className={`flex items-center gap-2 text-xs ${passwordStrength.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className={`w-3 h-3 ${passwordStrength.length ? 'opacity-100' : 'opacity-40'}`} />
                  At least 8 characters
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordStrength.uppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className={`w-3 h-3 ${passwordStrength.uppercase ? 'opacity-100' : 'opacity-40'}`} />
                  At least 1 uppercase letter
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordStrength.number ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className={`w-3 h-3 ${passwordStrength.number ? 'opacity-100' : 'opacity-40'}`} />
                  At least 1 number
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
              {confirmPassword && password === confirmPassword && password.length > 0 && (
                <p className="mt-1 text-xs text-emerald-400">Passwords match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid || password !== confirmPassword}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
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
