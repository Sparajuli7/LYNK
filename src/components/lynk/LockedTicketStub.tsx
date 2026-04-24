interface LockedTicketStubProps {
  onClick?: () => void;
}

export function LockedTicketStub({ onClick }: LockedTicketStubProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full bg-surface rounded-lg overflow-hidden cursor-pointer text-left"
    >
      {/* Muted perforation strip */}
      <div
        className="h-[5px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #1a1a22 0 4px, transparent 4px 8px)",
        }}
        aria-hidden="true"
      />

      {/* Body */}
      <div className="p-[7px]">
        <span className="text-[8px] font-black tracking-[0.1em] text-text-mute">
          &#x25CF; PRIVATE
        </span>
        <p className="text-[10px] text-text-mute font-bold mt-1 line-clamp-2">
          Friends only
        </p>
        <span className="block text-[10px] mt-1 opacity-50">🔒</span>
      </div>
    </button>
  );
}
