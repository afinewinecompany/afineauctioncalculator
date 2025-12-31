import { useState, useEffect, useRef, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { LeagueSettings, Player, SavedLeague, UserData } from './lib/types';
import { generateMockPlayers } from './lib/mockData';
import { calculateLeagueAuctionValues, convertToPlayers } from './lib/auctionApi';
import { fetchLeagues, createLeague as createLeagueApi, updateLeague as updateLeagueApi, deleteLeague as deleteLeagueApi, fetchDraftState, saveDraftState, DraftPlayerState } from './lib/leaguesApi';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { GoogleCallbackHandler } from './components/GoogleCallbackHandler';
import { LeaguesList } from './components/LeaguesList';
import { SetupScreen } from './components/SetupScreen';
import { DraftRoom } from './components/DraftRoom';
import { PostDraftAnalysis } from './components/PostDraftAnalysis';
import { TopMenuBar } from './components/TopMenuBar';
import { ProjectionsLoadingScreen } from './components/ProjectionsLoadingScreen';
import { AccountScreen } from './components/AccountScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type AppScreen = 'landing' | 'login' | 'forgot-password' | 'reset-password' | 'google-callback' | 'leagues' | 'setup' | 'draft' | 'analysis' | 'account';

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

  // Track lastModified for optimistic locking of draft state
  const draftLastModifiedRef = useRef<string | null>(null);

  // Track reset password token from URL
  const [resetToken, setResetToken] = useState<string>('');

  // Check for special routes on mount (OAuth callback, password reset)
  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    if (path === '/auth/google/callback' || path.includes('/auth/google/callback')) {
      setCurrentScreen('google-callback');
    } else if (path === '/reset-password' || path.includes('/reset-password')) {
      const token = searchParams.get('token') || '';
      setResetToken(token);
      setCurrentScreen('reset-password');
      // Clean up the URL without reloading the page
      window.history.replaceState({}, '', '/reset-password');
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
      if (import.meta.env.DEV) {
        console.error('Failed to load user data from localStorage:', error);
      }
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
        if (import.meta.env.DEV) {
          console.warn('Failed to save to localStorage, likely quota exceeded:', error);
        }

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
          if (import.meta.env.DEV) {
            console.error('Failed to save minimal data to localStorage:', e);
          }
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
      // User logged in via real auth - create userData from auth user and fetch leagues
      if (import.meta.env.DEV) {
        console.log('[App] Auth sync: Creating userData from auth user and fetching leagues');
      }

      // Immediately set user data with empty leagues, then fetch from backend
      const initialUserData: UserData = {
        username: user.name || user.email.split('@')[0],
        email: user.email,
        leagues: [],
        authProvider: user.authProvider,
        profilePicture: user.profilePictureUrl || undefined
      };
      setUserData(initialUserData);

      // Fetch leagues from backend
      fetchLeagues()
        .then((backendLeagues) => {
          if (import.meta.env.DEV) {
            console.log('[App] Fetched leagues from backend:', backendLeagues.length);
          }
          setUserData((prev) => prev ? { ...prev, leagues: backendLeagues } : null);
        })
        .catch((error) => {
          console.error('[App] Failed to fetch leagues from backend:', error);
          // Don't fail silently - show a toast to the user
          toast.error('Failed to load your leagues', {
            description: 'Your leagues could not be loaded. Please try refreshing the page.',
          });
        });

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

  // Track which league we're resuming setup for
  const [resumingLeague, setResumingLeague] = useState<SavedLeague | null>(null);

  const handleCreateNewLeague = () => {
    setCurrentLeague(null);
    setResumingLeague(null);
    setCurrentScreen('setup');
  };

  const handleResumeSetup = (league: SavedLeague) => {
    setResumingLeague(league);
    setCurrentLeague(null);
    setCurrentScreen('setup');
  };

  const handleSaveAndExitSetup = () => {
    if (import.meta.env.DEV) {
      console.log('[App] handleSaveAndExitSetup called');
      console.log('[App] userData.leagues before navigation:', userData?.leagues.map(l => ({ id: l.id, name: l.leagueName, status: l.status })));
    }
    // Clear resuming state and go back to leagues list
    setResumingLeague(null);
    setCurrentScreen('leagues');
  };

  // Callback for when auto-save creates a new league during setup
  // Using functional update pattern to avoid stale closure issues
  const handleSetupLeagueCreated = useCallback((league: SavedLeague) => {
    if (import.meta.env.DEV) {
      console.log('[App] handleSetupLeagueCreated called with league:', league.id, league.leagueName);
    }
    // Add the new league to userData using functional update
    setUserData(prev => {
      if (!prev) return prev;
      if (import.meta.env.DEV) {
        console.log('[App] Current userData.leagues count:', prev.leagues.length);
        console.log('[App] Adding league to userData');
      }
      return {
        ...prev,
        leagues: [...prev.leagues, league]
      };
    });
    // Update resumingLeague with the backend ID
    setResumingLeague(league);
  }, []);

  // Callback for when auto-save updates an existing league during setup
  // Using functional update pattern to avoid stale closure issues
  const handleSetupLeagueUpdated = useCallback((league: SavedLeague) => {
    // Update the league in userData using functional update
    setUserData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        leagues: prev.leagues.map(l => l.id === league.id ? { ...l, ...league } : l)
      };
    });
  }, []);

  const handleSetupComplete = async (settings: LeagueSettings) => {
    if (import.meta.env.DEV) {
      console.log('[App] Starting handleSetupComplete, setting isLoadingProjections=true');
      console.log('[App] Settings:', settings.leagueName, settings.projectionSystem);
      console.log('[App] Resuming league:', resumingLeague?.id);
    }

    // Set loading state synchronously
    setIsLoadingProjections(true);
    setLoadingSettings(settings);
    setProjectionError(null);

    // Track when loading started for minimum display time
    const loadingStartTime = Date.now();
    const MINIMUM_LOADING_TIME_MS = 3000; // Show loading screen for at least 3 seconds

    try {
      if (import.meta.env.DEV) {
        console.log('[App] Starting API call...');
      }
      // Fetch projections and calculate auction values based on league settings
      const calculatedValues = await calculateLeagueAuctionValues(settings);
      if (import.meta.env.DEV) {
        console.log('[App] API call complete');
      }
      const projectedPlayers = convertToPlayers(calculatedValues);

      if (import.meta.env.DEV) {
        console.log(`Loaded ${projectedPlayers.length} players from ${settings.projectionSystem} projections`);
        console.log(`League summary:`, calculatedValues.leagueSummary);
      }

      // Determine if we're updating an existing league or creating a new one
      const isResuming = resumingLeague && !resumingLeague.id.startsWith('draft-');
      const leagueId = isResuming ? resumingLeague.id : `league-${Date.now()}`;

      const leagueToSave: SavedLeague = {
        id: leagueId,
        leagueName: settings.leagueName,
        settings,
        players: projectedPlayers,
        createdAt: resumingLeague?.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'drafting',
        setupStep: undefined, // Clear setup step since we're now drafting
      };

      // Save league to backend for persistence
      let savedLeague = leagueToSave;
      try {
        if (import.meta.env.DEV) {
          console.log('[App] Saving league to backend...');
        }

        if (isResuming) {
          // Update existing league
          savedLeague = await updateLeagueApi(leagueId, leagueToSave);
          savedLeague = { ...savedLeague, players: projectedPlayers };
          if (import.meta.env.DEV) {
            console.log('[App] League updated on backend with ID:', savedLeague.id);
          }
        } else {
          // Create new league
          savedLeague = await createLeagueApi(leagueToSave);
          savedLeague = { ...savedLeague, players: projectedPlayers };
          if (import.meta.env.DEV) {
            console.log('[App] League saved to backend with ID:', savedLeague.id);
          }
        }
      } catch (error) {
        console.error('[App] Failed to save league to backend:', error);
        toast.error('League saved locally only', {
          description: 'Your league could not be saved to the server. It will be saved locally.',
        });
      }

      // Add or update league in user's leagues
      if (userData) {
        const updatedUser = {
          ...userData,
          leagues: isResuming
            ? userData.leagues.map(l => l.id === savedLeague.id ? savedLeague : l)
            : [...userData.leagues, savedLeague]
        };
        setUserData(updatedUser);
      }

      // Clear resuming state
      setResumingLeague(null);

      setCurrentLeague(savedLeague);
      setPlayers(savedLeague.players);

      // Ensure minimum loading time for good UX
      const elapsedTime = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME_MS - elapsedTime);
      if (import.meta.env.DEV) {
        console.log(`[App] Elapsed: ${elapsedTime}ms, waiting additional ${remainingTime}ms`);
      }

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setCurrentScreen('draft');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load projections:', error);
      }
      setProjectionError(error instanceof Error ? error.message : 'Failed to load projections');

      // Fallback to mock data if projections fail
      const fallbackPlayers = generateMockPlayers();
      const fallbackLeague: SavedLeague = {
        id: `league-${Date.now()}`,
        leagueName: settings.leagueName,
        settings,
        players: fallbackPlayers,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'drafting'
      };

      // Try to save fallback league to backend too
      let savedFallbackLeague = fallbackLeague;
      try {
        savedFallbackLeague = await createLeagueApi(fallbackLeague);
        savedFallbackLeague = { ...savedFallbackLeague, players: fallbackPlayers };
      } catch (backendError) {
        console.error('[App] Failed to save fallback league to backend:', backendError);
      }

      if (userData) {
        const updatedUser = {
          ...userData,
          leagues: [...userData.leagues, savedFallbackLeague]
        };
        setUserData(updatedUser);
      }

      setCurrentLeague(savedFallbackLeague);
      setPlayers(savedFallbackLeague.players);
      setCurrentScreen('draft');
    } finally {
      if (import.meta.env.DEV) {
        console.log('[App] Finally block - setting isLoadingProjections=false');
      }
      setIsLoadingProjections(false);
      setLoadingSettings(null);
    }
  };

  const handleContinueDraft = async (league: SavedLeague) => {
    setCurrentLeague(league);
    setIsLoadingProjections(true);

    try {
      // Always reload full player projections from API
      const calculatedValues = await calculateLeagueAuctionValues(league.settings);
      const projectedPlayers = convertToPlayers(calculatedValues);

      // Fetch draft state from server (primary source for cross-device sync)
      // Only if league has a backend ID (not a local-only league)
      let serverDraftState: DraftPlayerState[] = [];
      if (!league.id.startsWith('league-')) {
        try {
          const draftResult = await fetchDraftState(league.id);
          serverDraftState = draftResult.players;
          // Store lastModified for optimistic locking on future saves
          draftLastModifiedRef.current = draftResult.lastModified;
          if (import.meta.env.DEV) {
            console.log('[App] Loaded draft state from server:', serverDraftState.length, 'drafted players, lastModified:', draftResult.lastModified);
          }
        } catch (error) {
          console.error('[App] Failed to fetch draft state from server:', error);
        }
      }

      // Use server draft state if available, otherwise fall back to localStorage data
      const draftedMap = new Map<string, DraftPlayerState>();

      // First, add localStorage draft data as fallback
      league.players.forEach(p => {
        if (p.status === 'drafted' || p.status === 'onMyTeam') {
          draftedMap.set(p.id, {
            id: p.id,
            name: p.name,
            status: p.status,
            draftedPrice: p.draftedPrice,
            draftedBy: p.draftedBy,
          });
        }
      });

      // Then override with server data (takes precedence)
      serverDraftState.forEach(p => {
        draftedMap.set(p.id, p);
      });

      // Merge draft status with full player projections
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

      if (league.status === 'complete') {
        const myTeam = mergedPlayers.filter(p => p.status === 'onMyTeam');
        setFinalRoster(myTeam as any);
        setCurrentScreen('analysis');
      } else {
        setCurrentScreen('draft');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to reload player data:', error);
      }
      // Fall back to saved data even if incomplete
      setPlayers(league.players);
      setCurrentScreen('draft');
    } finally {
      setIsLoadingProjections(false);
    }
  };

  const handleDeleteLeague = async (leagueId: string) => {
    if (userData) {
      // Optimistically update UI first
      const updatedUser = {
        ...userData,
        leagues: userData.leagues.filter(l => l.id !== leagueId)
      };
      setUserData(updatedUser);

      // Delete from backend (only if it's a backend-stored league)
      if (!leagueId.startsWith('league-')) {
        try {
          await deleteLeagueApi(leagueId);
          if (import.meta.env.DEV) {
            console.log('[App] League deleted from backend:', leagueId);
          }
        } catch (error) {
          console.error('[App] Failed to delete league from backend:', error);
          toast.error('Failed to delete league from server', {
            description: 'The league was removed locally but may still exist on the server.',
          });
        }
      }
    }
  };

  const handleEditLeague = async (updatedLeague: SavedLeague) => {
    if (userData) {
      // Optimistically update UI first
      const updatedUser = {
        ...userData,
        leagues: userData.leagues.map(l =>
          l.id === updatedLeague.id ? updatedLeague : l
        )
      };
      setUserData(updatedUser);

      // Update on backend (only if it's a backend-stored league)
      if (!updatedLeague.id.startsWith('league-')) {
        try {
          await updateLeagueApi(updatedLeague.id, updatedLeague);
          if (import.meta.env.DEV) {
            console.log('[App] League updated on backend:', updatedLeague.id);
          }
        } catch (error) {
          console.error('[App] Failed to update league on backend:', error);
          toast.error('Failed to save league changes to server', {
            description: 'Changes were saved locally but may not persist after logout.',
          });
        }
      }
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

      if (import.meta.env.DEV) {
        console.log(`Reloaded ${projectedPlayers.length} players from ${settingsToUse.projectionSystem} projections`);
      }

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
      if (import.meta.env.DEV) {
        console.error('Failed to reload projections:', error);
      }
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

  // Helper to save draft state immediately (used on navigation and beforeunload)
  const saveDraftStateNow = useCallback(async () => {
    if (!currentLeague || currentLeague.id.startsWith('league-') || players.length === 0) {
      return;
    }

    const draftedPlayers: DraftPlayerState[] = players
      .filter(p => p.status !== 'available')
      .map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        draftedPrice: p.draftedPrice,
        draftedBy: p.draftedBy,
      }));

    if (draftedPlayers.length > 0) {
      try {
        const result = await saveDraftState(
          currentLeague.id,
          draftedPlayers,
          draftLastModifiedRef.current || undefined
        );
        if (result.success) {
          draftLastModifiedRef.current = result.lastModified;
        }
      } catch (error) {
        console.error('[App] Failed to save draft state on navigation:', error);
      }
    }
  }, [currentLeague, players]);

  const handleBackToLeagues = async () => {
    // Save draft state before leaving
    if (currentScreen === 'draft') {
      await saveDraftStateNow();
    }
    setCurrentScreen('leagues');
    setCurrentLeague(null);
    setPlayers([]);
    setFinalRoster([]);
    draftLastModifiedRef.current = null;
  };

  const handleSwitchLeague = async (league: SavedLeague) => {
    // Reuse the same logic as handleContinueDraft
    await handleContinueDraft(league);
  };

  // Save draft progress periodically (to localStorage and server)
  useEffect(() => {
    if (currentScreen === 'draft' && currentLeague && userData) {
      const interval = setInterval(async () => {
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

        // Update localStorage (handled by setUserData effect)
        setUserData(updatedUser);

        // Also save draft state to server for cross-device sync
        // Only save if league has a backend ID (not a local-only league)
        if (!currentLeague.id.startsWith('league-')) {
          const draftedPlayers: DraftPlayerState[] = players
            .filter(p => p.status !== 'available')
            .map(p => ({
              id: p.id,
              name: p.name,
              status: p.status,
              draftedPrice: p.draftedPrice,
              draftedBy: p.draftedBy,
            }));

          try {
            // Use optimistic locking to detect conflicts
            const result = await saveDraftState(
              currentLeague.id,
              draftedPlayers,
              draftLastModifiedRef.current || undefined
            );

            if (result.conflict) {
              // Another device modified the draft - show warning
              toast.warning('Draft modified on another device', {
                description: 'Your draft was updated elsewhere. Refresh to see the latest changes.',
                duration: 10000,
              });
              // Update our lastModified to prevent repeated warnings
              draftLastModifiedRef.current = result.serverLastModified || null;
            } else if (result.success) {
              // Update lastModified for next save
              draftLastModifiedRef.current = result.lastModified;
              if (import.meta.env.DEV) {
                console.log('[App] Draft state saved to server:', draftedPlayers.length, 'players');
              }
            }
          } catch (error) {
            console.error('[App] Failed to save draft state to server:', error);
          }
        }
      }, 30000); // Save every 30 seconds

      return () => clearInterval(interval);
    }
  }, [currentScreen, currentLeague, players, userData]);

  // Save draft state when user leaves or refreshes the page
  useEffect(() => {
    if (currentScreen !== 'draft' || !currentLeague || currentLeague.id.startsWith('league-')) {
      return;
    }

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable save on page unload
      // This is a fire-and-forget approach since we can't await in beforeunload
      const draftedPlayers = players
        .filter(p => p.status !== 'available')
        .map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          draftedPrice: p.draftedPrice,
          draftedBy: p.draftedBy,
        }));

      if (draftedPlayers.length > 0) {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const url = `${apiUrl}/api/leagues/${currentLeague.id}/draft-state`;
        const token = localStorage.getItem('auth_access_token');

        if (token) {
          // Use sendBeacon for reliable delivery during page unload
          const blob = new Blob(
            [JSON.stringify({ players: draftedPlayers })],
            { type: 'application/json' }
          );
          // Note: sendBeacon doesn't support headers, so we append token as query param
          // This is a backup save - the token in header is preferred
          navigator.sendBeacon(url + `?token=${encodeURIComponent(token)}`, blob);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentScreen, currentLeague, players]);

  return (
    <ErrorBoundary>
      {currentScreen === 'landing' && (
        <LandingPage onGetStarted={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'login' && (
        <LoginPage
          onBack={() => setCurrentScreen('landing')}
          onSuccess={handleLoginSuccess}
          onForgotPassword={() => setCurrentScreen('forgot-password')}
        />
      )}

      {currentScreen === 'forgot-password' && (
        <ForgotPasswordPage
          onBack={() => setCurrentScreen('landing')}
          onBackToLogin={() => setCurrentScreen('login')}
        />
      )}

      {currentScreen === 'reset-password' && (
        <ResetPasswordPage
          token={resetToken}
          onBack={() => setCurrentScreen('landing')}
          onBackToLogin={() => setCurrentScreen('login')}
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
            onResumeSetup={handleResumeSetup}
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
          <SetupScreen
            onComplete={handleSetupComplete}
            onSaveAndExit={handleSaveAndExitSetup}
            existingLeague={resumingLeague || undefined}
            onLeagueCreated={handleSetupLeagueCreated}
            onLeagueUpdated={handleSetupLeagueUpdated}
          />

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