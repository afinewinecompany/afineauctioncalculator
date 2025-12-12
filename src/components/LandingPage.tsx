import { DollarSign, TrendingUp, Users, BarChart3, Target, Zap } from 'lucide-react';

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
              Make optimal bidding decisions during live auctions with real-time inflation tracking, 
              dynamic value adjustments, and comprehensive draft analytics.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Real-Time Inflation Tracking</h3>
              <p className="text-slate-400">
                Player values automatically adjust as money leaves the auction pool, ensuring accurate valuations throughout your draft.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Slow Auction Support</h3>
              <p className="text-slate-400">
                Perfectly designed for slow auction drafts where nominations happen at different paces. Track bids as they're called out.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-red-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Multiple Projection Systems</h3>
              <p className="text-slate-400">
                Import projections from Steamer, BatX, or JA via API integration with Couch Manager auction rooms.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-purple-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.3s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Roster Management</h3>
              <p className="text-slate-400">
                Track position needs, budget remaining, and roster construction in real-time during your live draft.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.4s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-orange-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/30">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Color-Coded Values</h3>
              <p className="text-slate-400">
                Instantly see great deals, fair values, and overpays with intuitive color indicators and value comparisons.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft" style={{ animationDelay: '0.5s' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl text-white mb-2">Post-Draft Analysis</h3>
              <p className="text-slate-400">
                Review your draft performance with comprehensive analytics showing value gained and roster strengths.
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
                    <p className="text-slate-400">Set up team count, budget, roster positions, scoring type, and connect your Couch Manager room ID.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">2</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Track Live Bids</h4>
                    <p className="text-slate-400">As players are nominated and bid on, enter the bid amount and mark whether it's your team or another team.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">3</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Watch Values Adjust</h4>
                    <p className="text-slate-400">Player values automatically recalculate based on inflation as the auction progresses.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white">4</span>
                  </div>
                  <div>
                    <h4 className="text-white mb-1">Analyze Your Results</h4>
                    <p className="text-slate-400">After the draft, review your team's performance and value gained.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
              <h3 className="text-2xl text-white mb-4">Perfect For:</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Rotisserie, H2H Categories, and H2H Points leagues</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>2-30 team leagues</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Custom roster configurations with CI, MI, and UTIL spots</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Slow auction drafts with varying nomination speeds</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Desktop-optimized for split-screen drafting</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
