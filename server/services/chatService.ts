/**
 * Chat Service - Groq LLM Integration
 *
 * Handles sending chat requests to Groq's API for the draft assistant.
 * Uses Llama 3.1 8B Instant model (~$0.05/M tokens).
 */

import { logger } from './logger.js';
import { chatConfig } from '../config/env.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GroqErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Get a chat response from Groq API
 *
 * @param userMessage - The user's message
 * @param systemPrompt - The system prompt with draft context
 * @param conversationHistory - Previous messages in the conversation
 * @returns The assistant's response
 */
export async function getChatResponse(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!chatConfig.isEnabled || !chatConfig.apiKey) {
    logger.warn('Chat assistant not configured - GROQ_API_KEY not set');
    throw new Error('Chat assistant is not configured');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chatConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chatConfig.model,
        messages,
        max_tokens: chatConfig.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Groq API error: ${response.status}`;

      try {
        const errorData: GroqErrorResponse = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // Use default error message if parsing fails
      }

      logger.error(
        { status: response.status, error: errorText },
        'Groq API request failed'
      );

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key configuration.');
      }

      throw new Error(errorMessage);
    }

    const data: GroqResponse = await response.json();

    logger.info(
      {
        model: data.model,
        tokens: data.usage.total_tokens,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
      'Chat response generated'
    );

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from chat assistant');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      logger.error({ error }, 'Network error connecting to Groq API');
      throw new Error('Unable to connect to chat service. Please try again.');
    }

    logger.error({ error }, 'Chat request failed');
    throw error;
  }
}

/**
 * Check if chat service is available
 */
export function isChatServiceAvailable(): boolean {
  return chatConfig.isEnabled;
}
