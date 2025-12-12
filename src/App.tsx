import { useState, useEffect } from 'react';
import { LeagueSettings, Player, SavedLeague, UserData } from './lib/types';
import { generateMockPlayers } from './lib/mockData';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { LeaguesList } from './components/LeaguesList';
import { SetupScreen } from './components/SetupScreen';
import { DraftRoom } from './components/DraftRoom';
import { PostDraftAnalysis } from './components/PostDraftAnalysis';

type AppScreen = 'landing' | 'login' | 'leagues' | 'setup' | 'draft' | 'analysis';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentLeague, setCurrentLeague] = useState<SavedLeague | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [finalRoster, setFinalRoster] = useState<any[]>([]);

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

  const handleSetupComplete = (settings: LeagueSettings) => {
    const newLeague: SavedLeague = {
      id: `league-${Date.now()}`,
      leagueName: settings.leagueName,
      settings,
      players: generateMockPlayers(),
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

      {currentScreen === 'setup' && (
        <SetupScreen onComplete={handleSetupComplete} />
      )}

      {currentScreen === 'draft' && currentLeague && (
        <DraftRoom
          settings={currentLeague.settings}
          players={players}
          onComplete={handleDraftComplete}
        />
      )}

      {currentScreen === 'analysis' && currentLeague && (
        <PostDraftAnalysis
          roster={finalRoster}
          settings={currentLeague.settings}
          onRestart={handleBackToLeagues}
        />
      )}
    </>
  );
}