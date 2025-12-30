#!/usr/bin/env python
"""
Comprehensive analysis of Duke Draft (Room 1362) auction data
Compares actual bids to historical patterns and generates insights
"""

import json
import statistics
from collections import defaultdict
from typing import Dict, List, Any

def load_data():
    """Load auction and historical data"""
    with open('cache/auctions/room-1362.json', 'r') as f:
        auction_data = json.load(f)

    with open('server/analysis/auction-inflation-analysis.json', 'r') as f:
        historical = json.load(f)

    return auction_data, historical

def extract_players(auction_data):
    """Extract drafted players from auction data"""
    all_players = [p for p in auction_data['data']['players']
                   if p.get('status') == 'drafted' and 'winningBid' in p]

    duke_players = [p for p in all_players if p.get('winningTeam') == 'Duke']

    return all_players, duke_players

def analyze_teams(all_players):
    """Analyze spending by team"""
    teams = defaultdict(lambda: {'players': [], 'total': 0})
    for p in all_players:
        team = p.get('winningTeam', 'Unknown')
        teams[team]['players'].append(p)
        teams[team]['total'] += p['winningBid']
    return teams

def analyze_positions(players):
    """Analyze spending by position"""
    position_stats = defaultdict(lambda: {'bids': [], 'count': 0})
    for p in players:
        for pos in p.get('positions', []):
            position_stats[pos]['bids'].append(p['winningBid'])
            position_stats[pos]['count'] += 1

    return {
        pos: {
            'count': stats['count'],
            'totalSpent': sum(stats['bids']),
            'avgBid': statistics.mean(stats['bids']),
            'medianBid': statistics.median(stats['bids']),
            'maxBid': max(stats['bids']),
            'minBid': min(stats['bids']),
            'stdDev': statistics.stdev(stats['bids']) if len(stats['bids']) > 1 else 0
        }
        for pos, stats in position_stats.items()
    }

def analyze_price_tiers(players):
    """Analyze spending by price tier"""
    tiers = [
        (1, 5, 'Filler ($1-$5)'),
        (6, 10, 'Value ($6-$10)'),
        (11, 15, 'Mid-tier ($11-$15)'),
        (16, 20, 'Quality ($16-$20)'),
        (21, 30, 'Star ($21-$30)'),
        (31, 999, 'Elite ($31+)')
    ]

    total_spent = sum(p['winningBid'] for p in players)

    return {
        label: {
            'minPrice': min_p,
            'maxPrice': max_p if max_p < 999 else None,
            'count': len([p for p in players if min_p <= p['winningBid'] <= max_p]),
            'totalSpent': sum(p['winningBid'] for p in players if min_p <= p['winningBid'] <= max_p),
            'percentOfTotal': (sum(p['winningBid'] for p in players if min_p <= p['winningBid'] <= max_p) / total_spent * 100) if total_spent > 0 else 0,
            'avgBid': statistics.mean([p['winningBid'] for p in players if min_p <= p['winningBid'] <= max_p]) if any(min_p <= p['winningBid'] <= max_p for p in players) else 0
        }
        for min_p, max_p, label in tiers
        if any(min_p <= p['winningBid'] <= max_p for p in players)
    }

def duke_position_breakdown(duke_players):
    """Get Duke's position breakdown"""
    duke_positions = defaultdict(list)
    for p in duke_players:
        for pos in p.get('positions', []):
            duke_positions[pos].append(p)

    return {
        pos: {
            'count': len(players),
            'totalSpent': sum(p['winningBid'] for p in players),
            'avgBid': statistics.mean([p['winningBid'] for p in players]),
            'players': [{'name': p['fullName'], 'bid': p['winningBid']} for p in players]
        }
        for pos, players in duke_positions.items()
    }

def compare_duke_to_league(duke_players, all_players):
    """Compare Duke's spending to league average by position"""
    league_pos_stats = analyze_positions(all_players)
    duke_pos_breakdown = duke_position_breakdown(duke_players)

    comparison = {}
    for pos, duke_data in duke_pos_breakdown.items():
        if pos in league_pos_stats:
            league_avg = league_pos_stats[pos]['avgBid']
            duke_avg = duke_data['avgBid']
            comparison[pos] = {
                'dukeAvg': duke_avg,
                'leagueAvg': league_avg,
                'difference': duke_avg - league_avg,
                'percentDiff': ((duke_avg - league_avg) / league_avg * 100) if league_avg > 0 else 0,
                'interpretation': 'overpaid' if duke_avg > league_avg else 'value'
            }

    return comparison

