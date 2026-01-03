import { useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChatBubble } from './ChatBubble';
import { ChatWindow } from './ChatWindow';
import { ChatMessageData } from './ChatMessage';
import {
  sendChatMessage,
  checkChatStatus,
  ChatDraftContext,
  ChatHistoryMessage,
  CategoryLeaders,
} from '../../lib/chatApi';
import type { Player, LeagueSettings } from '../../lib/types';
import type { InflationResult } from '../../lib/calculations';

/**
 * Build category leaders from available players
 * Returns top 5 players for each major category
 */
function buildCategoryLeaders(players: Player[]): CategoryLeaders {
  const available = players.filter((p) => p.status === 'available');
  const TOP_N = 5;

  const getTopN = (
    stat: keyof NonNullable<Player['projectedStats']>,
    isLowerBetter = false
  ): Array<{ name: string; value: number }> => {
    return available
      .filter((p) => p.projectedStats?.[stat] != null)
      .sort((a, b) => {
        const aVal = a.projectedStats?.[stat] ?? 0;
        const bVal = b.projectedStats?.[stat] ?? 0;
        return isLowerBetter ? aVal - bVal : bVal - aVal;
      })
      .slice(0, TOP_N)
      .map((p) => ({
        name: p.name,
        value: p.projectedStats?.[stat] ?? 0,
      }));
  };

  return {
    HR: getTopN('HR'),
    RBI: getTopN('RBI'),
    R: getTopN('R'),
    SB: getTopN('SB'),
    AVG: getTopN('AVG'),
    W: getTopN('W'),
    K: getTopN('K'),
    SV: getTopN('SV'),
    ERA: getTopN('ERA', true), // Lower is better
    WHIP: getTopN('WHIP', true), // Lower is better
  };
}

interface ChatAssistantProps {
  myRoster: Player[];
  moneyRemaining: number;
  rosterNeedsRemaining: Record<string, number>;
  inflationRate: number;
  players: Player[];
  inflationResult?: InflationResult;
  leagueSettings: LeagueSettings;
  currentAuction?: {
    playerName: string;
    currentBid: number;
  };
}

export function ChatAssistant({
  myRoster,
  moneyRemaining,
  rosterNeedsRemaining,
  inflationRate,
  players,
  inflationResult,
  leagueSettings,
  currentAuction,
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Check if chat service is available on mount
  useEffect(() => {
    checkChatStatus()
      .then((status) => setIsAvailable(status.available))
      .catch(() => setIsAvailable(false));
  }, []);

  // Build draft context for API
  const draftContext: ChatDraftContext = useMemo(() => {
    // Get top available players sorted by adjusted value
    const topAvailable = players
      .filter((p) => p.status === 'available')
      .sort((a, b) => b.adjustedValue - a.adjustedValue)
      .slice(0, 15)
      .map((p) => ({
        name: p.name,
        positions: p.positions,
        adjustedValue: p.adjustedValue,
        tier: p.tier,
      }));

    // Find current on-block player if any
    const onBlockPlayer = players.find((p) => p.status === 'on_block');

    // Build category leaders for targeted recommendations
    const categoryLeaders = buildCategoryLeaders(players);

    // Build dynasty info if applicable
    const isDynasty = leagueSettings.leagueType === 'dynasty';
    const dynastyInfo = isDynasty
      ? {
          isDynasty: true,
          rankingsSource: leagueSettings.dynastySettings?.rankingsSource,
          // Get top dynasty prospects from available players (sorted by adjusted value for dynasty)
          topDynastyProspects: players
            .filter((p) => p.status === 'available')
            .sort((a, b) => b.adjustedValue - a.adjustedValue)
            .slice(0, 10)
            .map((p) => ({
              name: p.name,
              rank: p.tier || 0, // Use tier as rough rank proxy
              adjustedValue: p.adjustedValue,
            })),
        }
      : undefined;

    return {
      myRoster: myRoster.map((p) => ({
        name: p.name,
        positions: p.positions,
        draftedPrice: p.draftedPrice || 0,
      })),
      moneyRemaining,
      rosterNeedsRemaining,
      inflationRate,
      topAvailablePlayers: topAvailable,
      currentAuction: onBlockPlayer
        ? {
            playerName: onBlockPlayer.name,
            currentBid: onBlockPlayer.currentBid || 0,
            adjustedValue: onBlockPlayer.adjustedValue,
          }
        : currentAuction,
      positionalScarcity: inflationResult?.positionalScarcity?.map((ps) => ({
        position: ps.position,
        scarcityLevel: ps.scarcityLevel,
      })),
      // New fields for projection context
      projectionSystem: leagueSettings.projectionSystem,
      season: new Date().getFullYear(),
      scoringType: leagueSettings.scoringType,
      categoryLeaders,
      dynastyInfo,
    };
  }, [
    myRoster,
    moneyRemaining,
    rosterNeedsRemaining,
    inflationRate,
    players,
    inflationResult,
    currentAuction,
    leagueSettings,
  ]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        // Build conversation history from existing messages (limit to last 20)
        const conversationHistory: ChatHistoryMessage[] = messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendChatMessage(content, conversationHistory, draftContext);

        const assistantMessage: ChatMessageData = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get response');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, draftContext]
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Don't render if chat service is not available
  if (isAvailable === false) {
    return null;
  }

  // Show nothing while checking availability
  if (isAvailable === null) {
    return null;
  }

  return (
    <>
      <ChatBubble isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} hasUnread={false} />
      <AnimatePresence>
        {isOpen && (
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSendMessage={handleSendMessage}
            onClose={() => setIsOpen(false)}
            onClear={handleClearChat}
          />
        )}
      </AnimatePresence>
    </>
  );
}
