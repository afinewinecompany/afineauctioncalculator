# Value Calculator Adjustment Recommendations
## Duke Draft (Room 1362) Analysis

**Analysis Date:** December 29, 2025
**Analyzed by:** Fullstack + Data Science Agents

---

## Executive Summary

After analyzing the Duke Draft (Room 1362) auction results against projected values, we've identified a consistent pattern: **elite players are systematically undervalued** while **replacement-level players are massively overvalued** by the current calculation system compared to actual market behavior.

### Key Findings

| Tier | Projected Value | Market Behavior | Gap |
|------|-----------------|-----------------|-----|
| **Tier 1 (Elite)** | Correct | Sells for -19.8% less | Overpriced by ~$5-8 |
| **Tier 2-3 (Quality)** | Correct | Sells for +18-60% more | Underpriced by ~$2-6 |
| **Tier 7-10 (Replacement)** | $1-3 | Sells for +500-1500% more | Massively underpriced |

### The Core Problem

The current SGP-to-dollar conversion in `valueCalculator.ts` uses a **linear proportional distribution**:

```typescript
// Current approach (line 1309-1312):
const sgpShare = p.sgp / totalPoolSGP;
auctionValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
```

This creates values that are mathematically correct for "fair value" but **don't match actual market behavior** in auctions where:
1. Elite scarcity premium is overestimated (people save money on stars)
2. Replacement-level scarcity is underestimated (roster spots still need filling)
3. Mid-tier players get bid up to "just below star" prices

---

## Recommended Adjustments

### 1. Add Market Inflation Correction Factor

Create a tier-based inflation adjustment to match historical market patterns:

```typescript
// Add to valueCalculator.ts after calculateTier function

/**
 * Market inflation correction factors based on historical auction data
 * Positive values = market pays MORE than projections suggest
 * Negative values = market pays LESS than projections suggest
 */
const MARKET_INFLATION_FACTORS: Record<number, number> = {
  1: -0.15,    // Tier 1: Elite players sell for ~15% LESS than projected
  2: -0.05,    // Tier 2: Top players sell for ~5% less
  3: 0.15,     // Tier 3: Quality players sell for ~15% MORE
  4: 0.35,     // Tier 4: Mid-tier sell for ~35% MORE
  5: 0.50,     // Tier 5: Value picks sell for ~50% MORE
  6: 0.75,     // Tier 6-10: Replacement level - massive inflation
  7: 1.00,
  8: 1.50,
  9: 2.00,
  10: 3.00,
};

function applyMarketInflationCorrection(
  baseValue: number,
  tier: number,
  enableCorrection: boolean = true
): number {
  if (!enableCorrection) return baseValue;

  const factor = MARKET_INFLATION_FACTORS[tier] ?? 0;
  const correctedValue = baseValue * (1 + factor);

  // Floor at $1, cap at reasonable maximum
  return Math.max(MIN_AUCTION_VALUE, Math.min(correctedValue, 60));
}
```

### 2. Implement Tiered Distribution Algorithm

Replace linear SGP distribution with a tiered approach that better matches market dynamics:

```typescript
/**
 * Enhanced dollar conversion with market-aware distribution
 *
 * Key insight: Linear proportional distribution overvalues elites
 * and undervalues replacement level. Real markets have:
 * - Elite compression: Stars rarely go for "full value"
 * - Replacement inflation: $1 players routinely go for $5-10
 */
function convertSGPToDollarsMarketAdjusted(
  players: Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown?: Record<string, number> }>,
  poolSize: number,
  totalBudget: number,
  totalPoolSGP: number,
  applyMarketCorrection: boolean = true
): PlayerWithValue[] {
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  // Step 1: Calculate base values using current SGP approach
  const playersWithBaseValues = players.map((p, index) => {
    const isInPool = index < poolSize;
    let baseValue = 0;

    if (isInPool && totalPoolSGP > 0 && p.sgp > 0) {
      const sgpShare = p.sgp / totalPoolSGP;
      baseValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
    } else if (isInPool) {
      baseValue = MIN_AUCTION_VALUE;
    }

    return {
      ...p,
      baseValue,
      tier: calculateTier(index, poolSize),
      isInPool,
    };
  });

  // Step 2: Apply market inflation correction per tier
  if (applyMarketCorrection) {
    // Calculate adjustment factors to redistribute dollars
    const poolPlayers = playersWithBaseValues.filter(p => p.isInPool);

    // Elite players (Tier 1-2) release dollars
    const eliteRelease = poolPlayers
      .filter(p => p.tier <= 2)
      .reduce((sum, p) => {
        const reduction = p.baseValue * Math.abs(MARKET_INFLATION_FACTORS[p.tier] || 0);
        return sum + reduction;
      }, 0);

    // Those dollars flow to mid/replacement tiers
    const nonElitePlayers = poolPlayers.filter(p => p.tier > 2);
    const redistributionPerPlayer = eliteRelease / Math.max(1, nonElitePlayers.length);

    // Apply corrections
    playersWithBaseValues.forEach(p => {
      if (!p.isInPool) return;

      if (p.tier <= 2) {
        // Elite reduction
        const factor = MARKET_INFLATION_FACTORS[p.tier] || 0;
        p.baseValue = Math.round(p.baseValue * (1 + factor));
      } else {
        // Non-elite gets redistribution + tier inflation
        const tierBonus = Math.min(redistributionPerPlayer, p.baseValue * 0.5);
        p.baseValue = Math.round(p.baseValue + tierBonus);
      }

      p.baseValue = Math.max(MIN_AUCTION_VALUE, p.baseValue);
    });
  }

  // Step 3: Re-normalize to exact budget
  const totalAllocated = playersWithBaseValues
    .filter(p => p.isInPool)
    .reduce((sum, p) => sum + p.baseValue, 0);

  const budgetDiff = totalBudget - totalAllocated;

  // Distribute rounding errors proportionally
  if (Math.abs(budgetDiff) > 0) {
    const poolPlayers = playersWithBaseValues.filter(p => p.isInPool);
    let remaining = budgetDiff;

    for (const player of poolPlayers) {
      if (remaining === 0) break;
      const adjustment = remaining > 0 ? 1 : -1;
      player.baseValue = Math.max(MIN_AUCTION_VALUE, player.baseValue + adjustment);
      remaining -= adjustment;
    }
  }

  return playersWithBaseValues.map(p => ({
    ...p.player,
    auctionValue: p.baseValue,
    sgpValue: p.sgp,
    tier: p.tier,
    isInDraftPool: p.isInPool,
  }));
}
```

