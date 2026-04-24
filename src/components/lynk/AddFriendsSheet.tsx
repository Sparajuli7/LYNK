import React, { useState } from "react";

interface SearchResult {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  mutualCount: number;
}

interface AddFriendsSheetProps {
  open: boolean;
  onClose: () => void;
  inviteLink: string;
  username: string;
  onCopyLink: () => void;
  onShareMessages: () => void;
  onShareGeneral: () => void;
  searchResults: SearchResult[];
  onSearch: (query: string) => void;
  onAddUser: (userId: string) => void;
  isSearching: boolean;
  onSyncContacts?: () => void;
}

export function AddFriendsSheet({
  open,
  onClose,
  inviteLink,
  username,
  onCopyLink,
  onShareMessages,
  onShareGeneral,
  searchResults,
  onSearch,
  onAddUser,
  isSearching,
  onSyncContacts,
}: AddFriendsSheetProps) {
  const [query, setQuery] = useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Reset query when sheet closes
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 250);
  };

  // Split link into base + username for coloring
  const linkBase = `lynk.app/add/`;

  return (
    <>
      {/* Dimmed overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        <div className="bg-surface rounded-t-[24px] border-t border-rider/20 flex flex-col max-h-full">
          {/* Grabber */}
          <div className="flex justify-center mt-2.5 mb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#333]" />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-5">
            {/* Header */}
            <div className="flex items-start justify-between mt-1 mb-5">
              <div>
                <h2 className="font-black italic text-2xl tracking-[-0.04em] text-text">
                  ADD FRIENDS
                </h2>
                <p className="text-[11px] text-text-mute mt-0.5">
                  Build your roster. Bet on each other.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <span className="text-text-dim text-[14px] leading-none">&#x2715;</span>
              </button>
            </div>

            {/* ── Invite link section ── */}
            <div className="mb-5">
              <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
                YOUR INVITE LINK
              </label>
              <div className="bg-surface-2 rounded-xl p-3">
                <div className="font-mono text-[13px] text-text-dim">
                  {linkBase}
                  <span className="text-rider">{username}</span>
                </div>
                <div className="text-[10px] text-text-mute mt-1.5">
                  Expires in 7 days · Regenerates on use
                </div>
                <button
                  onClick={onCopyLink}
                  className="mt-2 bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[10px] px-3 py-1.5 rounded-lg tracking-[0.1em]"
                >
                  COPY
                </button>
              </div>
            </div>

            {/* Share chips */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={onShareMessages}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[10px] px-3 py-2 rounded-full tracking-[0.05em]"
              >
                💬 MESSAGES
              </button>
              <button
                onClick={onCopyLink}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[10px] px-3 py-2 rounded-full tracking-[0.05em]"
              >
                📋 COPY QR
              </button>
              <button
                onClick={onShareGeneral}
                className="bg-transparent border-[1.5px] border-[#333] text-[#ccc] font-black text-[10px] px-3 py-2 rounded-full tracking-[0.05em]"
              >
                &#x2197; SHARE
              </button>
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 border-t border-border-hi" />
              <span className="text-[10px] font-black text-text-mute tracking-[0.1em]">OR</span>
              <div className="flex-1 border-t border-border-hi" />
            </div>

            {/* ── Search section ── */}
            <div className="mb-4">
              <label className="text-[10px] font-black tracking-[0.15em] text-text-mute uppercase block mb-2">
                FIND BY USERNAME
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mute text-[14px]">
                  🔍
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="@username"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface border-[1.5px] border-rider/30 font-mono text-[13px] text-text outline-none placeholder:text-text-mute/50"
                />
              </div>
            </div>

            {/* Search results */}
            {query.length > 0 && (
              <div className="space-y-2 mb-5">
                {isSearching && (
                  <div className="text-[11px] text-text-mute text-center py-3">
                    Searching...
                  </div>
                )}
                {!isSearching && searchResults.length === 0 && query.length >= 2 && (
                  <div className="text-[11px] text-text-mute text-center py-3">
                    No users found
                  </div>
                )}
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="bg-surface rounded-[10px] p-[10px_12px] flex items-center gap-2.5"
                  >
                    <div className="w-10 h-10 rounded-full ring-2 ring-[#333] flex-shrink-0 overflow-hidden bg-surface-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-[13px] text-text truncate">
                        {user.displayName}
                      </div>
                      <div className="text-[10px] text-text-dim mt-0.5">
                        @{user.username}
                        {user.mutualCount > 0 && (
                          <span> · {user.mutualCount} mutual</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onAddUser(user.id)}
                      className="flex-shrink-0 bg-rider-dim border-[1.5px] border-rider text-rider font-black text-[10px] px-[10px] py-[6px] rounded-lg tracking-[0.1em]"
                    >
                      + ADD
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* OR divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 border-t border-border-hi" />
              <span className="text-[10px] font-black text-text-mute tracking-[0.1em]">OR</span>
              <div className="flex-1 border-t border-border-hi" />
            </div>

            {/* Sync from contacts */}
            <button
              onClick={onSyncContacts}
              className="w-full border-[1.5px] border-dashed border-[#333] rounded-xl p-4 flex flex-col items-center gap-1"
            >
              <span className="text-text font-black text-[13px] tracking-[0.05em]">
                📱 SYNC FROM CONTACTS
              </span>
              <span className="text-text-mute text-[11px]">
                We&apos;ll find friends already on Lynk. Numbers never stored.
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
