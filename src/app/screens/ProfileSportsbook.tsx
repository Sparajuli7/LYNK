interface ProfileSportsbookProps {
  onNavigate?: (screen: string) => void;
}

export function ProfileSportsbook({ onNavigate }: ProfileSportsbookProps) {
  const rivalries = [
    { 
      name: "Sam", 
      avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop",
      wins: 5,
      losses: 3,
      lead: "You lead",
      lastResult: "You won · 3 days ago"
    },
    { 
      name: "Alex", 
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      wins: 2,
      losses: 7,
      lead: "They lead",
      lastResult: "They won · 5 days ago"
    }
  ];

  return (
    <div className="h-full bg-bg-primary overflow-y-auto pb-6">
      {/* Header Card - Fighter Style */}
      <div className="px-6 pt-12 pb-6">
        <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-green via-gold to-purple mb-3 p-1 overflow-hidden">
              <div className="w-full h-full rounded-full bg-bg-card p-1">
                <img 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            <h2 className="text-2xl font-black text-text-primary mb-1">Taylor Reed</h2>
            <p className="text-text-muted text-sm mb-3">@taylorr</p>
            
            {/* Record */}
            <div className="flex items-center gap-3 px-4 py-2 bg-bg-elevated rounded-full">
              <span className="font-black tabular-nums text-accent-green">14W</span>
              <span className="text-text-muted">·</span>
              <span className="font-black tabular-nums text-accent-coral">8L</span>
              <span className="text-text-muted">·</span>
              <span className="font-black tabular-nums text-text-muted">2 Void</span>
            </div>
          </div>

          {/* Win Rate - Big */}
          <div className="text-center border-t border-border-subtle pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
              WIN RATE
            </p>
            <p className="text-5xl font-black tabular-nums text-accent-green">
              63.6%
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-6 mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">
          STATISTICS
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Bets', value: '24', trend: '+3', up: true },
            { label: 'Active Streak', value: '3', trend: '+3', up: true },
            { label: 'Punishments Taken', value: '7', trend: '-2', up: false },
            { label: 'Completion Rate', value: '71%', trend: '+5%', up: true },
            { label: 'Biggest Win', value: '$100', trend: null, up: null },
            { label: 'Biggest Loss', value: '$50', trend: null, up: null }
          ].map((stat, i) => (
            <div key={i} className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
                {stat.label}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums text-text-primary">
                  {stat.value}
                </span>
                {stat.trend && (
                  <span className={`text-xs font-bold ${
                    stat.up === true ? 'text-accent-green' : 
                    stat.up === false ? 'text-accent-coral' : 
                    'text-text-muted'
                  }`}>
                    {stat.up === true && '↑ '}
                    {stat.up === false && '↓ '}
                    {stat.trend}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REP Badge Explanation */}
      <div className="px-6 mb-6">
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-white font-black text-sm">
              71%
            </div>
            <div>
              <p className="font-bold text-sm text-text-primary">Your REP Score</p>
              <p className="text-xs text-text-muted">Punishment completion rate</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            This badge shows on your avatar everywhere. Keep it high to maintain credibility.
          </p>
        </div>
      </div>

      {/* Beef Board */}
      <div className="px-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            BEEF BOARD
          </h2>
          <button className="text-xs font-bold text-accent-green uppercase">
            Sort by ↓
          </button>
        </div>
        
        <div className="space-y-3">
          {rivalries.map((rival, i) => (
            <div key={i} className="bg-bg-card border border-border-subtle rounded-xl p-4">
              {/* Head to head layout */}
              <div className="flex items-center justify-between mb-3">
                {/* You */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-green to-gold overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                      alt="You"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-bold text-sm text-text-primary">You</span>
                </div>

                {/* Record */}
                <div className="flex items-center gap-2 px-3 py-1 bg-bg-elevated rounded-full">
                  <span className="font-black tabular-nums text-accent-green text-sm">{rival.wins}</span>
                  <span className="text-text-muted text-xs">-</span>
                  <span className="font-black tabular-nums text-accent-coral text-sm">{rival.losses}</span>
                </div>

                {/* Them */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-text-primary">{rival.name}</span>
                  <div className="w-10 h-10 rounded-full bg-bg-elevated overflow-hidden">
                    <img 
                      src={rival.avatar}
                      alt={rival.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Series info */}
              <div className="text-center border-t border-border-subtle pt-3">
                <p className="text-xs font-bold text-accent-green mb-1">
                  {rival.lead} {rival.wins}-{rival.losses}
                </p>
                <p className="text-xs text-text-muted">
                  {rival.lastResult}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
