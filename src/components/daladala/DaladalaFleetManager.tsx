import React, { useState } from 'react';
import { FleetVehicleRecord, TerminalQueueInfo } from '../../types/daladala.types';
import { 
  Building2, 
  Banknote, 
  Wrench, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Fuel, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaFleetManagerProps {
  fleetRecords: FleetVehicleRecord[];
  terminals: TerminalQueueInfo[];
}

export default function DaladalaFleetManager({
  fleetRecords,
  terminals,
}: DaladalaFleetManagerProps) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'maintenance' | 'terminals'>('revenue');

  // Aggregates
  const totalRevenue = fleetRecords.reduce((acc, f) => acc + f.todayRevenueTzs, 0);
  const totalTarget = fleetRecords.reduce((acc, f) => acc + f.dailyTargetTzs, 0);
  const totalFuel = fleetRecords.reduce((acc, f) => acc + f.fuelExpenseTzs, 0);
  const totalNetProfit = totalRevenue - totalFuel - (fleetRecords.length * 4000);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-2">
        <div>
          <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Usimamizi wa Magari, Hesabu ya Tajiri & Stendi (Fleet & Terminal Hub)
          </h3>
          <p className="text-xs text-neutral-500">
            Fuatilia mapato ya kila gari, matengenezo, na foleni za stendi za Dar es Salaam.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'revenue'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            📊 Mapato ya Leo
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'maintenance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            🛠️ Matengenezo & Bima
          </button>
          <button
            onClick={() => setActiveTab('terminals')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'terminals'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            📍 Foleni za Stendi
          </button>
        </div>
      </div>

      {/* TAB 1: DAILY REVENUE & HESABU YA TAJIRI (#22, #23) */}
      {activeTab === 'revenue' && (
        <div className="space-y-4">
          {/* Top Aggregate Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Jumla ya Mapato
              </span>
              <span className="text-lg font-black text-blue-900 dark:text-blue-100 block mt-0.5">
                TSh {totalRevenue.toLocaleString()}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                Lengo: TSh {totalTarget.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Faida ya Mmiliki (Net)
              </span>
              <span className="text-lg font-black text-emerald-900 dark:text-emerald-100 block mt-0.5">
                TSh {totalNetProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Baada ya mafuta & ushuru</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                Gharama za Mafuta
              </span>
              <span className="text-lg font-black text-amber-900 dark:text-amber-100 block mt-0.5">
                TSh {totalFuel.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Gharama ya jumla ya diesel</span>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                Mzunguko wa Safari
              </span>
              <span className="text-lg font-black text-purple-900 dark:text-purple-100 block mt-0.5">
                {fleetRecords.reduce((acc, f) => acc + f.tripsCount, 0)} Raundi
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400">Magari 3 kazini</span>
            </div>
          </div>

          {/* Vehicle by Vehicle Breakdown Table */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/80 px-4 py-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 grid grid-cols-12">
              <span className="col-span-3">Namba ya Gari</span>
              <span className="col-span-3">Dereva / Konda</span>
              <span className="col-span-2 text-right">Mapato ya Leo</span>
              <span className="col-span-2 text-right">Mafuta / Ushuru</span>
              <span className="col-span-2 text-right">Baki ya Tajiri</span>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {fleetRecords.map((f) => {
                const baki = f.todayRevenueTzs - f.fuelExpenseTzs - f.terminalFeeTzs;
                const progressPct = Math.min(100, Math.round((f.todayRevenueTzs / f.dailyTargetTzs) * 100));

                return (
                  <div key={f.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <div className="col-span-3">
                      <strong className="text-neutral-900 dark:text-white block">{f.plateNumber}</strong>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">"{f.nickname}" ({f.routeCode})</span>
                    </div>

                    <div className="col-span-3 text-neutral-600 dark:text-neutral-300 text-[11px]">
                      <p>Dereva: {f.driverName}</p>
                      <p className="text-[10px] text-neutral-400">Konda: {f.conductorName}</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="font-extrabold text-neutral-900 dark:text-neutral-100">
                        TSh {f.todayRevenueTzs.toLocaleString()}
                      </span>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold">{progressPct}% ya lengo</span>
                    </div>

                    <div className="col-span-2 text-right text-neutral-500 text-[11px]">
                      <span>TSh {(f.fuelExpenseTzs + f.terminalFeeTzs).toLocaleString()}</span>
                    </div>

                    <div className="col-span-2 text-right">
                      <strong className="font-black text-emerald-600 dark:text-emerald-400">
                        TSh {baki.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAINTENANCE & COMPLIANCE (#24) */}
      {activeTab === 'maintenance' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fleetRecords.map((f) => (
            <div key={`maint_${f.id}`} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-800/20">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span className="font-black text-xs text-neutral-900 dark:text-white">{f.plateNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  Kazini
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Engine Oil Status */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Service ya Oili:
                  </span>
                  <span className={`font-bold ${f.oilServiceKmRemaining < 500 ? 'text-red-600 animate-pulse' : 'text-neutral-800 dark:text-neutral-200'}`}>
                    KM {f.oilServiceKmRemaining} zimebaki
                  </span>
                </div>

                {/* LATRA Road License */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Leseni ya LATRA:
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {f.latraExpiryDate}
                  </span>
                </div>

                {/* Insurance Expiry */}
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Bima ya Gari:
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {f.insuranceExpiryDate}
                  </span>
                </div>
              </div>

              <button
                onClick={() => toast.success(`Ombi la service ya gari ${f.plateNumber} limerekodiwa.`)}
                className="w-full py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs hover:opacity-90 transition"
              >
                Ratiba Service / Matengenezo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: TERMINAL & STAND QUEUES (#25) */}
      {activeTab === 'terminals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {terminals.map((t) => (
              <div key={t.terminalId} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-800/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-xs text-neutral-900 dark:text-neutral-100">{t.terminalName}</h4>
                    <p className="text-[10px] text-neutral-500">Ruti: {t.routes.join(', ')}</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Foleni ya Magari Stendi
                  </span>
                  {t.queuedVehicles.map((q) => (
                    <div
                      key={q.plateNumber}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        q.status === 'boarding'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black">{q.queuePosition}. {q.plateNumber}</span>
                          <span className="text-[9px] font-bold px-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                            {q.routeCode}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">Kuelekea: {q.destination}</p>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-[11px] block">
                          {q.status === 'boarding' ? `Inajaza (Viti ${q.seatsRemaining})` : `Inafuata (Dk ${q.departureEtaMinutes})`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
