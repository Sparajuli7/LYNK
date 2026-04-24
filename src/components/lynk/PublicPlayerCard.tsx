import { PlayerCardHero } from "./PlayerCardHero";
import { RelationshipStatusChips } from "./RelationshipStatusChips";
import { HeadToHeadReceipt } from "./HeadToHeadReceipt";
import { MutualFriendsRow } from "./MutualFriendsRow";
import { StrangerPrivacyNudge } from "./StrangerPrivacyNudge";
import { LockedTicketStub } from "./LockedTicketStub";
import { TicketStub } from "./TicketStub";
import { SectionHeader } from "./SectionHeader";

type Relationship = "stranger" | "pending" | "friend" | "rival";

interface PublicPlayerCardProps {
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url?: string | null;
    total_bets: number;
    wins: number;
    losses: number;
    punishments_taken: number;
    current_streak: number;
    rep_score: number;
  };
  relationship: Relationship;
  serialNumber: string;
  h2h?: {
    viewerWins: number;
    otherWins: number;
    totalBets: number;
    outstandingBalanceCents: number;
    outstandingLabel?: string;
  };
  mutualFriends: {
    count: number;
    names: string[];
    avatars: { avatarUrl?: string }[];
  };
  shameProofs: { thumbnailUrl?: string; title: string }[];
  publicTickets: {
    status: "won" | "lost" | "live" | "pending" | "private";
    title: string;
    amountDisplay: string;
    onClick?: () => void;
  }[];
  onBack: () => void;
  onShare?: () => void;
  onAddFriend?: () => void;
  onCancelRequest?: () => void;
  onPlaceBet?: () => void;
  onChallenge?: () => void;
  onMessage?: () => void;
}

const HERO_STYLES: Record<
  Relationship,
  { borderColor: string; chipBg: string; chipText: string }
> = {
  stranger: {
    borderColor: "rgba(255,255,255,0.08)",
    chipBg: "bg-[#333]",
    chipText: "text-text-dim",
    avatarRing: "bg-[#444]",
  },
  pending: {
    borderColor: "rgba(245,158,11,0.35)",
    chipBg: "bg-warning",
    chipText: "text-bg",
    avatarRing: "bg-warning",
  },
  friend: {
    borderColor: "rgba(0,230,118,0.35)",
    chipBg: "bg-rider",
    chipText: "text-bg",
    avatarRing: "bg-rider",
  },
  rival: {
    borderColor: "rgba(255,61,87,0.35)",
    chipBg: "bg-doubter",
    chipText: "text-white",
    avatarRing: "bg-doubter",
  },
};

