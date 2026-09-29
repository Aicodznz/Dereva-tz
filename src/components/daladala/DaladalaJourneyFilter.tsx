import React, { useMemo } from 'react';
import { 
  MapPin, 
  Flag, 
  ArrowRightLeft, 
  Bus, 
  Search, 
  X, 
  Filter, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Users
} from 'lucide-react';
import { DaladalaRoute, DaladalaStop } from '../../types/daladala.types';

export interface DaladalaJourneyFilterProps {
  routes: DaladalaRoute[];
  boardingStop: string;
  onBoardingStopChange: (val: string) => void;
  selectedRoute: string; // 'all' or route id / code
  onRouteChange: (routeId: string) => void;
  alightStop: string;
  onAlightStopChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  seatFilter: 'all' | 'available_only';
  onSeatFilterChange: (val: 'all' | 'available_only') => void;
  onSwapStops: () => void;
  onResetFilters: () => void;
  matchingCount: number;
  totalCount: number;
}

// Popular hub stations for quick 1-tap filtering
const POPULAR_DAR_STOPS = [
  'Kimara Mwisho',
  'Shekilango',
  'Ubungo Maji',
  'Mwenge Bus Stand',
  'Kariakoo Gerezani',
  'Posta ya Zamani',
  'Kivukoni Ferry',
  'Mbagala Rangi Tatu',
  'Morocco Kituoni',
  'Tegeta Nyuki'
];