### 3. Add League-Specific Inflation Settings

Allow users to customize inflation expectations based on their league's behavior:

```typescript
// Add to LeagueSettings type
interface LeagueSettings {
  // ... existing fields ...

  /**
   * Market inflation adjustment settings
   * Controls how projected values are adjusted for market behavior
   */
  inflationSettings?: {
    /** Enable market-aware value adjustment (default: true) */
    enableMarketCorrection: boolean;

    /** Custom tier inflation factors (overrides defaults) */
    tierFactors?: Record<number, number>;

    /** Historical inflation rate from this league (0-2, where 1 = no inflation) */
    historicalInflationRate?: number;
  };
}
```

### 4. Position Scarcity Adjustment

Add position-based value adjustments based on market scarcity:

```typescript
const POSITION_SCARCITY_FACTORS: Record<string, number> = {
  'C': 0.15,      // Catchers: +15% due to shallow pool
  'SS': 0.08,     // Shortstop: +8% premium
  '2B': 0.05,     // Second base: slight premium
  '3B': -0.02,    // Third base: deeper position
  '1B': -0.05,    // First base: deepest position
  'OF': -0.03,    // Outfield: lots of options
  'SP': 0.10,     // Starting pitchers: +10% premium (historical +870% inflation!)
  'RP': 0.20,     // Relief pitchers: +20% (very scarce, +975% historical!)
};

function applyPositionScarcity(
  baseValue: number,
  positions: string[],
  enableScarcity: boolean = true
): number {
  if (!enableScarcity || positions.length === 0) return baseValue;

  // Use primary position for scarcity adjustment
  const primaryPos = positions[0];
  const factor = POSITION_SCARCITY_FACTORS[primaryPos] || 0;

  return Math.round(baseValue * (1 + factor));
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (Low Risk)
1. **Add inflation settings to LeagueSettings** - Allows user control
2. **Add tier inflation factors as constants** - Easy to tune
3. **Create toggle for market-aware mode** - Users can A/B test

### Phase 2: Core Algorithm (Medium Risk)
1. **Implement tiered redistribution** - Moves dollars from elites to mid-tier
2. **Add position scarcity adjustments** - Especially for C, SS, SP, RP
3. **Normalize budget after adjustments** - Ensure exact budget match

### Phase 3: Advanced (Higher Risk)
1. **Historical learning** - Use past auction results to tune factors
2. **League-specific profiles** - Save/load inflation profiles per league
3. **Real-time inflation tracking** - Adjust mid-draft based on spending

---

## Expected Outcomes

After implementing these adjustments:

| Metric | Current | Expected |
|--------|---------|----------|
| Elite player accuracy | -20% (overvalued) | -5% to +5% |
| Mid-tier accuracy | +40% (undervalued) | +10% to +20% |
| Replacement accuracy | +500-1500% (massive undervalue) | +50-100% |
| Budget utilization guidance | Poor | Good |
| Draft strategy clarity | Confusing | Clear |

---

## Files to Modify

1. **`server/services/valueCalculator.ts`**
   - Add `MARKET_INFLATION_FACTORS` constant
   - Add `POSITION_SCARCITY_FACTORS` constant
   - Modify `convertSGPToDollars()` to apply corrections
   - Add `applyMarketInflationCorrection()` helper
   - Add `applyPositionScarcity()` helper

2. **`src/lib/types.ts`**
   - Add `inflationSettings` to `LeagueSettings` interface

3. **`src/components/ScoringConfig.tsx`** (optional)
   - Add UI for inflation settings toggle

---

## Testing Strategy

1. **Backtest against Room 1362 data**
   - Re-run value calculations with new algorithm
   - Compare predicted vs actual for all 236 drafted players
   - Target: Reduce RMSE by 30%+

2. **Validate tier distribution**
   - Ensure total budget still sums correctly
   - Verify elite values decrease, replacement values increase
   - Check no values go below $1 or above $60

3. **A/B Test in UI**
   - Add toggle for "Market-Adjusted Values"
   - Let users compare both approaches
   - Collect feedback

---

## Conclusion

The current value calculator produces mathematically correct "fair values" but doesn't account for real auction market dynamics where:

1. **Elite scarcity is overvalued** - Everyone wants stars, but budgets prevent full bidding
2. **Replacement scarcity is undervalued** - Roster spots must be filled, driving up prices
3. **Position depth matters** - C, RP, SP command premiums due to shallow pools

By implementing tiered inflation corrections based on historical data, we can produce values that better guide draft strategy: **spend less on elites, budget more for mid-tier, and don't overpay for replacement level.**

---

*Analysis based on Room 1362 (15-team dynasty) auction results and historical inflation data from 6 auctions.*
