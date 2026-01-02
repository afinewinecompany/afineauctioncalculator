/**
 * Chat Context Builder
 *
 * Builds the system prompt for the draft assistant based on the current
 * draft state. Keeps prompts concise (~500 tokens) to minimize costs.
 */

export interface DraftContext {
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
 * Build the system prompt with current draft context
 */
export function buildDraftContext(context: DraftContext): string {
  const parts: string[] = [
    'You are an expert fantasy baseball auction draft assistant. Help users make strategic bidding decisions during live auctions.',
    'Be concise and actionable - users are in active auctions and need quick answers.',
    'Consider inflation, positional scarcity, and budget constraints in all recommendations.',
    '',
    '## Current Draft State',
  ];

  // Budget info
  if (context.moneyRemaining !== undefined) {
    parts.push(`**Budget Remaining:** $${context.moneyRemaining}`);
  }

  // Inflation
  if (context.inflationRate !== undefined) {
    const pct = (context.inflationRate * 100).toFixed(1);
    const sign = context.inflationRate >= 0 ? '+' : '';
    parts.push(`**Current Inflation:** ${sign}${pct}%`);
  }

  // Roster needs
  if (context.rosterNeedsRemaining) {
    const needs = Object.entries(context.rosterNeedsRemaining)
      .filter(([, count]) => count > 0)
      .map(([pos, count]) => `${pos}: ${count}`)
      .join(', ');
    if (needs) {
      parts.push(`**Roster Needs:** ${needs}`);
    }
  }

  // Current roster (limit to top 10 for token efficiency)
  if (context.myRoster && context.myRoster.length > 0) {
    parts.push('');
    parts.push(`**My Roster (${context.myRoster.length} players):**`);
    context.myRoster.slice(0, 10).forEach((p) => {
      parts.push(`- ${p.name} (${p.positions.join('/')}) - $${p.draftedPrice}`);
    });
    if (context.myRoster.length > 10) {
      parts.push(`... and ${context.myRoster.length - 10} more`);
    }
  }

  // Current auction
  if (context.currentAuction) {
    parts.push('');
    parts.push('**Currently On Block:**');
    parts.push(`- ${context.currentAuction.playerName}`);
    parts.push(`- Current Bid: $${context.currentAuction.currentBid}`);
    if (context.currentAuction.adjustedValue !== undefined) {
      parts.push(
        `- Inflation-Adjusted Value: $${context.currentAuction.adjustedValue.toFixed(0)}`
      );
    }
  }

  // Top available players (limit to 10)
  if (context.topAvailablePlayers && context.topAvailablePlayers.length > 0) {
    parts.push('');
    parts.push('**Top Available Players:**');
    context.topAvailablePlayers.slice(0, 10).forEach((p) => {
      const tierStr = p.tier ? ` (Tier ${p.tier})` : '';
      parts.push(
        `- ${p.name} (${p.positions.join('/')}) - $${p.adjustedValue.toFixed(0)}${tierStr}`
      );
    });
  }

  // Positional scarcity alerts
  if (context.positionalScarcity && context.positionalScarcity.length > 0) {
    const alerts = context.positionalScarcity
      .filter((ps) => ps.scarcityLevel === 'severe' || ps.scarcityLevel === 'moderate')
      .map((ps) => `${ps.position}: ${ps.scarcityLevel}`);
    if (alerts.length > 0) {
      parts.push('');
      parts.push(`**Position Scarcity Alerts:** ${alerts.join(', ')}`);
    }
  }

  // Instructions
  parts.push('');
  parts.push('## Instructions');
  parts.push('- Answer questions about auction strategy, player values, and bidding');
  parts.push('- Consider budget constraints when recommending bids');
  parts.push('- Warn about overpaying (bid > inflation-adjusted value)');
  parts.push('- Suggest alternatives when a player is too expensive');
  parts.push('- Be brief - 2-3 sentences for most answers');

  return parts.join('\n');
}
