interface BottomNavBarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function BottomNavBar({ activeScreen, onNavigate }: BottomNavBarProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: '' },
    { id: 'compete', label: 'Competition', icon: '', boost: true },
    { id: 'shame', label: 'Shame', icon: '' },
    { id: 'profile', label: 'Profile', icon: '' }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-bg-primary border-t border-border-subtle flex items-center justify-around pb-safe dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
      {navItems.map((item) => {
        const isActive = activeScreen === item.id;
        const scale = item.boost ? 'scale-110' : 'scale-100';
        
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-0.5 transition-all ${scale}`}
          >
            <span className={`text-2xl ${isActive ? 'scale-110' : 'opacity-40'}`}>
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
