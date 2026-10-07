import React from 'react';
import { 
  Users, 
  Gauge, 
  Radio, 
  Building2, 
  Share2 
} from 'lucide-react';

interface DaladalaMobileNavProps {
  currentMode: 'passenger' | 'driver' | 'conductor' | 'fleet';
  onSelectMode: (mode: 'passenger' | 'driver' | 'conductor' | 'fleet') => void;
  onOpenDailyReport: () => void;
}

export default function DaladalaMobileNav({
  currentMode,
  onSelectMode,
  onOpenDailyReport,
}: DaladalaMobileNavProps) {
  const navItems = [
    {
      id: 'passenger',
      label: 'Abiria',
      sub: 'Ramani GPS',
      icon: Users,
      mode: 'passenger' as const,
      color: 'text-blue-500',
      activeBg: 'bg-blue-600 text-white',
    },
    {
      id: 'driver',
      label: 'Dereva',
      sub: 'Cockpit HUD',
      icon: Gauge,
      mode: 'driver' as const,
      color: 'text-amber-500',
      activeBg: 'bg-amber-500 text-neutral-950 font-black',
    },
    {
      id: 'conductor',
      label: 'Konda',
      sub: 'Viti & Tiketi',
      icon: Radio,
      mode: 'conductor' as const,
      color: 'text-purple-500',
      activeBg: 'bg-purple-600 text-white',
    },
    {
      id: 'fleet',
      label: 'Mmiliki',
      sub: 'Meli & Stendi',
      icon: Building2,
      mode: 'fleet' as const,
      color: 'text-emerald-500',
      activeBg: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <nav 
      aria-label="Urambazaji wa Chini wa Simu"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-safe"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentMode === item.mode;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMode(item.mode)}
              className={`flex flex-col items-center justify-center h-full py-1 transition-all relative ${
                isActive 
                  ? 'scale-105' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition ${
                isActive ? item.activeBg : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] mt-0.5 font-bold ${
                isActive 
                  ? 'text-neutral-900 dark:text-white font-black' 
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 absolute bottom-1" />
              )}
            </button>
          );
        })}

        {/* 5th button: WhatsApp Daily Report summary */}
        <button
          type="button"
          onClick={onOpenDailyReport}
          className="flex flex-col items-center justify-center h-full py-1 transition-all text-neutral-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400"
          title="Ripoti ya WhatsApp"
        >
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
            Hesabu
          </span>
        </button>
      </div>
    </nav>
  );
}
