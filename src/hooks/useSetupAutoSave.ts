/**
 * Auto-save hook for league setup wizard
 *
 * Handles:
 * - Debounced saves to localStorage (2-second delay)
 * - Immediate saves to backend on step navigation
 * - Save status tracking for UI feedback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LeagueSettings, SavedLeague } from '../lib/types';
import { createLeague, updateLeague } from '../lib/leaguesApi';
import { defaultLeagueSettings } from '../lib/mockData';

const LOCALSTORAGE_KEY = 'fantasyBaseballDraftSetup';
const DEBOUNCE_MS = 2000;

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export interface UseSetupAutoSaveReturn extends AutoSaveState {
  saveNow: () => Promise<void>;
  clearDraft: () => void;
}

/**
 * Load draft setup from localStorage
 */
export function loadDraftSetup(): { settings: LeagueSettings; step: number; leagueId: string | null } | null {
  try {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Validate basic structure
    if (!parsed.settings || typeof parsed.step !== 'number') {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      return null;
    }

    return {
      settings: { ...defaultLeagueSettings, ...parsed.settings },
      step: parsed.step,
      leagueId: parsed.leagueId || null,
    };
  } catch (error) {
    console.error('[useSetupAutoSave] Failed to load draft setup:', error);
    localStorage.removeItem(LOCALSTORAGE_KEY);
    return null;
  }
}

/**
 * Clear draft setup from localStorage
 */
export function clearDraftSetup(): void {
  localStorage.removeItem(LOCALSTORAGE_KEY);
}

/**
 * Hook for auto-saving league setup progress
 *
 * @param leagueId - Existing league ID (null for new leagues)
 * @param settings - Current league settings
 * @param currentStep - Current wizard step (1-5)
 * @param onLeagueCreated - Callback when a new league is created (returns new ID)
 * @param onLeagueUpdated - Callback when league is updated in backend
 */
export function useSetupAutoSave(
  leagueId: string | null,
  settings: LeagueSettings,
  currentStep: number,
  onLeagueCreated?: (league: SavedLeague) => void,
  onLeagueUpdated?: (league: SavedLeague) => void
): UseSetupAutoSaveReturn {
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    error: null,
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStepRef = useRef<number>(currentStep);
  const leagueIdRef = useRef<string | null>(leagueId);
  const isSavingRef = useRef(false);

  // Update leagueIdRef when it changes
  useEffect(() => {
    leagueIdRef.current = leagueId;
  }, [leagueId]);

  /**
   * Save to localStorage (fast, local)
   */
  const saveToLocalStorage = useCallback(() => {
    try {
      const data = {
        settings,
        step: currentStep,
        leagueId: leagueIdRef.current,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[useSetupAutoSave] Failed to save to localStorage:', error);
    }
  }, [settings, currentStep]);

  /**
   * Save to backend (slower, persistent)
   */
  const saveToBackend = useCallback(async (): Promise<SavedLeague | null> => {
    // Prevent concurrent saves
    if (isSavingRef.current) return null;
    isSavingRef.current = true;

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const leagueData: SavedLeague = {
        id: leagueIdRef.current || `draft-${Date.now()}`,
        leagueName: settings.leagueName || 'Untitled League',
        settings,
        players: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        status: 'setup',
        setupStep: currentStep,
      };

      let savedLeague: SavedLeague;

      if (leagueIdRef.current && !leagueIdRef.current.startsWith('draft-')) {
        // Update existing league
        savedLeague = await updateLeague(leagueIdRef.current, leagueData);
        onLeagueUpdated?.(savedLeague);
      } else {
        // Create new league
        savedLeague = await createLeague(leagueData);
        leagueIdRef.current = savedLeague.id;

        // Update localStorage with new ID
        saveToLocalStorage();

        onLeagueCreated?.(savedLeague);
      }

      setState({
        isSaving: false,
        lastSaved: new Date(),
        error: null,
      });

      return savedLeague;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      console.error('[useSetupAutoSave] Failed to save to backend:', error);

      setState(prev => ({
        ...prev,
        isSaving: false,
        error: message,
      }));

      return null;
    } finally {
      isSavingRef.current = false;
    }
  }, [settings, currentStep, saveToLocalStorage, onLeagueCreated, onLeagueUpdated]);

  /**
   * Public method to trigger immediate save
   */
  const saveNow = useCallback(async () => {
    // Clear any pending debounced save
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    saveToLocalStorage();
    await saveToBackend();
  }, [saveToLocalStorage, saveToBackend]);

  /**
   * Clear draft from localStorage
   */
  const clearDraft = useCallback(() => {
    clearDraftSetup();
    leagueIdRef.current = null;
  }, []);

  /**
   * Debounced save on settings changes
   */
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Save to localStorage immediately for quick recovery
    saveToLocalStorage();

    // Debounce backend save
    debounceTimer.current = setTimeout(() => {
      saveToBackend();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [settings, saveToLocalStorage, saveToBackend]);

  /**
   * Immediate save on step change
   */
  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep;

      // Clear debounce timer and save immediately
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      saveToLocalStorage();
      saveToBackend();
    }
  }, [currentStep, saveToLocalStorage, saveToBackend]);

  return {
    ...state,
    saveNow,
    clearDraft,
  };
}
