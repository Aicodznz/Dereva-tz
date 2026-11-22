import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  CloudOff,
  Download,
  HardDrive,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DownloadedOfflineRegion,
  OFFLINE_REGIONS,
  OfflineDownloadProgress,
  OfflineRegionPreset,
  buildViewportRegionPreset,
  clearAllOfflineMapCaches,
  deleteOfflineRegion,
  downloadOfflineRegion,
  formatBytesSw,
  getOfflineStorageStats,
  listDownloadedRegions,
  useOfflineMapStatus,
} from '../../lib/offlineMapEngine';

export interface OfflineMapManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCenter?: { lat: number; lng: number; label?: string };
}

export const OfflineMapManagerModal: React.FC<OfflineMapManagerModalProps> = ({
  isOpen,
  onClose,
  currentCenter,
}) => {
  const { isOffline, forceOffline, setForceOffline } = useOfflineMapStatus();
  const [downloaded, setDownloaded] = useState<DownloadedOfflineRegion[]>([]);
  const [stats, setStats] = useState({
    regionsCount: 0,
    cachedTileRequests: 0,
    cachedStyleRequests: 0,
    estimatedBytes: 0,
  });
  const [activeProgress, setActiveProgress] = useState<OfflineDownloadProgress | null>(null);
  const [busyClear, setBusyClear] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshState = async () => {
    const [regs, st] = await Promise.all([
      listDownloadedRegions(),
      getOfflineStorageStats(),
    ]);
    setDownloaded(regs);
    setStats(st);
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshState();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!isOpen) return null;

  const downloadedMap = new Map(downloaded.map((r) => [r.id, r]));
  const viewportPreset = currentCenter
    ? buildViewportRegionPreset(currentCenter.lat, currentCenter.lng, currentCenter.label)
    : null;

  const handleDownload = async (preset: OfflineRegionPreset) => {
    if (!navigator.onLine) {
      toast.error('Unahitaji intaneti kidogo kwanza ili kupakua ramani ya eneo hili.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await downloadOfflineRegion(
        preset,
        (prog) => setActiveProgress(prog),
        ctrl.signal
      );
      toast.success(
        `Ramani ya "${result.name}" (2D & 3D) imehifadhiwa (${result.tileCount} vigae)!`
      );
      await refreshState();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.info('Upakuaji umesitishwa.');
      } else {
        toast.error('Imeshindwa kupakua baadhi ya vigae. Jaribu tena.');
      }
    } finally {
      setActiveProgress(null);
      abortRef.current = null;
    }
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    await deleteOfflineRegion(id);
    await refreshState();
    toast.success(`Kanda ya "${name}" imeondolewa kwenye orodha.`);
  };

  const handleClearAll = async () => {
    setBusyClear(true);
    try {
      await clearAllOfflineMapCaches();
      await refreshState();
      toast.success('Hifadhi yote ya ramani za offline imefutwa.');
    } finally {
      setBusyClear(false);
    }
  };

  const phaseLabel = (phase: OfflineDownloadProgress['phase']) => {
    if (phase === 'styles') return 'Inahifadhi mitindo ya 3D & fonti...';
    if (phase === '2d_tiles') return 'Inapakua vigae vya ramani 2D...';
    if (phase === '3d_tiles') return 'Inapakua vekta ya majengo 3D...';
    if (phase === 'saving') return 'Inahifadhi mitaa & vituo muhimu...';
    return 'Imekamilika!';
  };

  return createPortal(
    <div className="fixed inset-0 z-[10050] bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-lg bg-neutral-950 text-white rounded-t-3xl sm:rounded-2xl border border-white/15 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
              <CloudOff className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-tight truncate">
                Ramani za Offline (2D & 3D)
              </h3>
              <p className="text-[11px] text-neutral-400 truncate">
                Tumia ramani, tafuta mitaa & panga njia hata bila intaneti
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status + Offline Preview Toggle */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {isOffline ? (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">
                  {forceOffline
                    ? 'Hali ya Offline Imewashwa (Jaribio / Okoa Bando)'
                    : !navigator.onLine
                    ? 'Kifaa Kiko Offline — Ramani ya Ndani Inafanya Kazi'
                    : 'Mtandao Upo (Online)'}
                </div>
                <div className="text-[10px] text-neutral-400">
                  Vekta ya Tanzania (2D & 3D) iko tayari muda wote hata bila kupakua
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !forceOffline;
                setForceOffline(next);
                toast.info(
                  next
                    ? 'Hali ya Offline imewashwa kwa ramani zote za 2D & 3D.'
                    : 'Umerudi kwenye hali ya kawaida ya mtandao.'
                );
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                forceOffline
                  ? 'bg-amber-500 text-neutral-950'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
            >
              {forceOffline ? 'Rudi Online' : 'Jaribu Offline'}
            </button>
          </div>

          {/* Storage Telemetry */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-neutral-400">Kanda Zilizopakuliwa</div>
              <div className="text-base font-black text-white font-mono tabular-nums mt-0.5">
                {stats.regionsCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-neutral-400">Vigae 2D + 3D</div>
              <div className="text-base font-black text-orange-400 font-mono tabular-nums mt-0.5">
                {stats.cachedTileRequests}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] text-neutral-400">Ukubwa Hifadhi</div>
              <div className="text-base font-black text-emerald-400 font-mono tabular-nums mt-0.5">
                {formatBytesSw(stats.estimatedBytes)}
              </div>
            </div>
          </div>

          {/* Active Download Progress */}
          {activeProgress && (
            <div className="p-3.5 rounded-2xl bg-orange-600/15 border border-orange-500/40 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-orange-200 truncate">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-400 shrink-0" />
                  <span className="truncate">{activeProgress.regionName}</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-white shrink-0">
                  {activeProgress.percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-200"
                  style={{ width: `${activeProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-300">
                <span>{phaseLabel(activeProgress.phase)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {formatBytesSw(activeProgress.bytesDownloaded)}
                  </span>
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="text-rose-300 hover:underline font-bold cursor-pointer"
                  >
                    Sitisha
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Viewport Quick Download */}
          {viewportPreset && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-600/20 to-amber-600/10 border border-orange-500/35 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {viewportPreset.name}
                  </div>
                  <div className="text-[10px] text-neutral-300 truncate">
                    {viewportPreset.subtitle} · {viewportPreset.estimatedMb}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(activeProgress)}
                onClick={() => handleDownload(viewportPreset)}
                className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pakua Hapa</span>
              </button>
            </div>
          )}

          {/* Curated Tanzania Regions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Kanda za Tanzania (Ramani ya 2D + Majengo 3D)
              </span>
              {stats.cachedTileRequests > 0 && (
                <button
                  type="button"
                  disabled={busyClear || Boolean(activeProgress)}
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-rose-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Futa Zote</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {OFFLINE_REGIONS.map((region) => {
                const saved = downloadedMap.get(region.id);
                const isDownloadingThis = activeProgress?.regionId === region.id;
                return (
                  <div
                    key={region.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      saved
                        ? 'bg-emerald-500/10 border-emerald-500/35'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {region.name}
                        </span>
                        {saved && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                        {region.subtitle}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-neutral-300 mt-1 flex items-center gap-2">
                        {saved ? (
                          <>
                            <span className="text-emerald-400 font-bold">
                              Imehifadhiwa · {formatBytesSw(saved.sizeBytes)}
                            </span>
                            <span>• {saved.tileCount} vigae (2D & 3D)</span>
                          </>
                        ) : (
                          <span>Kadirio: {region.estimatedMb} · 2D & 3D</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {saved && (
                        <button
                          type="button"
                          disabled={Boolean(activeProgress)}
                          onClick={() => handleDeleteRegion(region.id, region.name)}
                          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-600/30 text-neutral-300 hover:text-rose-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
                          title="Ondoa kanda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(activeProgress)}
                        onClick={() => handleDownload(region)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                          saved
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                      >
                        {isDownloadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : saved ? (
                          <RefreshCw className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{saved ? 'Sasisha' : 'Pakua'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-2.5 text-[11px] text-neutral-300">
            <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              Ramani zote unazotembelea ukiwa online zinahifadhiwa pia kiotomatiki ili ziweze
              kufunguka katika 2D na 3D ukiwa safarini au eneo lisilo na mtandao.
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
