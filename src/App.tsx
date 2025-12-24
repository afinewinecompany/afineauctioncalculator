import { useState, useEffect } from 'react';
import { LeagueSettings, Player, SavedLeague, UserData } from './lib/types';
import { generateMockPlayers } from './lib/mockData';
import { calculateLeagueAuctionValues, convertToPlayers } from './lib/auctionApi';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { LeaguesList } from './components/LeaguesList';
import { SetupScreen } from './components/SetupScreen';
import { DraftRoom } from './components/DraftRoom';
import { PostDraftAnalysis } from './components/PostDraftAnalysis';
import { TopMenuBar } from './components/TopMenuBar';

type AppScreen = 'landing' | 'login' | 'leagues' | 'setup' | 'draft' | 'analysis';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentLeague, setCurrentLeague] = useState<SavedLeague | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [finalRoster, setFinalRoster] = useState<any[]>([]);
  const [isLoadingProjections, setIsLoadingProjections] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  // Load user data from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('fantasyBaseballUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserData(user);
      setCurrentScreen('leagues');
    }
  }, []);

  // Save user data to localStorage whenever it changes
  useEffect(() => {
    if (userData) {
      localStorage.setItem('fantasyBaseballUser', JSON.stringify(userData));
    }
  }, [userData]);

  const handleLogin = (email: string, authProvider: 'email' | 'google', googleData?: { name: string; picture: string }) => {
    // Derive username from email or use Google name
    const username = authProvider === 'google' && googleData 
      ? googleData.name 
      : email.split('@')[0];

    const newUserData: UserData = {
      username,
      email,
      leagues: [],
      authProvider,
      profilePicture: googleData?.picture
    };
    
    setUserData(newUserData);
    setCurrentScreen('leagues');
  };

  const handleLogout = () => {
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
    setIsLoadingProjections(true);
    setProjectionError(null);

    try {
      // Fetch projections and calculate auction values based on league settings
      const calculatedValues = await calculateLeagueAuctionValues(settings);
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
      setIsLoadingProjections(false);
    }
  };

  const handleContinueDraft = (league: SavedLeague) => {
    setCurrentLeague(league);
    setPlayers(league.players);
    
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

  const handleSwitchLeague = (league: SavedLeague) => {
    setCurrentLeague(league);
    setPlayers(league.players);
    
    if (league.status === 'complete') {
      const myTeam = league.players.filter(p => p.status === 'onMyTeam');
      setFinalRoster(myTeam as any);
      setCurrentScreen('analysis');
    } else {
      setCurrentScreen('draft');
    }
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
    <>
      {currentScreen === 'landing' && (
        <LandingPage onGetStarted={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onBack={() => setCurrentScreen('landing')}
        />
      )}

      {currentScreen === 'leagues' && userData && (
        <LeaguesList
          username={userData.username}
          leagues={userData.leagues}
          onCreateNew={handleCreateNewLeague}
          onContinueDraft={handleContinueDraft}
          onDeleteLeague={handleDeleteLeague}
          onLogout={handleLogout}
          profilePicture={userData.profilePicture}
        />
      )}

      {currentScreen === 'setup' && userData && (
        <>
          <TopMenuBar
            currentLeague={null}
            allLeagues={userData.leagues}
            onGoToDashboard={handleBackToLeagues}
            onSwitchLeague={handleSwitchLeague}
            showLeagueSelector={false}
          />
          <SetupScreen onComplete={handleSetupComplete} />
          {isLoadingProjections && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center max-w-md">
                <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <h3 className="text-white text-xl mb-2">Loading Projections</h3>
                <p className="text-slate-400">Fetching player projections and calculating auction values based on your league settings...</p>
              </div>
            </div>
          )}
          {projectionError && (
            <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 rounded-xl p-4 max-w-md z-50">
              <p className="text-red-200">Failed to load projections: {projectionError}</p>
              <p className="text-red-300 text-sm mt-1">Using fallback mock data instead.</p>
            </div>
          )}
        </>
      )}

      {currentScreen === 'draft' && currentLeague && userData && (
        <>
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
        </>
      )}

      {currentScreen === 'analysis' && currentLeague && userData && (
        <>
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
        </>
      )}
    </>
  );
}