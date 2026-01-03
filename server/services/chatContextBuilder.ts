/**
 * Chat Context Builder
 *
 * Builds the system prompt for the draft assistant based on the current
 * draft state. Keeps prompts concise (~500 tokens) to minimize costs.
 */

export interface CategoryLeaders {
  HR?: Array<{ name: string; value: number }>;
  RBI?: Array<{ name: string; value: number }>;
  R?: Array<{ name: string; value: number }>;
  SB?: Array<{ name: string; value: number }>;
  AVG?: Array<{ name: string; value: number }>;
  W?: Array<{ name: string; value: number }>;
  K?: Array<{ name: string; value: number }>;
  SV?: Array<{ name: string; value: number }>;
  ERA?: Array<{ name: string; value: number }>;
  WHIP?: Array<{ name: string; value: number }>;
}

export interface DynastyRankingEntry {
  name: string;
  rank: number;
  adjustedValue: number;
}

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
  /** Projection system being used */
  projectionSystem?: 'steamer' | 'batx' | 'ja';
  /** Current season year */
  season?: number;
  /** League scoring type */
  scoringType?: 'rotisserie' | 'h2h-categories' | 'h2h-points';
  /** Category leaders from available players */
  categoryLeaders?: CategoryLeaders;
  /** Dynasty league info */
  dynastyInfo?: {
    isDynasty: boolean;
    rankingsSource?: 'harryknowsball' | 'custom';
    topDynastyProspects?: DynastyRankingEntry[];
  };
}

/** Map projection system codes to display names */
const PROJECTION_NAMES: Record<string, string> = {
  steamer: 'Steamer',
  batx: 'THE BAT X',
  ja: 'JA Projections',
};

/**
 * Build the system prompt with current draft context
 */
export function buildDraftContext(context: DraftContext): string {
  const projectionName = context.projectionSystem
    ? PROJECTION_NAMES[context.projectionSystem] || context.projectionSystem
    : 'projected';
  const season = context.season || new Date().getFullYear();
  const isDynasty = context.dynastyInfo?.isDynasty || false;
  const leagueType = isDynasty ? 'dynasty' : 'redraft';

  const parts: string[] = [
    `You are an expert fantasy baseball auction draft assistant for the ${season} season.`,
    `This is a ${leagueType} league using ${projectionName} projections.`,
    'Help users make strategic bidding decisions during live auctions.',
    'Be concise and actionable - users are in active auctions and need quick answers.',
    '',
    '## CRITICAL RULES',
    `- ONLY recommend players from the data provided below. These are the ${season} projections for this league.`,
    '- The player lists below ONLY contain players who are AVAILABLE or currently ON THE BLOCK. Drafted players are excluded.',
    '- NEVER recommend or mention players who have already been drafted - they are not in the data because they are unavailable.',
    '- NEVER mention players not in the "Top Available Players" or "Category Leaders" lists.',
    '- If asked about a specific player not in the data, say they have either already been drafted or are not in this projection set.',
    '- All player values shown are inflation-adjusted auction values based on the league settings.',
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

  // Category leaders - key for targeted recommendations
  if (context.categoryLeaders) {
    parts.push('');
    parts.push('## Category Leaders (Available Players)');
    parts.push('Use these players when recommending targets for specific categories:');

    const formatLeaders = (
      category: string,
      leaders: Array<{ name: string; value: number }> | undefined,
      isRate = false
    ) => {
      if (!leaders || leaders.length === 0) return;
      const formatted = leaders
        .slice(0, 3)
        .map((p) => `${p.name} (${isRate ? p.value.toFixed(3) : p.value})`)
        .join(', ');
      parts.push(`- **${category}:** ${formatted}`);
    };

    // Hitting categories
    formatLeaders('HR', context.categoryLeaders.HR);
    formatLeaders('RBI', context.categoryLeaders.RBI);
    formatLeaders('R', context.categoryLeaders.R);
    formatLeaders('SB', context.categoryLeaders.SB);
    formatLeaders('AVG', context.categoryLeaders.AVG, true);

    // Pitching categories
    formatLeaders('W', context.categoryLeaders.W);
    formatLeaders('K', context.categoryLeaders.K);
    formatLeaders('SV', context.categoryLeaders.SV);
    formatLeaders('ERA', context.categoryLeaders.ERA, true);
    formatLeaders('WHIP', context.categoryLeaders.WHIP, true);
  }

  // Dynasty info
  if (context.dynastyInfo?.isDynasty) {
    parts.push('');
    parts.push('## Dynasty League Context');
    if (context.dynastyInfo.rankingsSource) {
      const sourceName =
        context.dynastyInfo.rankingsSource === 'harryknowsball'
          ? 'Harry Knows Ball'
          : 'Custom Rankings';
      parts.push(`**Rankings Source:** ${sourceName}`);
    }
    if (
      context.dynastyInfo.topDynastyProspects &&
      context.dynastyInfo.topDynastyProspects.length > 0
    ) {
      parts.push('**Top Dynasty Assets (Available):**');
      context.dynastyInfo.topDynastyProspects.slice(0, 5).forEach((p) => {
        parts.push(`- ${p.name} - $${p.adjustedValue.toFixed(0)}`);
      });
    }
    parts.push('');
    parts.push('*Consider long-term value and age when making dynasty recommendations.*');
  }

  // Instructions
  parts.push('');
  parts.push('## Instructions');
  parts.push('- Answer questions about auction strategy, player values, and bidding');
  parts.push('- Consider budget constraints when recommending bids');
  parts.push('- Warn about overpaying (bid > inflation-adjusted value)');
  parts.push('- Suggest alternatives when a player is too expensive');
  parts.push('- When asked for category targets, ONLY use players from the Category Leaders list above');
  parts.push('- Be brief - 2-3 sentences for most answers');

  return parts.join('\n');
}
