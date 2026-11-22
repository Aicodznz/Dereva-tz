import React, { useEffect, useState } from 'react';
import { CloudOff, Download, Wifi } from 'lucide-react';
import { setForceOfflineMode, useOfflineMapStatus } from '../../lib/offlineMapEngine';
import { OfflineMapManagerModal } from './OfflineMapManagerModal';

export const OfflineIndicatorBanner: React.FC = () => {
  const { isOffline, forceOffline } = useOfflineMapStatus();
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setManagerOpen(true);
    window.addEventListener('open-offline-map-manager', handler);
    return () => window.removeEventListener('open-offline-map-manager', handler);
  }, []);

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-[9500] px-3.5 py-2 rounded-2xl bg-neutral-950/95 text-white border border-amber-500/45 shadow-2xl backdrop-blur-md flex items-center gap-2.5 max-w-[94vw]">
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-[11px] leading-tight min-w-0">
            <span className="font-bold text-amber-300">Hali ya Offline</span>
            <span className="text-neutral-300 hidden sm:inline">
              {' '}
              — Ramani 2D/3D na maeneo yaliyohifadhiwa yanafanya kazi
            </span>
          </div>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Ramani</span>
          </button>
          {forceOffline && (
            <button
              type="button"
              onClick={() => setForceOfflineMode(false)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              title="Zima jaribio la offline"
            >
              <Wifi className="w-3 h-3" />
              <span>Online</span>
            </button>
          )}
        </div>
      )}

      <OfflineMapManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </>
  );
};