def generate_insights(duke_players, all_players, teams, historical):
    """Generate key insights and findings"""
    duke_total = sum(p['winningBid'] for p in duke_players)
    total_spent = sum(p['winningBid'] for p in all_players)
    num_teams = len(teams)
    expected_budget = 260

    insights = []

    # Budget analysis
    remaining_budget = expected_budget - duke_total
    budget_pct = (duke_total / expected_budget) * 100
    insights.append({
        'category': 'Budget Status',
        'finding': f'Duke has spent ${duke_total} of ${expected_budget} budget ({budget_pct:.1f}%), with ${remaining_budget} remaining',
        'implication': 'Moderate' if budget_pct < 80 else 'Low' if budget_pct < 90 else 'Very Low'
    })

    # Roster size
    avg_roster = len(all_players) / num_teams
    insights.append({
        'category': 'Roster Size',
        'finding': f'Duke has {len(duke_players)} players vs league average of {avg_roster:.1f}',
        'implication': 'Below average' if len(duke_players) < avg_roster else 'Above average'
    })

    # Average player cost
    duke_avg = duke_total / len(duke_players)
    league_avg = total_spent / len(all_players)
    insights.append({
        'category': 'Average Player Value',
        'finding': f'Duke\'s avg player cost: ${duke_avg:.1f} vs league avg: ${league_avg:.1f}',
        'implication': 'Targeting premium players' if duke_avg > league_avg else 'Value-focused strategy'
    })

    # Historical context
    hist_tier1_infl = historical['aggregate']['aggregateTierInflation'][0]['avgInflationRate']
    hist_elite_infl = historical['aggregate']['aggregatePriceRangeInflation'][3]['avgInflationRate']

    insights.append({
        'category': 'Historical Context - Elite Players',
        'finding': f'Historically, Tier 1 elite players show {hist_tier1_infl:.1f}% inflation (typically undervalued)',
        'implication': 'Elite players are historically the best value in auctions'
    })

    insights.append({
        'category': 'Historical Context - Budget Players',
        'finding': f'$1-$5 players show {historical["aggregate"]["aggregatePriceRangeInflation"][0]["avgInflationRate"]:.1f}% avg inflation',
        'implication': 'Budget players are consistently overvalued - avoid overpaying for replacement level'
    })

    return insights

