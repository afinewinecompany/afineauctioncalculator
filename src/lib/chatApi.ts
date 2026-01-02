/**
 * Chat API Client
 *
 * Frontend API client for the LLM-powered draft assistant.
 */

// Get API base URL from environment variables
function getApiUrl(): string {
  const rawUrl = import.meta.env.VITE_API_URL;
  const isDev = import.meta.env.DEV;

  if (!rawUrl && !isDev) {
    throw new Error('VITE_API_URL environment variable is not configured.');
  }

  if (!rawUrl && isDev) {
    return '';
  }

  let url = rawUrl || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_URL = getApiUrl();
const CHAT_BASE = `${API_URL}/api/chat`;

/**
 * Draft context sent to the chat API
 */
export interface ChatDraftContext {
  myRoster?: Array<{
    name: string;
    positions: string[];
    draftedPrice: number;
  }>;
  moneyRemaining?: number;
  rosterNeedsRemaining?: Record<string, number>;
  inflationRate?: number;
  topAvailablePlayers?: Array<{
    name: string;
    positions: string[];
    adjustedValue: number;
    tier?: number;
  }>;
  currentAuction?: {
    playerName: string;
    currentBid: number;
    adjustedValue?: number;
  };
  positionalScarcity?: Array<{
    position: string;
    scarcityLevel: string;
  }>;
}

/**
 * Chat message in conversation history
 */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Response from the chat API
 */
interface ChatApiResponse {
  message: string;
  timestamp: string;
}

/**
 * Error response from the chat API
 */
interface ChatApiError {
  error: string;
  message?: string;
  retryAfter?: number;
}

/**
 * Chat service status response
 */
interface ChatStatusResponse {
  available: boolean;
  model: string | null;
}

/**
 * Check if the chat service is available
 */
export async function checkChatStatus(): Promise<ChatStatusResponse> {
  const response = await fetch(`${CHAT_BASE}/status`);

  if (!response.ok) {
    return { available: false, model: null };
  }

  return response.json();
}

/**
 * Send a message to the chat assistant
 *
 * @param message - The user's message
 * @param conversationHistory - Previous messages in the conversation
 * @param draftContext - Current draft state context
 * @returns The assistant's response
 */
export async function sendChatMessage(
  message: string,
  conversationHistory: ChatHistoryMessage[],
  draftContext: ChatDraftContext
): Promise<string> {
  const response = await fetch(CHAT_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversationHistory,
      draftContext,
    }),
  });

  if (!response.ok) {
    const errorData: ChatApiError = await response.json().catch(() => ({
      error: 'Unknown error',
    }));

    if (response.status === 429) {
      throw new Error(errorData.message || 'Too many requests. Please slow down.');
    }

    if (response.status === 503) {
      throw new Error('Chat assistant is not available.');
    }

    throw new Error(errorData.message || errorData.error || 'Failed to get response.');
  }

  const data: ChatApiResponse = await response.json();
  return data.message;
}
