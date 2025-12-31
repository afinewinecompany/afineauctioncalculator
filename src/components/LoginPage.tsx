import { useState } from 'react';
import { DollarSign, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * RFC 5322 compliant email validation regex
 * Validates: local-part@domain format with proper character restrictions
 * - Local part: allows letters, numbers, and special chars (._%+-)
 * - Domain: requires at least one dot with valid TLD (2+ chars)
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

// Retro color palette matching landing page
const colors = {
  bg: '#0d0d0d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  fuchsia500: '#d946ef',
  purple600: '#9333ea',
};

interface LoginPageProps {
  onBack: () => void;
  onSuccess: () => void;
  onForgotPassword: () => void;
}

export function LoginPage({ onBack, onSuccess, onForgotPassword }: LoginPageProps) {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // Validation
    if (!email || !password) {
      setLocalError('Please fill in all required fields');
      return;
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (isSignUp) {
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    }

    try {
      if (isSignUp) {
        await register(email, password, name || undefined);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);

    // DEV MODE: Bypass authentication and go straight to dashboard
    if (import.meta.env.DEV) {
      console.log('[DEV] Bypassing Google OAuth - auto-login as dev user');
      // Store a mock token so isAuthenticated() returns true
      localStorage.setItem('auth_token', 'dev-mock-token');
      localStorage.setItem('refresh_token', 'dev-mock-refresh');
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 300));
      setIsGoogleLoading(false);
      onSuccess();
      return;
    }

    try {
      const apiUrl = getApiUrl();

      // First check if Google OAuth is configured on the backend
      const checkResponse = await fetch(`${apiUrl}/api/auth/google/status`);

      if (!checkResponse.ok) {
        // If status endpoint doesn't exist or returns error, try the OAuth directly
        // but handle common errors gracefully
        if (checkResponse.status === 404) {
          // Endpoint doesn't exist, proceed with OAuth (older backend version)
          window.location.href = `${apiUrl}/api/auth/google`;
          return;
        }
        throw new Error('Unable to connect to authentication server');
      }

      const statusData = await checkResponse.json();

      if (!statusData.configured) {
        setLocalError('Google sign-in is not yet available. Please use email/password to create an account.');
        setIsGoogleLoading(false);
        return;
      }

      // Google OAuth is configured, proceed with redirect
      window.location.href = `${apiUrl}/api/auth/google`;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Google OAuth check failed:', err);
      }
      // If the check fails, show a user-friendly error
      setLocalError('Google sign-in is temporarily unavailable. Please use email/password instead.');
      setIsGoogleLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '40px',
            width: '400px',
            height: '400px',
            background: `linear-gradient(135deg, ${colors.amber500}20, ${colors.orange600}15, transparent)`,
            borderRadius: '50%',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '160px',
            right: '40px',
            width: '350px',
            height: '350px',
            background: `linear-gradient(225deg, ${colors.fuchsia500}15, ${colors.purple600}10, transparent)`,
            borderRadius: '50%',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '30%',
            width: '300px',
            height: '300px',
            background: `linear-gradient(45deg, ${colors.rose500}15, transparent)`,
            borderRadius: '50%',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '448px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }} className="animate-fadeIn">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <div
              style={{
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500}, ${colors.rose500})`,
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 20px 40px ${colors.orange500}40`,
                }}
              >
                <DollarSign style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, ${colors.amber400}, ${colors.orange500}, ${colors.rose500})`,
                  borderRadius: '16px',
                  filter: 'blur(20px)',
                  opacity: 0.5,
                }}
              />
            </div>
          </div>
          <h1 style={{ fontSize: '1.875rem', color: 'white', marginBottom: '8px', fontWeight: 700 }}>
            A Fine Auction Calculator
          </h1>
          <a
            href="https://x.com/afinewineco"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.amber400}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
          >
            by Dylan Merlo
          </a>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '16px' }}>Sign in to manage your drafts</p>
        </div>

        {/* Login Form */}
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '32px',
          }}
          className="animate-slideInLeft"
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              onClick={() => { setIsSignUp(false); clearError(); setLocalError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.3s',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                ...(
                  !isSignUp
                    ? {
                        background: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500}, ${colors.rose500})`,
                        color: 'white',
                        boxShadow: `0 10px 25px ${colors.orange500}40`,
                      }
                    : {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }
                ),
              }}
            >
              Login
            </button>
            <button
              onClick={() => { setIsSignUp(true); clearError(); setLocalError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.3s',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                ...(
                  isSignUp
                    ? {
                        background: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500}, ${colors.rose500})`,
                        color: 'white',
                        boxShadow: `0 10px 25px ${colors.orange500}40`,
                      }
                    : {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }
                ),
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Error Display */}
          {displayError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${colors.rose500}50`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: colors.rose400,
              }}
            >
              <AlertCircle style={{ width: '20px', height: '20px', flexShrink: 0 }} />
              <span style={{ fontSize: '14px' }}>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isSignUp && (
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  <User style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s',
                  }}
                  placeholder="Enter your name"
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = colors.orange500}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                <Mail style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s',
                }}
                placeholder="Enter your email"
                required
                disabled={isLoading}
                onFocus={(e) => e.target.style.borderColor = colors.orange500}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                <Lock style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s',
                }}
                placeholder={isSignUp ? 'Create a password (min 8 chars)' : 'Enter your password'}
                required
                disabled={isLoading}
                onFocus={(e) => e.target.style.borderColor = colors.orange500}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              {!isSignUp && (
                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.orange400,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'color 0.3s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = colors.amber400}
                    onMouseLeave={(e) => e.currentTarget.style.color = colors.orange400}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {isSignUp && (
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  <Lock style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s',
                  }}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                  onFocus={(e) => e.target.style.borderColor = colors.orange500}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: `linear-gradient(90deg, ${colors.amber500}, ${colors.orange500}, ${colors.rose500})`,
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: `0 15px 35px ${colors.orange500}40`,
                opacity: isLoading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.3s',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 style={{ width: '20px', height: '20px' }} className="animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ position: 'relative', margin: '24px 0' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', fontSize: '14px' }}>
              <span style={{ padding: '0 16px', backgroundColor: colors.bg, color: 'rgba(255,255,255,0.4)' }}>Or continue with</span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'white',
              color: '#1f2937',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 500,
              fontSize: '16px',
              cursor: isLoading || isGoogleLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              opacity: isLoading || isGoogleLoading ? 0.7 : 1,
              transition: 'all 0.3s',
            }}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 style={{ width: '20px', height: '20px', color: '#4b5563' }} className="animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => { setIsSignUp(!isSignUp); clearError(); setLocalError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.orange400,
                  cursor: 'pointer',
                  transition: 'color 0.3s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.amber400}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.orange400}
              >
                {isSignUp ? 'Login' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>

        <button
          onClick={onBack}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'color 0.3s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
