import { DollarSign, TrendingUp, Users, BarChart3, Target, Zap, LineChart, Shield, Clock } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          {/* Header */}
          <div className="text-center mb-16 animate-fadeIn">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/50">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-6xl mb-4 bg-gradient-to-r from-white via-emerald-200 to-white bg-clip-text text-transparent">
              Fantasy Baseball Auction Calculator
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Win your auction draft with AI-powered inflation tracking, live Couch Managers integration,
              and historical insights from real auctions. Know exactly when to bid and when to wait.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Tier-Weighted Inflation</h3>
              <p className="text-slate-400">
                Smart inflation tracking by player tier. Elite players often go below projection while $1-5 players see 1000%+ inflation. We account for this.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Live Couch Managers Sync</h3>
              <p className="text-slate-400">
                Auto-sync with your Couch Managers draft room. Player bids and team rosters update automatically every 2 minutes.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-red-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
                <LineChart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Historical Auction Intelligence</h3>
              <p className="text-slate-400">
                Built on analysis of real auctions. Know that SP/RP inflate heavily while elite hitters often go at a discount.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-purple-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.3s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Positional Scarcity Alerts</h3>
              <p className="text-slate-400">
                See which positions are running thin. Get inflation-adjusted values based on real-time supply and demand at each position.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.4s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-orange-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/30">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Effective Budget Tracking</h3>
              <p className="text-slate-400">
                See your true spending power. We calculate $1 reserves for remaining roster spots so you never accidentally overbid.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.5s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Steamer & JA Projections</h3>
              <p className="text-slate-400">
                Professional projections from FanGraphs Steamer and JA Projections. Calculated auction values tuned to your league settings.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center animate-fadeIn" style={{ animationDelay: '0.6s' }}>
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white text-lg rounded-xl hover:from-red-700 hover:to-red-900 transition-all shadow-2xl shadow-red-500/50 hover:shadow-red-500/70 hover:scale-105 transform"
            >
              Get Started - Login or Sign Up
            </button>
            <p className="mt-4 text-slate-400">
              Free to use • No credit card required • Save your drafts
            </p>
          </div>
        </div>
      </div>

      {/* Features Detail Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl text-white mb-6">How It Works</h2>
              <div className="space-y-4 text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">1</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Configure Your League</h4>
                    <p className="text-slate-400">Set team count, budget, roster positions, and paste your Couch Managers room ID for automatic syncing.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">2</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Watch Live Inflation</h4>
                    <p className="text-slate-400">As bids are placed, see tier-weighted inflation rates update. Elite players deflate, role players inflate massively.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">3</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Spot the Deals</h4>
                    <p className="text-slate-400">Color-coded values show you when a player is a steal (green), fair value (yellow), or overpay (red) based on current inflation.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">4</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Review Your Draft</h4>
                    <p className="text-slate-400">Post-draft analysis shows your best picks, biggest overpays, and total value gained vs. projections.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
              <h3 className="text-2xl text-white mb-4">Built For Serious Owners</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Roto, H2H Categories, and H2H Points with 100+ scoring categories</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Dynasty leagues with Harry Knows Ball rankings integration</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Any roster config: C, 1B, 2B, 3B, SS, OF, CI, MI, UTIL, SP, RP, P</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Slow auctions where you need values updated between nominations</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Split-screen optimized: run the calculator next to your draft</span>
                </li>
              </ul>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-lg text-white mb-3">Key Insights from Real Auctions:</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>• Elite $31+ players go 17% BELOW projection on average</li>
                  <li>• $1-5 players see 990%+ inflation - be cautious!</li>
                  <li>• SP/RP positions inflate 800-1300% more than projections</li>
                  <li>• Catchers consistently overpay due to scarcity</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
