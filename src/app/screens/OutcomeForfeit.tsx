import { PunishmentReceipt } from "../components/PunishmentReceipt";
import { iosSpacing } from '@/lib/utils/iosSpacing';

interface OutcomeForfeitProps {
  onSubmitProof: () => void;
  onDispute: () => void;
}

export function OutcomeForfeit({ onSubmitProof, onDispute }: OutcomeForfeitProps) {
  return (
    <div
      className="h-full flex flex-col items-center justify-between px-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #1A0000 0%, #0A0A0F 100%)',
        paddingTop: iosSpacing.topPadding,
        paddingBottom: iosSpacing.bottomPadding,
      }}
    >
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* LYNK text */}
        <h1 className="text-[72px] font-black text-accent-coral mb-6 text-center italic" style={{ letterSpacing: '-0.02em' }}>
          LYNK
        </h1>

        {/* Screen crack illustration */}
        <div className="mb-8 opacity-40">
          <svg width="200" height="140" viewBox="0 0 200 140" className="text-accent-coral">
            <path 
              d="M 100 0 L 98 30 L 102 50 L 97 80 L 103 110 L 100 140" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              fill="none"
              strokeDasharray="4,3"
            />
            <path 
              d="M 100 60 L 65 45 L 45 65 M 100 60 L 135 45 L 155 65" 
              stroke="currentColor" 
              strokeWidth="2" 
              fill="none"
              strokeDasharray="4,3"
            />
            <path 
              d="M 100 90 L 70 105 L 50 125 M 100 90 L 130 105 L 150 125" 
              stroke="currentColor" 
              strokeWidth="2" 
              fill="none"
              strokeDasharray="4,3"
            />
          </svg>
        </div>

        {/* Punishment Receipt */}
        <div className="w-full mb-8">
          <PunishmentReceipt
            betTitle="Hit the gym 5 days this week"
            loserName="Jordan"
            punishment="Post an embarrassing throwback to your main story"
            winnerNames={["Mike", "Sarah", "Alex"]}
            issuedDate="Feb 17, 2026"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3">
        <button
          onClick={onSubmitProof}
          className="w-full h-14 rounded-2xl bg-accent-coral text-white font-bold text-base btn-pressed shadow-xl"
        >
          SUBMIT PUNISHMENT PROOF
        </button>
        <button
          onClick={onDispute}
          className="w-full text-xs text-text-muted font-medium btn-pressed"
        >
          Dispute Outcome
        </button>
      </div>
    </div>
  );
}
