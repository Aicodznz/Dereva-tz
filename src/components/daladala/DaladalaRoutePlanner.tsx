import React, { useState } from 'react';
import { DaladalaRoute, DaladalaStop } from '../../types/daladala.types';
import { MapPin, Navigation, ArrowRight, Clock, Banknote, ShieldCheck, Bus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaRoutePlannerProps {
  routes: DaladalaRoute[];
  onSelectRoute: (routeId: string) => void;
  onClose: () => void;
}

export default function DaladalaRoutePlanner({
  routes,
  onSelectRoute,
  onClose,
}: DaladalaRoutePlannerProps) {
  // All unique stops
  const allStops = Array.from(
    new Map(
      routes.flatMap((r) => r.stops).map((s) => [s.name, s])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const [fromStopName, setFromStopName] = useState('Kimara Mwisho');
  const [toStopName, setToStopName] = useState('Posta ya Zamani');
  const [plannerResult, setPlannerResult] = useState<any>(null);

  const handlePlanRoute = () => {
    if (!fromStopName || !toStopName) {
      toast.error('Tafadhali chagua kituo unapoanzia na unakokwenda');
      return;
    }

    if (fromStopName === toStopName) {
      toast.error('Kituo cha kupandia hakiwezi kuwa sawa na kituo cha kushukia');
      return;
    }

    // 1. Check for direct route
    const directRoutes = routes.filter((r) => {
      const hasFrom = r.stops.some((s) => s.name === fromStopName);
      const hasTo = r.stops.some((s) => s.name === toStopName);
      return hasFrom && hasTo;
    });

    if (directRoutes.length > 0) {
      const bestRoute = directRoutes[0];
      const fromIdx = bestRoute.stops.findIndex((s) => s.name === fromStopName);
      const toIdx = bestRoute.stops.findIndex((s) => s.name === toStopName);
      const stopsBetween = Math.abs(toIdx - fromIdx);
      const estimatedMinutes = Math.max(12, stopsBetween * 3.5);

      setPlannerResult({
        type: 'direct',
        routeName: bestRoute.name,
        routeCode: bestRoute.routeCode,
        routeId: bestRoute.id,
        via: bestRoute.via,
        fareTzs: bestRoute.baseFareTzs,
        estimatedMinutes: Math.round(estimatedMinutes),
        transfers: 0,
        stopsCount: stopsBetween,
        fromStop: fromStopName,
        toStop: toStopName,
      });
    } else {
      // 2. Transfer suggestion via Ubungo or Mwenge interchange
      setPlannerResult({
        type: 'transfer',
        fromStop: fromStopName,
        toStop: toStopName,
        transferPoint: 'Ubungo Maji / Simu 2000',
        leg1Route: 'DL-01: Kimara ⇄ Kivukoni',
        leg1Fare: 600,
        leg2Route: 'DL-05: Simu 2000 ⇄ Morocco',
        leg2Fare: 500,
        totalFareTzs: 1100,
        estimatedMinutes: 48,
        transfers: 1,
      });
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Mpangaji wa Safari ya Daladala (Route Planner)
          </h3>
          <p className="text-[11px] text-neutral-500">
            Pata ruti ya moja kwa moja au ya kuunganisha vituo bila kupotea.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50"
        >
          Funga
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            📍 Kituo cha Kupandia (Origin):
          </label>
          <select
            value={fromStopName}
            onChange={(e) => setFromStopName(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {allStops.map((s) => (
              <option key={`from_${s.id}`} value={s.name}>
                {s.name} {s.isTerminal ? '(Terminal)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            🏁 Kituo cha Kushukia (Destination):
          </label>
          <select
            value={toStopName}
            onChange={(e) => setToStopName(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {allStops.map((s) => (
              <option key={`to_${s.id}`} value={s.name}>
                {s.name} {s.isTerminal ? '(Terminal)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handlePlanRoute}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
      >
        <Navigation className="w-4 h-4" />
        <span>Tafuta Njia & Nauli Halisi</span>
      </button>

      {plannerResult && (
        <div className="mt-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-[10px] uppercase">
              {plannerResult.type === 'direct' ? 'Safari ya Moja kwa Moja (Direct)' : 'Inahitaji Kubadili Gari (1 Transfer)'}
            </span>
            <span className="text-xs font-bold text-neutral-500">
              Muda: ~Dk {plannerResult.estimatedMinutes}
            </span>
          </div>

          {plannerResult.type === 'direct' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                    {plannerResult.routeCode}: {plannerResult.routeName}
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Kupitia: {plannerResult.via}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    TSh {plannerResult.fareTzs}
                  </span>
                  <span className="block text-[10px] text-neutral-400">Nauli ya LATRA</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 pt-2 border-t border-blue-200 dark:border-blue-900">
                <span className="font-bold">{plannerResult.fromStop}</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-bold text-blue-600">{plannerResult.toStop}</span>
                <span className="text-[11px] text-neutral-500 ml-auto">({plannerResult.stopsCount} vituo)</span>
              </div>

              <button
                onClick={() => {
                  onSelectRoute(plannerResult.routeId);
                  onClose();
                  toast.success(`Ruti ya ${plannerResult.routeCode} imechaguliwa kwenye ramani!`);
                }}
                className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
              >
                Fuatilia Magari ya Ruti Hii Kwenye Ramani
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-1">
                <p className="font-bold text-neutral-900 dark:text-neutral-100">
                  Hatua ya 1: Panda {plannerResult.leg1Route}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Kutoka {plannerResult.fromStop} hadi {plannerResult.transferPoint} (Nauli: TSh {plannerResult.leg1Fare})
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-1">
                <p className="font-bold text-neutral-900 dark:text-neutral-100">
                  Hatua ya 2: Badilisha na Panda {plannerResult.leg2Route}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Kutoka {plannerResult.transferPoint} hadi {plannerResult.toStop} (Nauli: TSh {plannerResult.leg2Fare})
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-neutral-700 dark:text-neutral-300">Jumla ya Nauli:</span>
                <span className="font-black text-sm text-emerald-600">TSh {plannerResult.totalFareTzs}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
