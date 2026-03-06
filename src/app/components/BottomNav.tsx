interface BottomNavProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: '', boost: false },
    { id: 'compete', label: 'Competition', icon: '', boost: true },
    { id: 'shame', label: 'Shame', icon: '', boost: false },
    { id: 'profile', label: 'Profile', icon: '', boost: false }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-bg-primary border-t border-border-subtle flex items-center justify-around pb-safe">
      {navItems.map((item) => {
        const isActive = activeScreen === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-0.5 transition-all ${item.boost ? 'scale-110' : ''}`}
          >
            <span className={`text-2xl transition-all ${isActive ? 'scale-110' : 'opacity-40 grayscale'}`}>
              {item.icon}
            </span>
            {isActive && (
              <>
                <span className="text-[10px] text-accent-green font-bold uppercase tracking-wider">
                  {item.label}
                </span>
                <div className="w-1 h-1 rounded-full bg-accent-green"></div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