export function PublicPlayerCard({
  profile,
  relationship,
  serialNumber,
  h2h,
  mutualFriends,
  shameProofs,
  publicTickets,
  onBack,
  onShare,
  onAddFriend,
  onCancelRequest,
  onPlaceBet,
  onChallenge,
  onMessage,
}: PublicPlayerCardProps) {
  const heroStyle = HERO_STYLES[relationship];
  const totalBets = profile.total_bets;
  const winPct = totalBets > 0 ? Math.round((profile.wins / totalBets) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center"
          aria-label="Back"
        >
          <span className="text-[#ccc] text-[18px] leading-none">&#x2039;</span>
        </button>
        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="w-9 h-9 rounded-full bg-surface flex items-center justify-center"
              aria-label="Share"
            >
              <span className="text-[#ccc] text-[16px] leading-none">&#x2197;</span>
            </button>
          )}
          <button
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center"
            aria-label="More options"
          >
            <span className="text-[#ccc] text-[16px] leading-none">&#x22EF;</span>
          </button>
        </div>
      </div>

      {/* ── Hero card ── */}
      <PlayerCardHero
        displayName={profile.display_name}
        username={profile.username}
        avatarUrl={profile.avatar_url ?? undefined}
        serialNumber={serialNumber}
        streak={profile.current_streak}
        bets={totalBets}
        winPct={winPct}
        punishments={profile.punishments_taken}
        earned={profile.rep_score}
        borderColor={heroStyle.borderColor}
        chipBg={heroStyle.chipBg}
        chipText={heroStyle.chipText}
        avatarRingColor={heroStyle.avatarRing}
        afterName={
          <RelationshipStatusChips
            relationship={relationship}
            mutualCount={mutualFriends.count}
          />
        }
      />

      {/* ── State-specific content ── */}
      {relationship === "stranger" && (
        <>
          <StrangerPrivacyNudge
            displayName={profile.display_name}
            onAddFriend={onAddFriend}
          />
          <div className="flex gap-2">
            {onAddFriend && (
              <button
                onClick={onAddFriend}
                className="flex-1 bg-rider text-bg font-black text-[12px] py-3 rounded-xl tracking-[0.1em] shadow-[0_0_0_4px] shadow-rider-ring"
              >
                + ADD FRIEND
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 px-4 rounded-xl tracking-[0.1em]"
              >
                &#x2197; SHARE
              </button>
            )}
          </div>
          {mutualFriends.count > 0 && (
            <MutualFriendsRow
              count={mutualFriends.count}
              names={mutualFriends.names}
              avatars={mutualFriends.avatars}
            />
          )}
        </>
      )}

      {relationship === "pending" && (
        <div className="flex gap-2">
          <button
            disabled
            className="flex-1 bg-warning/40 text-warning/60 font-black text-[12px] py-3 rounded-xl tracking-[0.1em] cursor-not-allowed"
          >
            REQUEST SENT &#x23F3;
          </button>
          {onCancelRequest && (
            <button
              onClick={onCancelRequest}
              className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 px-4 rounded-xl tracking-[0.1em]"
            >
              CANCEL REQUEST
            </button>
          )}
        </div>
      )}

      {relationship === "friend" && (
        <>
          {h2h && (
            <HeadToHeadReceipt
              viewerWins={h2h.viewerWins}
              otherWins={h2h.otherWins}
              otherName={profile.display_name}
              totalBets={h2h.totalBets}
              outstandingBalanceCents={h2h.outstandingBalanceCents}
            />
          )}
          <div className="flex gap-2">
            {onPlaceBet && (
              <button
                onClick={onPlaceBet}
                className="flex-1 bg-rider text-bg font-black text-[12px] py-3 rounded-xl tracking-[0.1em] shadow-[0_0_0_4px] shadow-rider-ring"
              >
                + PLACE BET TOGETHER
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 px-4 rounded-xl tracking-[0.1em]"
              >
                💬 MSG
              </button>
            )}
          </div>
          {mutualFriends.count > 0 && (
            <MutualFriendsRow
              count={mutualFriends.count}
              names={mutualFriends.names}
              avatars={mutualFriends.avatars}
            />
          )}
        </>
      )}

      {relationship === "rival" && (
        <>
          {h2h && (
            <HeadToHeadReceipt
              viewerWins={h2h.viewerWins}
              otherWins={h2h.otherWins}
              otherName={profile.display_name}
              totalBets={h2h.totalBets}
              outstandingBalanceCents={h2h.outstandingBalanceCents}
              outstandingLabel={h2h.outstandingLabel}
            />
          )}
          <div className="flex gap-2">
            {onChallenge && (
              <button
                onClick={onChallenge}
                className="flex-1 bg-doubter text-white font-black text-[12px] py-3 rounded-xl tracking-[0.1em] shadow-[0_0_0_4px] shadow-[rgba(255,61,87,0.15)]"
              >
                &#x2694; CHALLENGE 1V1
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[12px] py-3 px-4 rounded-xl tracking-[0.1em]"
              >
                💬 MSG
              </button>
            )}
          </div>
          {mutualFriends.count > 0 && (
            <MutualFriendsRow
              count={mutualFriends.count}
              names={mutualFriends.names}
              avatars={mutualFriends.avatars}
            />
          )}
        </>
      )}

      {/* ── Hall of Shame ── */}
      {shameProofs.length > 0 && (
        <div>
          <SectionHeader
            title="HALL OF SHAME"
            titleColor="text-doubter"
            action={
              <span className="text-[10px] font-bold text-text-mute tracking-[0.1em]">
                {shameProofs.length} PROOFS
              </span>
            }
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
            {shameProofs.map((proof, i) => (
              <div
                key={i}
                className="w-[100px] flex-shrink-0 bg-surface rounded-lg overflow-hidden"
              >
                {/* Thumbnail area */}
                <div className="h-[80px] bg-surface-2 overflow-hidden border-b border-doubter/30">
                  {proof.thumbnailUrl ? (
                    <img
                      src={proof.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-[2px] px-3">
                        <div className="w-7 h-[3px] bg-doubter" />
                        <div className="w-5 h-[3px] bg-doubter" />
                        <div className="w-6 h-[3px] bg-doubter opacity-60" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[8px] font-black text-doubter tracking-[0.1em]">
                    FORFEIT
                  </div>
                  <div className="text-[10px] text-text font-bold mt-0.5 line-clamp-1">
                    {proof.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Public Tickets ── */}
      {publicTickets.length > 0 && (
        <div>
          <SectionHeader title="PUBLIC TICKETS" />
          <div className="grid grid-cols-3 gap-2 mt-3">
            {publicTickets.map((ticket, i) =>
              relationship === "stranger" && ticket.status === "private" ? (
                <LockedTicketStub key={i} onClick={ticket.onClick} />
              ) : (
                <TicketStub
                  key={i}
                  status={ticket.status === "private" ? "pending" : ticket.status}
                  title={ticket.title}
                  amountDisplay={ticket.amountDisplay}
                  onClick={ticket.onClick}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
