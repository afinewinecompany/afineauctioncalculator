import { useState, useEffect } from 'react';
import { UserData, SubscriptionInfo } from '../lib/types';
import { User, Mail, Lock, CreditCard, CheckCircle, Crown, ArrowLeft, Clock, MessageSquare, Phone, Bell, Send, Loader2 } from 'lucide-react';
import {
  getNotificationSettings,
  updatePhoneNumber,
  removePhoneNumber,
  updateSMSPreferences,
  sendTestSMS,
  NotificationSettings,
} from '../lib/notificationsApi';

interface AccountScreenProps {
  userData: UserData;
  onUpdateUser?: (updatedUser: UserData) => void; // Reserved for future use
  onBack: () => void;
}

export function AccountScreen({ userData, onBack }: AccountScreenProps) {
  const isGoogleUser = userData.authProvider === 'google';
  const subscription = userData.subscription || { tier: 'free', status: 'active' } as SubscriptionInfo;

  // SMS Notification state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load notification settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getNotificationSettings();
        setNotificationSettings(settings);
        setPhoneInput(settings.phoneNumber || '');
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    }
    loadSettings();
  }, []);

  // Handle phone number save
  const handleSavePhone = async () => {
    if (!phoneInput.trim()) return;
    setIsSavingPhone(true);
    setNotificationMessage(null);
    try {
      await updatePhoneNumber(phoneInput.trim());
      setNotificationSettings(prev => prev ? { ...prev, phoneNumber: phoneInput.trim() } : null);
      setNotificationMessage({ type: 'success', text: 'Phone number saved!' });
    } catch (error) {
      setNotificationMessage({ type: 'error', text: 'Failed to save phone number' });
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Handle phone number removal
  const handleRemovePhone = async () => {
    setIsSavingPhone(true);
    setNotificationMessage(null);
    try {
      await removePhoneNumber();
      setPhoneInput('');
      setNotificationSettings(prev => prev ? { ...prev, phoneNumber: null, smsNotificationsEnabled: false } : null);
      setNotificationMessage({ type: 'success', text: 'Phone number removed' });
    } catch (error) {
      setNotificationMessage({ type: 'error', text: 'Failed to remove phone number' });
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Handle SMS notifications toggle
  const handleToggleNotifications = async () => {
    if (!notificationSettings) return;
    setIsTogglingNotifications(true);
    setNotificationMessage(null);
    try {
      const newValue = !notificationSettings.smsNotificationsEnabled;
      await updateSMSPreferences(newValue);
      setNotificationSettings(prev => prev ? { ...prev, smsNotificationsEnabled: newValue } : null);
      setNotificationMessage({ type: 'success', text: `SMS notifications ${newValue ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      setNotificationMessage({ type: 'error', text: error.message || 'Failed to update preferences' });
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  // Handle test SMS
  const handleSendTest = async () => {
    setIsSendingTest(true);
    setNotificationMessage(null);
    try {
      const result = await sendTestSMS();
      setNotificationMessage({ type: 'success', text: result.message });
    } catch (error: any) {
      setNotificationMessage({ type: 'error', text: error.message || 'Failed to send test SMS' });
    } finally {
      setIsSendingTest(false);
    }
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

          {/* SMS Notifications Section */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl text-white">SMS Notifications</h2>
            </div>

            {isLoadingNotifications ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Notification Message */}
                {notificationMessage && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${
                    notificationMessage.type === 'success'
                      ? 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-900/20 border border-red-500/30 text-red-300'
                  }`}>
                    {notificationMessage.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm">{notificationMessage.text}</span>
                  </div>
                )}

                {/* Phone Number Input */}
                <div>
                  <label className="block text-slate-300 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                    {notificationSettings?.phoneNumber ? (
                      <button
                        onClick={handleRemovePhone}
                        disabled={isSavingPhone}
                        className="px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50"
                      >
                        {isSavingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                      </button>
                    ) : (
                      <button
                        onClick={handleSavePhone}
                        disabled={isSavingPhone || !phoneInput.trim()}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </button>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    Used for auction notifications when players are bid on or you're outbid
                  </p>
                </div>

                {/* Current Team Selection */}
                {notificationSettings?.selectedTeamName && (
                  <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                    <div className="text-slate-400 text-sm mb-1">Watching Team</div>
                    <div className="text-white font-medium">{notificationSettings.selectedTeamName}</div>
                    {notificationSettings.selectedRoomId && (
                      <div className="text-slate-500 text-xs mt-1">Room ID: {notificationSettings.selectedRoomId}</div>
                    )}
                    <p className="text-slate-500 text-xs mt-2">
                      Team selection is managed in the Draft Room
                    </p>
                  </div>
                )}

                {/* SMS Toggle */}
                {notificationSettings?.phoneNumber && (
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-white">Enable SMS Notifications</div>
                        <div className="text-slate-500 text-xs">Get notified when you're outbid</div>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleNotifications}
                      disabled={isTogglingNotifications}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        notificationSettings.smsNotificationsEnabled
                          ? 'bg-emerald-600'
                          : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notificationSettings.smsNotificationsEnabled
                            ? 'translate-x-7'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Test SMS Button */}
                {notificationSettings?.phoneNumber && notificationSettings.smsServiceAvailable && (
                  <button
                    onClick={handleSendTest}
                    disabled={isSendingTest}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Test SMS
                  </button>
                )}

                {/* SMS Service Unavailable Notice */}
                {notificationSettings && !notificationSettings.smsServiceAvailable && (
                  <div className="flex items-center gap-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-amber-300 font-medium">SMS Service Not Configured</p>
                      <p className="text-slate-400 text-sm">
                        SMS notifications are not yet available on this server. Contact the administrator.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
