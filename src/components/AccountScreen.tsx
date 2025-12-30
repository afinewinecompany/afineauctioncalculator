import { useState } from 'react';
import { UserData, SubscriptionInfo } from '../lib/types';
import { User, Mail, Lock, CreditCard, CheckCircle, Crown, ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface AccountScreenProps {
  userData: UserData;
  onUpdateUser: (updatedUser: UserData) => void;
  onBack: () => void;
}

export function AccountScreen({ userData, onUpdateUser, onBack }: AccountScreenProps) {
  const [email, setEmail] = useState(userData.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isGoogleUser = userData.authProvider === 'google';
  const subscription = userData.subscription || { tier: 'free', status: 'active' } as SubscriptionInfo;

  const handleEmailUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    onUpdateUser({
      ...userData,
      email
    });
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 3000);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // In a real app, this would verify the current password and update via API
    // For now, we'll just show success
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 3000);
  };

  const handleUpgradeClick = () => {
    // In a real app, this would redirect to Stripe checkout
    // For demo purposes, we'll simulate an upgrade
    const updatedSubscription: SubscriptionInfo = {
      tier: 'premium',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      cancelAtPeriodEnd: false
    };

    onUpdateUser({
      ...userData,
      subscription: updatedSubscription
    });
  };

  const handleCancelSubscription = () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your current billing period.')) {
      return;
    }

    onUpdateUser({
      ...userData,
      subscription: {
        ...subscription,
        cancelAtPeriodEnd: true
      }
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-fadeIn">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            {userData.profilePicture ? (
              <img
                src={userData.profilePicture}
                alt={userData.username}
                className="w-16 h-16 rounded-full border-2 border-red-500 shadow-lg shadow-red-500/30"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl text-white">Account Settings</h1>
              <p className="text-slate-400">{userData.username}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Account Information Section */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl text-white">Email Address</h2>
            </div>

            <form onSubmit={handleEmailUpdate} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                />
              </div>

              {emailError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {emailError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30"
                >
                  Update Email
                </button>
                {emailSaved && (
                  <span className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Email updated successfully
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Password Section - Only show for email users */}
          {!isGoogleUser && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl text-white">Change Password</h2>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all pr-12"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all pr-12"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30"
                  >
                    Update Password
                  </button>
                  {passwordSaved && (
                    <span className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Password updated successfully
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Google User Notice */}
          {isGoogleUser && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl text-white">Password</h2>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <p className="text-blue-300 text-sm">
                  You signed in with Google. Password management is handled through your Google account.
                </p>
              </div>
            </div>
          )}

          {/* Subscription Section */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl text-white">Subscription</h2>
            </div>

            {/* Current Plan */}
            <div className="mb-6">
              <div className={`p-6 rounded-xl border-2 ${
                subscription.tier === 'premium'
                  ? 'bg-gradient-to-br from-amber-900/30 to-amber-950/30 border-amber-500/50'
                  : 'bg-slate-900 border-slate-700'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {subscription.tier === 'premium' ? (
                      <Crown className="w-8 h-8 text-amber-400" />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                    <div>
                      <h3 className={`text-xl font-semibold ${subscription.tier === 'premium' ? 'text-amber-400' : 'text-white'}`}>
                        {subscription.tier === 'premium' ? 'Premium' : 'Free'} Plan
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {subscription.tier === 'premium'
                          ? '$10/month'
                          : 'Basic features'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    subscription.status === 'active' && !subscription.cancelAtPeriodEnd
                      ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                      : subscription.cancelAtPeriodEnd
                        ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                        : 'bg-red-900/30 text-red-400 border border-red-500/30'
                  }`}>
                    {subscription.cancelAtPeriodEnd
                      ? 'Cancels at period end'
                      : subscription.status === 'active'
                        ? 'Active'
                        : subscription.status === 'past_due'
                          ? 'Past Due'
                          : 'Cancelled'}
                  </span>
                </div>

                {subscription.tier === 'premium' && subscription.currentPeriodEnd && (
                  <p className="text-slate-400 text-sm">
                    {subscription.cancelAtPeriodEnd
                      ? `Access until ${formatDate(subscription.currentPeriodEnd)}`
                      : `Next billing date: ${formatDate(subscription.currentPeriodEnd)}`}
                  </p>
                )}

                {subscription.tier === 'premium' && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-white mb-2">Premium Features:</h4>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Unlimited leagues
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Advanced analytics & insights
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Live auction sync (Couch Managers)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Dynasty rankings integration
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Priority support
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade/Manage Buttons */}
            {subscription.tier === 'free' ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-amber-900/20 to-amber-950/20 border border-amber-500/30 rounded-lg">
                  <h4 className="text-amber-400 font-semibold mb-2">Upgrade to Premium</h4>
                  <p className="text-slate-300 text-sm mb-4">
                    Get access to advanced features, unlimited leagues, and live auction sync for just $10/month.
                  </p>
                  <button
                    onClick={handleUpgradeClick}
                    className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
                  >
                    <Crown className="w-5 h-5" />
                    Upgrade to Premium - $10/month
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                {!subscription.cancelAtPeriodEnd && (
                  <button
                    onClick={handleCancelSubscription}
                    className="px-6 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                  >
                    Cancel Subscription
                  </button>
                )}
                <button
                  onClick={() => {
                    // In a real app, redirect to Stripe customer portal
                    alert('This would open the billing portal to manage payment methods.');
                  }}
                  className="px-6 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Manage Billing
                </button>
              </div>
            )}
          </div>

          {/* Demo Notice */}
          <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
            <p className="text-blue-300 text-sm">
              <strong>Demo Mode:</strong> Account changes are stored locally in your browser.
              In production, this would connect to a real authentication and payment system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
