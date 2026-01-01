import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  FileText,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  ShieldOff,
  Check,
  X,
  ExternalLink,
  Clock,
  Loader2,
  ArrowLeft,
  LayoutDashboard,
  TrendingUp,
} from 'lucide-react';
import { useIsMobile } from './ui/use-mobile';
import {
  fetchAdminStats,
  fetchUsers,
  fetchErrorLogs,
  updateUserRole,
  resolveError,
  unresolveError,
} from '../lib/adminApi';
import type {
  AdminStats,
  AdminUserEntry,
  ErrorLogEntry,
  AdminPagination,
  ErrorLogFilters,
} from '../lib/types';
import { toast } from 'sonner';

interface AdminDashboardProps {
  onBack: () => void;
}

type Tab = 'overview' | 'errors' | 'users';

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [usersPagination, setUsersPagination] = useState<AdminPagination | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');

  // Errors
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [errorsPagination, setErrorsPagination] = useState<AdminPagination | null>(null);
  const [errorsPage, setErrorsPage] = useState(1);
  const [errorFilters, setErrorFilters] = useState<ErrorLogFilters>({
    source: 'all',
    severity: 'all',
    resolved: 'false', // Default to unresolved
  });

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchAdminStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load stats');
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers(usersPage, 20, usersSearch || undefined);
      setUsers(data.users);
      setUsersPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    }
  }, [usersPage, usersSearch]);

  // Load errors
  const loadErrors = useCallback(async () => {
    try {
      const data = await fetchErrorLogs(errorsPage, 20, errorFilters);
      setErrors(data.errors);
      setErrorsPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load errors:', error);
      toast.error('Failed to load error logs');
    }
  }, [errorsPage, errorFilters]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadStats(), loadUsers(), loadErrors()]);
      setIsLoading(false);
    };
    loadData();
  }, [loadStats, loadUsers, loadErrors]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadStats();
      if (activeTab === 'errors') loadErrors();
      if (activeTab === 'users') loadUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, loadStats, loadErrors, loadUsers]);

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await updateUserRole(userId, newRole);
      toast.success(`User role updated to ${newRole}`);
      loadUsers();
      loadStats();
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update user role');
    }
  };

  // Handle resolve error
  const handleResolveError = async (errorId: string) => {
    try {
      await resolveError(errorId);
      toast.success('Error marked as resolved');
      loadErrors();
      loadStats();
    } catch (error) {
      console.error('Failed to resolve error:', error);
      toast.error('Failed to resolve error');
    }
  };

  // Handle unresolve error
  const handleUnresolveError = async (errorId: string) => {
    try {
      await unresolveError(errorId);
      toast.success('Error reopened');
      loadErrors();
      loadStats();
    } catch (error) {
      console.error('Failed to unresolve error:', error);
      toast.error('Failed to reopen error');
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d0d0d' }}>
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 rounded-full" style={{ background: 'linear-gradient(135deg, #3b82f630, #1d4ed820, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-40 right-10 w-80 h-80 rounded-full" style={{ background: 'linear-gradient(225deg, #8b5cf620, #6366f115, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full" style={{ background: 'linear-gradient(45deg, #ef444420, transparent)', filter: 'blur(60px)' }}></div>
      </div>

      <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-4' : 'py-8'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 animate-fadeIn">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>Admin Dashboard</h1>
                <p className="text-sm text-slate-400">Platform management & diagnostics</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              <span className={isMobile ? 'hidden' : ''}>Auto-refresh</span>
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
          {(['overview', 'errors', 'users'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab === 'overview' && <LayoutDashboard className="w-4 h-4 inline mr-2" />}
              {tab === 'errors' && <AlertTriangle className="w-4 h-4 inline mr-2" />}
              {tab === 'users' && <Users className="w-4 h-4 inline mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'errors' && stats && stats.errors.unresolvedCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {stats.errors.unresolvedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fadeIn">
                {/* Users Card */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Users</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-2">{stats.users.total}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-400">
                      <TrendingUp className="w-3 h-3 inline mr-1 text-emerald-400" />
                      {stats.users.thisWeek} this week
                    </span>
                  </div>
                </div>

                {/* Leagues Card */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <FileText className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Leagues</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-2">{stats.leagues.total}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-400">{stats.leagues.completed} completed</span>
                    <span className="text-yellow-400">{stats.leagues.activelyDrafting} drafting</span>
                  </div>
                </div>

                {/* Active Drafts Card */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Active Drafts</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-2">{stats.draftRooms.currentlyActive}</p>
                  <p className="text-sm text-slate-400">Currently in progress</p>
                </div>

                {/* Errors Card */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Errors</h3>
                  </div>
                  <p className="text-3xl font-bold text-white mb-2">{stats.errors.unresolvedCount}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-red-400">{stats.errors.last24Hours} last 24h</span>
                    <span className="text-slate-400">{stats.errors.total} total</span>
                  </div>
                </div>
              </div>
            )}

            {/* Errors Tab */}
            {activeTab === 'errors' && (
              <div className="animate-fadeIn">
                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <select
                    value={errorFilters.source}
                    onChange={(e) => {
                      setErrorFilters({ ...errorFilters, source: e.target.value as ErrorLogFilters['source'] });
                      setErrorsPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                  >
                    <option value="all">All Sources</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                  </select>
                  <select
                    value={errorFilters.severity}
                    onChange={(e) => {
                      setErrorFilters({ ...errorFilters, severity: e.target.value as ErrorLogFilters['severity'] });
                      setErrorsPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                  >
                    <option value="all">All Severity</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Info</option>
                  </select>
                  <select
                    value={errorFilters.resolved}
                    onChange={(e) => {
                      setErrorFilters({ ...errorFilters, resolved: e.target.value as ErrorLogFilters['resolved'] });
                      setErrorsPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="false">Unresolved</option>
                    <option value="true">Resolved</option>
                  </select>
                  <button
                    onClick={() => loadErrors()}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>

                {/* Errors Table */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Source</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Error</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {errors.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No errors found
                            </td>
                          </tr>
                        ) : (
                          errors.map((error) => (
                            <tr key={error.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-slate-300" title={formatDate(error.createdAt)}>
                                  {formatRelativeTime(error.createdAt)}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  error.source === 'frontend'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {error.source}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-white truncate max-w-md" title={error.errorMessage}>
                                  {error.errorMessage}
                                </p>
                                {error.context?.component && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    Component: {error.context.component as string}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-slate-300">
                                  {error.userName || error.userEmail || 'Anonymous'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {error.resolved ? (
                                  <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                                    Resolved
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
                                    Open
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                {error.resolved ? (
                                  <button
                                    onClick={() => handleUnresolveError(error.id)}
                                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                                    title="Reopen"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleResolveError(error.id)}
                                    className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400"
                                    title="Mark as resolved"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {errorsPagination && errorsPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700">
                      <span className="text-sm text-slate-400">
                        Page {errorsPagination.page} of {errorsPagination.totalPages} ({errorsPagination.total} total)
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setErrorsPage(Math.max(1, errorsPage - 1))}
                          disabled={errorsPage === 1}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setErrorsPage(Math.min(errorsPagination.totalPages, errorsPage + 1))}
                          disabled={errorsPage === errorsPagination.totalPages}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="animate-fadeIn">
                {/* Search */}
                <div className="flex gap-3 mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by email or name..."
                      value={usersSearch}
                      onChange={(e) => {
                        setUsersSearch(e.target.value);
                        setUsersPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400"
                    />
                  </div>
                  <button
                    onClick={() => loadUsers()}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>

                {/* Users Table */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Auth</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Leagues</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Joined</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Login</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              No users found
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{user.name || 'Unnamed'}</p>
                                  <p className="text-xs text-slate-400">{user.email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {user.role === 'admin' ? (
                                  <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400 flex items-center gap-1 w-fit">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs rounded-full bg-slate-500/20 text-slate-400">
                                    User
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  user.authProvider === 'google'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {user.authProvider}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                                {user.leagueCount}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                                {formatDate(user.createdAt)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                                {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Never'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                {user.role === 'admin' ? (
                                  <button
                                    onClick={() => handleRoleChange(user.id, 'user')}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                                    title="Demote to user"
                                  >
                                    <ShieldOff className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRoleChange(user.id, 'admin')}
                                    className="p-1.5 rounded-lg hover:bg-purple-500/20 text-slate-400 hover:text-purple-400"
                                    title="Promote to admin"
                                  >
                                    <Shield className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {usersPagination && usersPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700">
                      <span className="text-sm text-slate-400">
                        Page {usersPagination.page} of {usersPagination.totalPages} ({usersPagination.total} total)
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUsersPage(Math.max(1, usersPage - 1))}
                          disabled={usersPage === 1}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setUsersPage(Math.min(usersPagination.totalPages, usersPage + 1))}
                          disabled={usersPage === usersPagination.totalPages}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
