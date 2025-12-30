import { UserData, SubscriptionInfo } from '../lib/types';
import { User, Mail, Lock, CreditCard, CheckCircle, Crown, ArrowLeft, Clock } from 'lucide-react';

interface AccountScreenProps {
  userData: UserData;
  onUpdateUser?: (updatedUser: UserData) => void; // Reserved for future use
  onBack: () => void;
}

export function AccountScreen({ userData, onBack }: AccountScreenProps) {
  const isGoogleUser = userData.authProvider === 'google';
  const subscription = userData.subscription || { tier: 'free', status: 'active' } as SubscriptionInfo;

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

            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2">Current Email</label>
                <div className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-300">
                  {userData.email}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium">Email Changes Coming Soon</p>
                  <p className="text-slate-400 text-sm">
                    Email updates require verification which is not yet implemented. This feature will be available in a future update.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Password Section - Only show for email users */}
          {!isGoogleUser && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl text-white">Change Password</h2>
              </div>

              <div className="flex items-center gap-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <Clock className="w-6 h-6 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium">Coming Soon</p>
                  <p className="text-slate-400 text-sm">
                    Password change functionality is not yet available. This feature will be added in a future update.
                  </p>
                </div>
              </div>
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

            {/* Upgrade/Manage Section */}
            {subscription.tier === 'free' ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-amber-900/20 to-amber-950/20 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-amber-400 font-semibold">Premium Plan</h4>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mb-4">
                    Premium subscriptions with advanced features, unlimited leagues, and live auction sync will be available soon.
                  </p>
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <p className="text-slate-400 text-sm">
                      Payment processing is not yet available. Check back later for premium upgrade options.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-slate-400 text-sm">
                  Subscription management is not yet available. This feature will be added when payment processing is implemented.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