def create_analysis():
    """Create comprehensive analysis"""

    print("Loading data...")
    auction_data, historical = load_data()

    print("Extracting players...")
    all_players, duke_players = extract_players(auction_data)

    print("Analyzing teams...")
    teams = analyze_teams(all_players)

    print("Analyzing positions...")
    league_pos_stats = analyze_positions(all_players)
    duke_pos_breakdown = duke_position_breakdown(duke_players)

    print("Analyzing price tiers...")
    league_price_tiers = analyze_price_tiers(all_players)
    duke_price_tiers = analyze_price_tiers(duke_players)

    print("Comparing Duke to league...")
    duke_vs_league = compare_duke_to_league(duke_players, all_players)

    print("Generating insights...")
    insights = generate_insights(duke_players, all_players, teams, historical)

    # Compile results
    duke_total = sum(p['winningBid'] for p in duke_players)
    total_spent = sum(p['winningBid'] for p in all_players)

    analysis = {
        'metadata': {
            'roomId': '1362',
            'leagueName': 'Duke Draft',
            'leagueType': '15-team dynasty',
            'projectionSystem': 'Steamer',
            'analysisDate': auction_data['metadata']['fetchedAt']
        },
        'leagueOverview': {
            'totalTeams': len(teams),
            'totalPlayersDrafted': len(all_players),
            'totalMoneySpent': total_spent,
            'averageSpendPerTeam': total_spent / len(teams),
            'expectedBudgetPerTeam': 260,
            'averageRosterSize': len(all_players) / len(teams),
            'budgetUtilization': (total_spent / (len(teams) * 260)) * 100
        },
        'dukeRoster': {
            'summary': {
                'playerCount': len(duke_players),
                'totalSpent': duke_total,
                'remainingBudget': 260 - duke_total,
                'budgetUtilization': (duke_total / 260) * 100,
                'averagePerPlayer': duke_total / len(duke_players)
            },
            'players': sorted([
                {
                    'name': p['fullName'],
                    'positions': p['positions'],
                    'winningBid': p['winningBid'],
                    'mlbTeam': p.get('mlbTeam', 'FA')
                }
                for p in duke_players
            ], key=lambda x: x['winningBid'], reverse=True),
            'positionBreakdown': duke_pos_breakdown,
            'priceTierBreakdown': duke_price_tiers
        },
        'leagueMarket': {
            'positionStats': league_pos_stats,
            'priceTierStats': league_price_tiers
        },
        'dukeVsLeague': {
            'positionComparison': duke_vs_league,
            'overallComparison': {
                'dukeAvgBid': duke_total / len(duke_players),
                'leagueAvgBid': total_spent / len(all_players),
                'difference': (duke_total / len(duke_players)) - (total_spent / len(all_players)),
                'percentDiff': (((duke_total / len(duke_players)) - (total_spent / len(all_players))) / (total_spent / len(all_players)) * 100) if len(all_players) > 0 else 0
            }
        },
        'teamComparison': {
            team: {
                'playerCount': len(data['players']),
                'totalSpent': data['total'],
                'avgPerPlayer': data['total'] / len(data['players']) if data['players'] else 0,
                'remainingBudget': 260 - data['total'],
                'budgetUtilization': (data['total'] / 260) * 100
            }
            for team, data in teams.items()
        },
        'historicalContext': {
            'summary': {
                'averageInflationRate': historical['aggregate']['avgOverallInflationRate'],
                'inflationStdDev': historical['aggregate']['stdDevInflationRate'],
                'inflationRange': {
                    'min': historical['aggregate']['minInflationRate'],
                    'max': historical['aggregate']['maxInflationRate']
                }
            },
            'tierInflationPatterns': historical['aggregate']['aggregateTierInflation'],
            'priceRangeInflation': historical['aggregate']['aggregatePriceRangeInflation'],
            'positionInflation': historical['aggregate']['aggregatePositionInflation']
        },
        'insights': insights,
        'keyFindings': [
            f"Duke has drafted {len(duke_players)} players for ${duke_total}, leaving ${260 - duke_total} remaining ({((260-duke_total)/260*100):.1f}% of budget)",
            f"Duke's average player cost: ${duke_total/len(duke_players):.1f} vs league average: ${total_spent/len(all_players):.1f}",
            f"League-wide budget utilization: {(total_spent/(len(teams)*260))*100:.1f}% (${total_spent:,} of ${len(teams)*260:,} total)",
            f"Historical data shows elite players (Tier 1) average {historical['aggregate']['aggregateTierInflation'][0]['avgInflationRate']:.1f}% inflation - typically undervalued",
            f"Premium price range ($31+) shows {historical['aggregate']['aggregatePriceRangeInflation'][3]['avgInflationRate']:.1f}% historical inflation",
            f"Budget tier ($1-$5) shows {historical['aggregate']['aggregatePriceRangeInflation'][0]['avgInflationRate']:.1f}% inflation - consistently overvalued"
        ],
        'recommendations': [
            "Focus remaining budget on value opportunities in mid-tier players ($16-$30 range)",
            "Historical data suggests elite players are typically undervalued - prioritize if available",
            "Avoid overpaying for replacement-level players in the $1-$5 range",
            f"With ${260 - duke_total} remaining and avg roster size of {len(all_players)/len(teams):.1f}, Duke needs approximately {int(len(all_players)/len(teams)) - len(duke_players)} more players",
            "Target positions where Duke has paid below league average for potential value adds"
        ]
    }

    # Save to file
    output_file = 'server/analysis/duke_draft_1362_analysis.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)

    print(f"\nAnalysis saved to: {output_file}")

    # Print summary
    print("\n" + "="*100)
    print("DUKE DRAFT (ROOM 1362) - ANALYSIS SUMMARY")
    print("="*100)
    print(f"\nDuke Roster: {len(duke_players)} players, ${duke_total} spent, ${260-duke_total} remaining")
    print(f"League Average: {len(all_players)/len(teams):.1f} players, ${total_spent/len(teams):.0f} spent per team")
    print("\nKey Insights:")
    for i, insight in enumerate(insights[:5], 1):
        print(f"{i}. [{insight['category']}] {insight['finding']}")

    return analysis

if __name__ == '__main__':
    analysis = create_analysis()
