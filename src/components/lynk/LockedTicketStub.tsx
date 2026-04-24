interface LockedTicketStubProps {
  onClick?: () => void;
}

export function LockedTicketStub({ onClick }: LockedTicketStubProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full bg-surface rounded-lg overflow-hidden cursor-pointer text-left opacity-[0.55]"
    >
      {/* Muted perforation strip */}
      <div
        className="h-[5px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #0A0A0F 0 3px, transparent 3px 6px)",
        }}
        aria-hidden="true"
      />

      {/* Body */}
      <div className="p-[7px]">
        <span className="text-[8px] font-black tracking-[0.1em] text-text-mute">
          &#x25CF; PRIVATE
        </span>
        <p className="text-[10px] text-text-mute font-bold mt-[3px] line-clamp-2">
          Friends only
        </p>
        <span className="block text-[9px] mt-1 opacity-50">🔒</span>
      </div>
    </button>
  );
}
