import { forwardRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareSheet } from './ShareSheet';
import { getPunishmentShareText, shareWithNative } from '@/lib/share';

interface PunishmentReceiptProps {
  betTitle: string;
  loserName: string;
  punishment: string;
  winnerNames: string[];
  issuedDate?: string;
  betId?: string;
}

export const PunishmentReceipt = forwardRef<HTMLDivElement, PunishmentReceiptProps>(
  function PunishmentReceipt(
    { betTitle, loserName, punishment, winnerNames, issuedDate, betId },
    ref,
  ) {
    const [shareOpen, setShareOpen] = useState(false);

    const shareText = getPunishmentShareText({ loserName, punishment, betTitle });
    const shareUrl = betId
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/bet/${betId}`
      : typeof window !== 'undefined'
        ? window.location.href
        : '';

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const usedNative = await shareWithNative({ title: 'Forfeit Receipt', text: shareText, url: shareUrl });
      if (!usedNative) setShareOpen(true);
    };

    return (
      <>
        <div className="relative rotate-slight" ref={ref}>
          <div className="bg-bg-card receipt-border border-text-muted/30 rounded-xl p-6 mx-4 perforated-bottom">
            {/* Share button */}
            <button
              onClick={handleShare}
              className="absolute top-3 right-7 w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-colors z-10"
              aria-label="Share receipt"
            >
              <Share2 className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {/* Header */}
            <div className="text-center mb-6 border-b border-dashed border-border-subtle pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-1">
                PUNISHMENT RECEIPT
              </p>
              <p className="text-xs text-text-muted tabular-nums">
                {issuedDate || new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Receipt rows */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-bold uppercase text-text-muted">BET:</span>
                <span className="text-sm text-text-primary text-right flex-1">{betTitle}</span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-bold uppercase text-text-muted">LOSER:</span>
                <span className="text-sm font-bold text-accent-coral text-right">{loserName}</span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-bold uppercase text-text-muted">OWES:</span>
                <span className="text-sm font-bold text-accent-coral text-right flex-1">{punishment}</span>
              </div>

              <div className="border-t border-dashed border-border-subtle my-3"></div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-bold uppercase text-text-muted">ISSUED BY:</span>
                <span className="text-sm text-text-primary text-right flex-1">
                  {winnerNames.join(', ')}
                </span>
              </div>
            </div>

            {/* Signature line */}
            <div className="border-t border-border-subtle pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">Signature:</span>
                <div className="h-px flex-1 mx-3 bg-border-subtle"></div>
                <span className="text-xs text-text-muted">No refunds</span>
              </div>
            </div>
          </div>
        </div>

        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          title="Share forfeit"
          text={shareText}
          url={shareUrl}
        />
      </>
    );
  },
);
