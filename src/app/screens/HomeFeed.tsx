import { BetCard } from "../components/BetCard";
import { Plus } from "lucide-react";

interface HomeFeedProps {
  activeScreen: string;
  onNavigate?: (screen: string) => void;
}

export function HomeFeed({ activeScreen, onNavigate }: HomeFeedProps) {
  return (
    <div className="h-full bg-bg-primary overflow-y-auto pb-6">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[32px] font-extrabold text-white" style={{ letterSpacing: '-0.02em' }}>
            What's the play?
          </h1>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-green to-accent-coral"></div>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          <button className="px-4 py-2 rounded-full bg-accent-green text-bg-primary font-semibold text-sm whitespace-nowrap">
            All
          </button>
          <button className="px-4 py-2 rounded-full bg-bg-elevated text-text-muted font-semibold text-sm whitespace-nowrap">
            Active
          </button>
          <button className="px-4 py-2 rounded-full bg-bg-elevated text-text-muted font-semibold text-sm whitespace-nowrap">
            Deciding
          </button>
          <button className="px-4 py-2 rounded-full bg-bg-elevated text-text-muted font-semibold text-sm whitespace-nowrap">
            Completed
          </button>
        </div>
      </div>

      {/* Bet Cards */}
      <div className="px-6 space-y-4">
        <button onClick={() => onNavigate?.('detail')} className="w-full text-left">
          <BetCard
            groupName="Core 4"
            category=""
            countdown="2d 4h"
            claimText="I'll hit the gym 5 days this week"
            claimantName="Jordan"
            claimantAvatar="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
            riderPercent={67}
            doubterPercent={33}
            ridersCount={4}
            doubtersCount={2}
            stake="Medium"
            urgent={true}
          />
        </button>

        <button onClick={() => onNavigate?.('detail')} className="w-full text-left">
          <BetCard
            groupName="Weekend Warriors"
            category=""
            countdown="12h 22m"
            claimText="I won't drink alcohol for the next 30 days"
            claimantName="Alex"
            claimantAvatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
            riderPercent={40}
            doubterPercent={60}
            ridersCount={2}
            doubtersCount={3}
            stake="$20"
            isProofSubmitted={true}
          />
        </button>

        <button onClick={() => onNavigate?.('detail')} className="w-full text-left">
          <BetCard
            groupName="Roommates"
            category=""
            countdown="3d 8h"
            claimText="I'll deep clean the entire apartment this weekend"
            claimantName="Sam"
            claimantAvatar="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop"
            riderPercent={75}
            doubterPercent={25}
            ridersCount={6}
            doubtersCount={2}
            stake="High"
          />
        </button>
      </div>

      {/* FAB */}
      <button 
        onClick={() => onNavigate?.('creation')}
        className="fixed bottom-28 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-accent-green glow-green flex items-center justify-center btn-pressed"
      >
        <Plus className="w-6 h-6 text-bg-primary" strokeWidth={3} />
      </button>
    </div>
  );
}