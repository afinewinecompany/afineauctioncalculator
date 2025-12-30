import { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { LeagueSettings, Player, SavedLeague, UserData } from './lib/types';
import { generateMockPlayers } from './lib/mockData';
import { calculateLeagueAuctionValues, convertToPlayers } from './lib/auctionApi';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { GoogleCallbackHandler } from './components/GoogleCallbackHandler';
import { LeaguesList } from './components/LeaguesList';
import { SetupScreen } from './components/SetupScreen';
import { DraftRoom } from './components/DraftRoom';
import { PostDraftAnalysis } from './components/PostDraftAnalysis';
import { TopMenuBar } from './components/TopMenuBar';
import { ProjectionsLoadingScreen } from './components/ProjectionsLoadingScreen';
import { AccountScreen } from './components/AccountScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type AppScreen = 'landing' | 'login' | 'google-callback' | 'leagues' | 'setup' | 'draft' | 'analysis' | 'account';

// Inner app component that uses auth context
function AppContent() {
  const { user, isAuthenticated, isLoading: authLoading, logout: authLogout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentLeague, setCurrentLeague] = useState<SavedLeague | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [finalRoster, setFinalRoster] = useState<any[]>([]);
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState<LeagueSettings | null>(null);

  // Track if we've already shown the storage warning to prevent spamming
  const storageWarningShownRef = useRef(false);

  // Check for Google OAuth callback on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/auth/google/callback' || path.includes('/auth/google/callback')) {
      setCurrentScreen('google-callback');
    }
  }, []);

  // Load user data from localStorage after auth is initialized
  useEffect(() => {
    // Wait for auth to finish loading before checking localStorage
    if (authLoading) return;

    // Don't load localStorage during OAuth callback
    if (currentScreen === 'google-callback') return;

    // If already authenticated via AuthContext, let the sync effect handle it
    if (isAuthenticated) return;

    // If we already have userData (set by auth sync), don't override it
    if (userData) return;

    // Try to load from localStorage for returning users with valid tokens
    try {
      const savedUser = localStorage.getItem('fantasyBaseballUser');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        // Note: Saved data may have lightweight player arrays (only drafted players)
        // Full player data will be fetched when entering the draft room
        setUserData(parsedUser);
        setCurrentScreen('leagues');
      }
    } catch (error) {
      console.error('Failed to load user data from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem('fantasyBaseballUser');
    }
  }, [authLoading, isAuthenticated, currentScreen, userData]);

  // Save user data to localStorage whenever it changes
  // Note: Only save league metadata, not the full player arrays to avoid quota issues
  useEffect(() => {
    if (userData) {
      try {
        // Create a lightweight version without full player arrays
        const lightweightUserData = {
          ...userData,
          leagues: userData.leagues.map(league => ({
            ...league,
            // Only store player IDs and draft status, not full player objects
            players: league.players
              .filter(p => p.status === 'drafted' || p.status === 'onMyTeam')
              .map(p => ({
                id: p.id,
                name: p.name,
                status: p.status,
                draftedPrice: p.draftedPrice,
                draftedBy: p.draftedBy,
              }))
          }))
        };
        localStorage.setItem('fantasyBaseballUser', JSON.stringify(lightweightUserData));
        // Reset warning flag on successful save
        storageWarningShownRef.current = false;
      } catch (error) {
        console.warn('Failed to save to localStorage, likely quota exceeded:', error);

        // Show toast notification to warn user (only once per session)
        if (!storageWarningShownRef.current) {
          storageWarningShownRef.current = true;
          toast.warning('Storage limit reached', {
            description: 'Your draft progress may not be fully saved. Consider clearing old leagues to free up space.',
            duration: 8000,
          });
        }

        // Clear old data and try with minimal data
        try {
          const minimalData = {
            username: userData.username,
            email: userData.email,
            authProvider: userData.authProvider,
            profilePicture: userData.profilePicture,
            leagues: userData.leagues.map(l => ({
              id: l.id,
              leagueName: l.leagueName,
              settings: l.settings,
              createdAt: l.createdAt,
              lastModified: l.lastModified,
              status: l.status,
              players: [] // Don't save players if quota exceeded
            }))
          };
          localStorage.setItem('fantasyBaseballUser', JSON.stringify(minimalData));
        } catch (e) {
          console.error('Failed to save minimal data to localStorage:', e);
          // Show critical error toast if even minimal save fails
          if (!storageWarningShownRef.current) {
            storageWarningShownRef.current = true;
            toast.error('Unable to save draft progress', {
              description: 'localStorage is full. Your draft progress will not be saved. Please clear browser data.',
              duration: 10000,
            });
          }
        }
      }
    }
  }, [userData]);

  // Sync auth state with userData when user logs in via AuthContext
  // Note: Logout is handled explicitly in handleLogout(), not here
  useEffect(() => {
    // Skip during OAuth callback processing
    if (currentScreen === 'google-callback') return;

    if (isAuthenticated && user && !userData) {
      // User logged in via real auth - create userData from auth user
      console.log('[App] Auth sync: Creating userData from auth user');
      const newUserData: UserData = {
        username: user.name || user.email.split('@')[0],
        email: user.email,
        leagues: [],
        authProvider: user.authProvider,
        profilePicture: user.profilePictureUrl || undefined
      };
      setUserData(newUserData);
      // Only navigate to leagues if we're on landing or login
      if (currentScreen === 'landing' || currentScreen === 'login') {
        setCurrentScreen('leagues');
      }
    }
    // Note: We don't auto-clear userData when isAuthenticated becomes false
    // because that could happen during token refresh or temporary network issues.
    // Logout is handled explicitly via handleLogout() which clears everything.
  }, [isAuthenticated, user, authLoading, userData, currentScreen]);

  const handleLoginSuccess = () => {
    // Auth context handles the user state, this just triggers navigation
    // The useEffect above will sync userData when auth state changes
    setCurrentScreen('leagues');
  };

  const handleLogout = async () => {
    await authLogout();
    setUserData(null);
    setCurrentLeague(null);
    setPlayers([]);
    localStorage.removeItem('fantasyBaseballUser');
    setCurrentScreen('landing');
  };

  const handleCreateNewLeague = () => {
    setCurrentLeague(null);
    setCurrentScreen('setup');
  };

  const handleSetupComplete = async (settings: LeagueSettings) => {
    console.log('[App] Starting handleSetupComplete, setting isLoadingProjections=true');
    console.log('[App] Settings:', settings.leagueName, settings.projectionSystem);

    // Set loading state synchronously
    setIsLoadingProjections(true);
    setLoadingSettings(settings);
    setProjectionError(null);

    // Track when loading started for minimum display time
    const loadingStartTime = Date.now();
    const MINIMUM_LOADING_TIME_MS = 3000; // Show loading screen for at least 3 seconds

    try {
      console.log('[App] Starting API call...');
      // Fetch projections and calculate auction values based on league settings
      const calculatedValues = await calculateLeagueAuctionValues(settings);
      console.log('[App] API call complete');
      const projectedPlayers = convertToPlayers(calculatedValues);

      console.log(`Loaded ${projectedPlayers.length} players from ${settings.projectionSystem} projections`);
      console.log(`League summary:`, calculatedValues.leagueSummary);

      const newLeague: SavedLeague = {
        id: `league-${Date.now()}`,
        leagueName: settings.leagueName,
        settings,
        players: projectedPlayers,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'drafting'
      };

      // Add league to user's leagues
      if (userData) {
        const updatedUser = {
          ...userData,
          leagues: [...userData.leagues, newLeague]
        };
        setUserData(updatedUser);
      }

      setCurrentLeague(newLeague);
      setPlayers(newLeague.players);

      // Ensure minimum loading time for good UX
      const elapsedTime = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME_MS - elapsedTime);
      console.log(`[App] Elapsed: ${elapsedTime}ms, waiting additional ${remainingTime}ms`);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setCurrentScreen('draft');
    } catch (error) {
      console.error('Failed to load projections:', error);
      setProjectionError(error instanceof Error ? error.message : 'Failed to load projections');

      // Fallback to mock data if projections fail
      const fallbackPlayers = generateMockPlayers();
      const newLeague: SavedLeague = {
        id: `league-${Date.now()}`,
        leagueName: settings.leagueName,
        settings,
        players: fallbackPlayers,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'drafting'
      };

      if (userData) {
        const updatedUser = {
          ...userData,
          leagues: [...userData.leagues, newLeague]
        };
        setUserData(updatedUser);
      }

      setCurrentLeague(newLeague);
      setPlayers(newLeague.players);
      setCurrentScreen('draft');
    } finally {
      console.log('[App] Finally block - setting isLoadingProjections=false');
      setIsLoadingProjections(false);
      setLoadingSettings(null);
    }
  };

  const handleContinueDraft = async (league: SavedLeague) => {
    setCurrentLeague(league);

    // Check if we need to reload full player data
    // Saved leagues may only have drafted player summaries to save localStorage space
    const hasFullPlayerData = league.players.length > 50 && league.players[0]?.projectedStats !== undefined;

    if (hasFullPlayerData) {
      setPlayers(league.players);
    } else {
      // Need to reload full player data from API
      setIsLoadingProjections(true);
      try {
        const calculatedValues = await calculateLeagueAuctionValues(league.settings);
        const projectedPlayers = convertToPlayers(calculatedValues);

        // Merge draft status from saved lightweight data
        const draftedMap = new Map(league.players.map(p => [p.id, p]));
        const mergedPlayers = projectedPlayers.map(p => {
          const savedPlayer = draftedMap.get(p.id);
          if (savedPlayer && (savedPlayer.status === 'drafted' || savedPlayer.status === 'onMyTeam')) {
            return {
              ...p,
              status: savedPlayer.status,
              draftedPrice: savedPlayer.draftedPrice,
              draftedBy: savedPlayer.draftedBy,
            };
          }
          return p;
        });

        setPlayers(mergedPlayers);

        // Update the league in userData with full player data
        if (userData) {
          const updatedLeague = { ...league, players: mergedPlayers };
          const updatedUser = {
            ...userData,
            leagues: userData.leagues.map(l => l.id === league.id ? updatedLeague : l)
          };
          setUserData(updatedUser);
          setCurrentLeague(updatedLeague);
        }
      } catch (error) {
        console.error('Failed to reload player data:', error);
        // Fall back to saved data even if incomplete
        setPlayers(league.players);
      } finally {
        setIsLoadingProjections(false);
      }
    }

    if (league.status === 'complete') {
      const myTeam = league.players.filter(p => p.status === 'onMyTeam');
      setFinalRoster(myTeam as any);
      setCurrentScreen('analysis');
    } else {
      setCurrentScreen('draft');
    }
  };

  const handleDeleteLeague = (leagueId: string) => {
    if (userData) {
      const updatedUser = {
        ...userData,
        leagues: userData.leagues.filter(l => l.id !== leagueId)
      };
      setUserData(updatedUser);
    }
  };

  const handleEditLeague = (updatedLeague: SavedLeague) => {
    if (userData) {
      const updatedUser = {
        ...userData,
        leagues: userData.leagues.map(l =>
          l.id === updatedLeague.id ? updatedLeague : l
        )
      };
      setUserData(updatedUser);
    }
  };

  const handleReloadProjections = async (league: SavedLeague, newProjectionSystem?: LeagueSettings['projectionSystem']) => {
    setIsLoadingProjections(true);
    setLoadingSettings(league.settings);
    setProjectionError(null);

    const loadingStartTime = Date.now();
    const MINIMUM_LOADING_TIME_MS = 2000;

    try {
      // Use the new projection system if provided, otherwise use the existing one
      const settingsToUse = newProjectionSystem
        ? { ...league.settings, projectionSystem: newProjectionSystem }
        : league.settings;

      const calculatedValues = await calculateLeagueAuctionValues(settingsToUse);
      const projectedPlayers = convertToPlayers(calculatedValues);

      console.log(`Reloaded ${projectedPlayers.length} players from ${settingsToUse.projectionSystem} projections`);

      // Merge draft status from existing players
      const draftedMap = new Map(league.players.map(p => [p.id, p]));
      const mergedPlayers = projectedPlayers.map(p => {
        const existingPlayer = draftedMap.get(p.id);
        if (existingPlayer && (existingPlayer.status === 'drafted' || existingPlayer.status === 'onMyTeam')) {
          return {
            ...p,
            status: existingPlayer.status,
            draftedPrice: existingPlayer.draftedPrice,
            draftedBy: existingPlayer.draftedBy,
          };
        }
        return p;
      });

      // Update the league with new settings and players
      const updatedLeague: SavedLeague = {
        ...league,
        settings: settingsToUse,
        players: mergedPlayers,
        lastModified: new Date().toISOString()
      };

      if (userData) {
        const updatedUser = {
          ...userData,
          leagues: userData.leagues.map(l =>
            l.id === league.id ? updatedLeague : l
          )
        };
        setUserData(updatedUser);
      }

      // Ensure minimum loading time for good UX
      const elapsedTime = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME_MS - elapsedTime);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } catch (error) {
      console.error('Failed to reload projections:', error);
      setProjectionError(error instanceof Error ? error.message : 'Failed to reload projections');
      throw error; // Re-throw so the modal can show the error
    } finally {
      setIsLoadingProjections(false);
      setLoadingSettings(null);
    }
  };

  const handleDraftComplete = () => {
    // Get the drafted players from the draft room
    const myTeam = players.filter(p => p.status === 'onMyTeam');
    setFinalRoster(myTeam as any);

    // Update league status
    if (currentLeague && userData) {
      const updatedLeague: SavedLeague = {
        ...currentLeague,
        players,
        lastModified: new Date().toISOString(),
        status: 'complete'
      };

      const updatedUser = {
        ...userData,
        leagues: userData.leagues.map(l => 
          l.id === currentLeague.id ? updatedLeague : l
        )
      };

      setUserData(updatedUser);
      setCurrentLeague(updatedLeague);
    }

    setCurrentScreen('analysis');
  };

  const handleBackToLeagues = () => {
    setCurrentScreen('leagues');
    setCurrentLeague(null);
    setPlayers([]);
    setFinalRoster([]);
  };

  const handleSwitchLeague = async (league: SavedLeague) => {
    // Reuse the same logic as handleContinueDraft
    await handleContinueDraft(league);
  };

  // Save draft progress periodically
  useEffect(() => {
    if (currentScreen === 'draft' && currentLeague && userData) {
      const interval = setInterval(() => {
        const updatedLeague: SavedLeague = {
          ...currentLeague,
          players,
          lastModified: new Date().toISOString()
        };

        const updatedUser = {
          ...userData,
          leagues: userData.leagues.map(l => 
            l.id === currentLeague.id ? updatedLeague : l
          )
        };

        setUserData(updatedUser);
      }, 30000); // Save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [currentScreen, currentLeague, players, userData]);

  return (
    <ErrorBoundary>
      {currentScreen === 'landing' && (
        <LandingPage onGetStarted={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'login' && (
        <LoginPage
          onBack={() => setCurrentScreen('landing')}
          onSuccess={handleLoginSuccess}
        />
      )}

      {currentScreen === 'google-callback' && (
        <GoogleCallbackHandler
          onSuccess={handleLoginSuccess}
          onError={() => setCurrentScreen('login')}
        />
      )}

      {currentScreen === 'leagues' && userData && (
        <ErrorBoundary
          screenName="Leagues List"
          onReset={() => {
            // Reset to a clean state by refreshing (leagues is already a safe screen)
            window.location.reload();
          }}
        >
          <LeaguesList
            username={userData.username}
            leagues={userData.leagues}
            onCreateNew={handleCreateNewLeague}
            onContinueDraft={handleContinueDraft}
            onDeleteLeague={handleDeleteLeague}
            onEditLeague={handleEditLeague}
            onReloadProjections={handleReloadProjections}
            onLogout={handleLogout}
            onAccount={() => setCurrentScreen('account')}
            profilePicture={userData.profilePicture}
            subscription={userData.subscription}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'setup' && userData && (
        <ErrorBoundary
          screenName="League Setup"
          onReset={handleBackToLeagues}
        >
          <TopMenuBar
            currentLeague={null}
            allLeagues={userData.leagues}
            onGoToDashboard={handleBackToLeagues}
            onSwitchLeague={handleSwitchLeague}
            showLeagueSelector={false}
          />
          <SetupScreen onComplete={handleSetupComplete} />

          {projectionError && (
            <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 rounded-xl p-4 max-w-md z-50">
              <p className="text-red-200">Failed to load projections: {projectionError}</p>
              <p className="text-red-300 text-sm mt-1">Using fallback mock data instead.</p>
            </div>
          )}
        </ErrorBoundary>
      )}

      {/* Animated Projections Loading Screen - rendered at top level for proper exit animations */}
      <ProjectionsLoadingScreen
        isVisible={isLoadingProjections}
        projectionSystem={loadingSettings?.projectionSystem || 'steamer'}
        leagueName={loadingSettings?.leagueName || 'Your League'}
      />

      {currentScreen === 'draft' && currentLeague && userData && (
        <ErrorBoundary
          screenName="Draft Room"
          onReset={handleBackToLeagues}
        >
          <TopMenuBar
            currentLeague={currentLeague}
            allLeagues={userData.leagues}
            onGoToDashboard={handleBackToLeagues}
            onSwitchLeague={handleSwitchLeague}
          />
          <DraftRoom
            settings={currentLeague.settings}
            players={players}
            onComplete={handleDraftComplete}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'analysis' && currentLeague && userData && (
        <ErrorBoundary
          screenName="Post-Draft Analysis"
          onReset={handleBackToLeagues}
        >
          <TopMenuBar
            currentLeague={currentLeague}
            allLeagues={userData.leagues}
            onGoToDashboard={handleBackToLeagues}
            onSwitchLeague={handleSwitchLeague}
          />
          <PostDraftAnalysis
            roster={finalRoster}
            settings={currentLeague.settings}
            onRestart={handleBackToLeagues}
          />
        </ErrorBoundary>
      )}

      {currentScreen === 'account' && userData && (
        <ErrorBoundary
          screenName="Account Settings"
          onReset={handleBackToLeagues}
        >
          <AccountScreen
            userData={userData}
            onUpdateUser={setUserData}
            onBack={handleBackToLeagues}
          />
        </ErrorBoundary>
      )}

      {/* Toast notifications for storage warnings and other alerts */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(30 41 59)', // slate-800
            border: '1px solid rgb(71 85 105)', // slate-600
            color: 'rgb(226 232 240)', // slate-200
          },
        }}
      />
    </ErrorBoundary>
  );
}

// Main App component wrapped with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}