export default function DaladalaJourneyFilter({
  routes,
  boardingStop,
  onBoardingStopChange,
  selectedRoute,
  onRouteChange,
  alightStop,
  onAlightStopChange,
  searchQuery,
  onSearchQueryChange,
  seatFilter,
  onSeatFilterChange,
  onSwapStops,
  onResetFilters,
  matchingCount,
  totalCount,
}: DaladalaJourneyFilterProps) {
  // Collect all unique stops across all daladala routes for autocomplete & suggestions
  const allStops = useMemo(() => {
    const map = new Map<string, DaladalaStop>();
    routes.forEach((r) => {
      r.stops.forEach((s) => {
        if (!map.has(s.name.toLowerCase())) {
          map.set(s.name.toLowerCase(), s);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [routes]);

  const isFilterActive = Boolean(
    boardingStop.trim() || 
    alightStop.trim() || 
    selectedRoute !== 'all' || 
    searchQuery.trim() || 
    seatFilter !== 'all'
  );

  // Active route details if selected
  const activeRouteObj = useMemo(() => {
    if (selectedRoute === 'all') return null;
    return routes.find((r) => r.id === selectedRoute || r.routeCode === selectedRoute) || null;
  }, [routes, selectedRoute]);

  // Handle one-tap click on popular stops
  const handleSelectPopularStop = (stopName: string) => {
    if (!boardingStop.trim()) {
      onBoardingStopChange(stopName);
    } else if (!alightStop.trim() && boardingStop.trim() !== stopName) {
      onAlightStopChange(stopName);
    } else {
      // If both set or same, override destination
      onAlightStopChange(stopName);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all">
      {/* Header with Title and Reset */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-neutral-100 dark:border-neutral-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>Chuja Mabasi kwa Vituo & Ruti</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                Papo Hapo
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500">
              Andika kituo cha kupandia, ruti na kituo cha kushukia ili kuona mabasi husika pekee
            </p>
          </div>
        </div>

        {isFilterActive && (
          <button
            type="button"
            onClick={onResetFilters}
            className="self-end sm:self-auto px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 transition flex items-center gap-1.5 active:scale-95"
            title="Futa vichujio vyote na uonyeshe mabasi yote"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Onyesha Mabasi Yote</span>
          </button>
        )}
      </div>

      {/* 3-Part Main Inputs: 1) Kituo cha Kupandia, 2) Ruti, 3) Kituo cha Kushukia */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
        {/* 1. Kituo cha Kupandia (Boarding Stop) */}
        <div className="md:col-span-4 relative">
          <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-300 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kituo cha Kupandia (Ulichopo)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="boarding-stops-list"
              value={boardingStop}
              onChange={(e) => onBoardingStopChange(e.target.value)}
              placeholder="k.m. Shekilango, Mwenge, Kimara..."
              className="w-full pl-8 pr-7 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-900 font-semibold"
            />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {boardingStop && (
              <button
                type="button"
                onClick={() => onBoardingStopChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
                title="Futa kituo hiki"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="boarding-stops-list">
              {allStops.map((stop) => (
                <option key={`b-${stop.id}`} value={stop.name}>
                  {stop.zone ? `(Zone: ${stop.zone})` : ''}
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Swap Origin / Destination Button (Hidden on Mobile, or centered in desktop) */}
        <div className="hidden md:flex md:col-span-1 items-end justify-center pb-1">
          <button
            type="button"
            onClick={onSwapStops}
            disabled={!boardingStop && !alightStop}
            className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-700 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Badilisha vituo (Swap direction)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Ruti ya Daladala (Route Selector) */}
        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-300 mb-1 flex items-center gap-1">
            <Bus className="w-3.5 h-3.5 text-blue-600" />
            <span>Ruti ya Basi</span>
          </label>
          <div className="relative">
            <select
              value={selectedRoute}
              onChange={(e) => onRouteChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-900 font-semibold cursor-pointer appearance-none truncate pr-8"
            >
              <option value="all">Ruti Zote (Dar es Salaam Nzima)</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeCode}: {r.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              <Bus className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Mobile Swap Button */}
        <div className="flex md:hidden items-center justify-center py-0.5">
          <button
            type="button"
            onClick={onSwapStops}
            disabled={!boardingStop && !alightStop}
            className="px-3 py-1 text-[11px] font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800 active:scale-95 disabled:opacity-40"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Badili Vituo (Swap)</span>
          </button>
        </div>

        {/* 3. Kituo cha Kushukia (Alight / Destination Stop) */}
        <div className="md:col-span-4 relative">
          <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-300 mb-1 flex items-center gap-1">
            <Flag className="w-3.5 h-3.5 text-orange-500" />
            <span>Kituo cha Kushukia (Unapokwenda)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="alight-stops-list"
              value={alightStop}
              onChange={(e) => onAlightStopChange(e.target.value)}
              placeholder="k.m. Posta, Kivukoni, Morocco..."
              className="w-full pl-8 pr-7 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-900 font-semibold"
            />
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {alightStop && (
              <button
                type="button"
                onClick={() => onAlightStopChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
                title="Futa kituo hiki"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="alight-stops-list">
              {allStops.map((stop) => (
                <option key={`a-${stop.id}`} value={stop.name}>
                  {stop.zone ? `(Zone: ${stop.zone})` : ''}
                </option>
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Secondary Bar: Free-text search, Seats toggle, and Popular Station Quick-Select Chips */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
        {/* Popular Station Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <span className="text-[10px] uppercase font-bold text-neutral-400 shrink-0">
            Vituo Maarufu:
          </span>
          {POPULAR_DAR_STOPS.map((st) => {
            const isBoarding = boardingStop.toLowerCase() === st.toLowerCase();
            const isAlight = alightStop.toLowerCase() === st.toLowerCase();
            return (
              <button
                key={st}
                type="button"
                onClick={() => handleSelectPopularStop(st)}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition text-xs shrink-0 flex items-center gap-1 ${
                  isBoarding
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isAlight
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {isBoarding && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                {isAlight && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                <span>{st.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Text Filter & Available Seats Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Plate / Jina (k.m. T 392 DKR)..."
              className="w-full pl-7 pr-6 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-[10px] font-bold"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSeatFilterChange(seatFilter === 'all' ? 'available_only' : 'all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 ${
              seatFilter === 'available_only'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 hover:bg-neutral-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Viti Wazi Tu</span>
          </button>
        </div>
      </div>

      {/* Dynamic Feedback Banner: Mabasi Husika Status */}
      <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
        matchingCount > 0
          ? isFilterActive 
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200'
            : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {matchingCount > 0 ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          )}

          <div>
            <span className="font-extrabold">
              {matchingCount > 0 ? (
                <>
                  Mabasi Husika: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{matchingCount}</span> {matchingCount === 1 ? 'basi lipo' : 'mabasi yapo'} barabarani sasa hivi
                </>
              ) : (
                'Hakuna daladala iliyopatikana kwa vichujio hivi'
              )}
            </span>

            {isFilterActive && (
              <span className="opacity-90 ml-1 block sm:inline text-[11px]">
                {boardingStop && alightStop ? (
                  <>• Safari: <strong>{boardingStop}</strong> ➔ <strong>{alightStop}</strong></>
                ) : boardingStop ? (
                  <>• Kituo cha kupandia: <strong>{boardingStop}</strong></>
                ) : alightStop ? (
                  <>• Kituo cha kushukia: <strong>{alightStop}</strong></>
                ) : null}
                {activeRouteObj && (
                  <> • Ruti: <strong>{activeRouteObj.routeCode}</strong> ({activeRouteObj.name.split('⇄')[0]})</>
                )}
              </span>
            )}
          </div>
        </div>

        {activeRouteObj && (
          <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
            <span className="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-neutral-800 dark:text-neutral-200">
              Nauli: TSh {activeRouteObj.baseFareTzs.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
