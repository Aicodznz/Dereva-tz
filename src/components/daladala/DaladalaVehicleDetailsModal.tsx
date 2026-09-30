import React, { useState } from 'react';
import { 
  DaladalaVehicle, 
  FleetVehicleRecord, 
  DaladalaRoute, 
  DaladalaPassengerRecord,
  DaladalaCrewMember
} from '../../types/daladala.types';
import { 
  X, 
  Bus, 
  Phone, 
  User, 
  ShieldCheck, 
  Wrench, 
  Clock, 
  TrendingUp, 
  Fuel, 
  Navigation, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Send,
  Users,
  CreditCard,
  Banknote,
  QrCode,
  Gauge,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaVehicleDetailsModalProps {
  vehicle: FleetVehicleRecord;
  liveVehicle?: DaladalaVehicle;
  route?: DaladalaRoute;
  passengers: DaladalaPassengerRecord[];
  crewMembers: DaladalaCrewMember[];
  onClose: () => void;
  onUpdateCrew?: (vehicleId: string, driverName: string, conductorName: string, conductorPhone: string) => void;
}

export default function DaladalaVehicleDetailsModal({
  vehicle,
  liveVehicle,
  route,
  passengers,
  crewMembers,
  onClose,
  onUpdateCrew,
}: DaladalaVehicleDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'passengers' | 'crew' | 'maintenance'>('overview');
  
  // Filter passengers for this specific vehicle
  const vehiclePassengers = passengers.filter(
    (p) => p.plateNumber.toUpperCase().trim() === vehicle.plateNumber.toUpperCase().trim()
  );

  // Financial calculations
  const netProfit = vehicle.todayRevenueTzs - vehicle.fuelExpenseTzs - vehicle.terminalFeeTzs;
  const progressPct = vehicle.dailyTargetTzs > 0 ? Math.min(100, Math.round((vehicle.todayRevenueTzs / vehicle.dailyTargetTzs) * 100)) : 0;
  
  // Assigned driver and conductor records
  const assignedDriver = crewMembers.find((c) => c.role === 'driver' && c.name.toLowerCase().includes(vehicle.driverName.toLowerCase().split(' ')[0]));
  const assignedConductor = crewMembers.find((c) => c.role === 'conductor' && c.name.toLowerCase().includes(vehicle.conductorName.toLowerCase().split(' ')[0]));

  // Live seats
  const capacity = liveVehicle?.capacity || 30;
  const seatsTaken = liveVehicle?.seatsTaken || Math.min(capacity, Math.floor(capacity * 0.7));
  const seatsFree = Math.max(0, capacity - seatsTaken);

  // Share report via WhatsApp
  const handleShareReport = () => {
    const text = encodeURIComponent(
      `📊 *RIPOTI YA CHOMBO: ${vehicle.plateNumber} ("${vehicle.nickname}")*\n` +
      `👤 *Mmiliki:* Ripoti ya Safari za Leo\n` +
      `🛣️ *Ruti:* ${vehicle.routeCode} (${route?.name || 'Dar es Salaam'})\n` +
      `👨‍✈️ *Dereva:* ${vehicle.driverName}\n` +
      `🎫 *Kondakta:* ${vehicle.conductorName}\n\n` +
      `💰 *HESABU YA LEO:*\n` +
      `• Mapato Yote: TSh ${vehicle.todayRevenueTzs.toLocaleString()}\n` +
      `• Fedha Taslimu (Cash): TSh ${vehicle.cashCollectedTzs.toLocaleString()}\n` +
      `• Kidijitali / M-Pesa: TSh ${vehicle.digitalCollectedTzs.toLocaleString()}\n` +
      `• Mafuta: TSh ${vehicle.fuelExpenseTzs.toLocaleString()}\n` +
      `• Ushuru wa Stendi: TSh ${vehicle.terminalFeeTzs.toLocaleString()}\n` +
      `• *BAKI YA TAJIRI (NET): TSh ${netProfit.toLocaleString()}* (${progressPct}% ya lengo)\n\n` +
      `👥 *Abiria Waliosafiri:* ${vehiclePassengers.length} abiria\n` +
      `🔄 *Safari Zilizopigwa:* ${vehicle.tripsCount} safari\n` +
      `📍 *Eneo la Sasa:* ${liveVehicle ? `Kuelekea ${liveVehicle.nextStopName} (Kasi: ${liveVehicle.speedKmH} km/h)` : 'Kwenye Ruti'}\n\n` +
      `Imeratibiwa kupitia mfumo wa PapoDaladala.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    toast.success('Ripoti imeandaliwa kutumwa WhatsApp!');
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header with authentic Tanzanian Plate Visual */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-blue-950 text-white p-4 sm:p-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="tz-number-plate text-xs">
                    <span className="tz-strip">TZ</span>
                    <span>{vehicle.plateNumber}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Gari Lako
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
                  <span>"{vehicle.nickname}"</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-600/80 text-blue-100 font-mono">
                    {vehicle.routeCode}
                  </span>
                </h3>
                <p className="text-xs text-neutral-300">
                  {route?.name || 'Kimara ⇄ Kivukoni'} • {liveVehicle?.vehicleModel || 'Toyota Coaster (30 Seater)'}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block">Baki ya Tajiri Leo</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400 block font-mono">
                TSh {netProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-neutral-400">
                Lengo: TSh {vehicle.dailyTargetTzs.toLocaleString()} ({progressPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Muhtasari & GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('financials')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'financials'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Hesabu & Mapato</span>
          </button>

          <button
            onClick={() => setActiveTab('passengers')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'passengers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Abiria wa Chombo ({vehiclePassengers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('crew')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'crew'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dereva & Konda</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'maintenance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Service & Bima</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: OVERVIEW & LIVE GPS */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Live Status Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Kasi ya Sasa</span>
                  <span className="text-xl font-black text-blue-900 dark:text-blue-100 font-mono mt-0.5 block">
                    {liveVehicle ? `${liveVehicle.speedKmH} km/h` : '35 km/h'}
                  </span>
                  <span className="text-[10px] text-blue-500">Speed Governor: Salama</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Viti Ndani ya Gari</span>
                  <span className="text-xl font-black text-emerald-900 dark:text-emerald-100 font-mono mt-0.5 block">
                    {seatsTaken}/{capacity}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {seatsFree > 0 ? `Viti ${seatsFree} vipo wazi` : 'Chombo kimejaa (FULL)'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Safari Zilizopigwa</span>
                  <span className="text-xl font-black text-amber-900 dark:text-amber-100 font-mono mt-0.5 block">
                    {vehicle.tripsCount} Raundi
                  </span>
                  <span className="text-[10px] text-amber-600">Ruti: {vehicle.routeCode}</span>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900">
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase block">Kituo Kinachofuata</span>
                  <span className="text-sm font-black text-purple-900 dark:text-purple-100 truncate mt-1 block">
                    {liveVehicle?.nextStopName || 'Shekilango'}
                  </span>
                  <span className="text-[10px] text-purple-500 font-mono">
                    ETA: ~{liveVehicle?.etaMinutesToNextStop || 3} min
                  </span>
                </div>
              </div>

              {/* Live Location & Route Info */}
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <h4 className="font-black text-xs uppercase tracking-wider text-neutral-900 dark:text-white">
                      Taarifa za Safari & Ruti ya Sasa
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-[10px]">
                    ● GPS Iko Hewani
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-500 font-bold block">Ruti Rasmi:</span>
                    <strong className="text-neutral-900 dark:text-white block mt-0.5">
                      {route ? `${route.origin} ⇄ ${route.destination}` : 'Kimara Mwisho ⇄ Kivukoni Ferry'}
                    </strong>
                    <span className="text-[11px] text-neutral-500">Kupitia: {route?.via || 'Barabara ya Morogoro'}</span>
                  </div>

                  <div>
                    <span className="text-neutral-500 font-bold block">Nauli ya LATRA:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      Mtu Mzima: TSh {route?.baseFareTzs || 500} • Mwanafunzi: TSh {route?.studentFareTzs || 200}
                    </strong>
                    <span className="text-[11px] text-neutral-500">Umbali: ~{route?.distanceKm || 16.5} km</span>
                  </div>
                </div>
              </div>

              {/* Crew Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      DRV
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase block">Dereva Mkuu</span>
                      <strong className="text-xs text-neutral-900 dark:text-white block">{vehicle.driverName}</strong>
                      <span className="text-[11px] text-neutral-500">{assignedDriver?.phone || '0713 456 789'}</span>
                    </div>
                  </div>
                  <a
                    href={`tel:${assignedDriver?.phone || '0713456789'}`}
                    className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 hover:bg-blue-100 transition"
                    title="Piga simu kwa Dereva"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

                <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                      KND
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Kondakta (Konda)</span>
                      <strong className="text-xs text-neutral-900 dark:text-white block">{vehicle.conductorName}</strong>
                      <span className="text-[11px] text-neutral-500">{assignedConductor?.phone || '0754 112 233'}</span>
                    </div>
                  </div>
                  <a
                    href={`tel:${assignedConductor?.phone || '0754112233'}`}
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 hover:bg-emerald-100 transition"
                    title="Piga simu kwa Konda"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIALS & HESABU */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase block">Lengo la Hesabu</span>
                  <span className="text-lg font-black text-neutral-900 dark:text-white font-mono mt-0.5 block">
                    TSh {vehicle.dailyTargetTzs.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-500">Makubaliano ya dereva</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase block">Mapato Yote Leo</span>
                  <span className="text-lg font-black text-blue-900 dark:text-blue-100 font-mono mt-0.5 block">
                    TSh {vehicle.todayRevenueTzs.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-blue-600">{progressPct}% ya lengo la siku</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Faida Halisi (Net Profit)</span>
                  <span className="text-lg font-black text-emerald-900 dark:text-emerald-100 font-mono mt-0.5 block">
                    TSh {netProfit.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600">Baada ya mafuta & ushuru</span>
                </div>
              </div>

              {/* Breakdown details */}
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <h4 className="font-black text-xs uppercase tracking-wider text-neutral-900 dark:text-white">
                  Mgawanyo wa Pesa Zilizokusanywa
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                      <Banknote className="w-4 h-4 text-amber-500" />
                      Fedha Taslimu (Cash alizonazo Konda):
                    </span>
                    <strong className="text-neutral-900 dark:text-white font-mono text-sm">
                      TSh {vehicle.cashCollectedTzs.toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                      <QrCode className="w-4 h-4 text-blue-500" />
                      Malipo ya Kidijitali (M-Pesa / Papo / QR):
                    </span>
                    <strong className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                      TSh {vehicle.digitalCollectedTzs.toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                      <Fuel className="w-4 h-4 text-red-500" />
                      Mafuta (Diseli/Petroli) Yaliyowekwa:
                    </span>
                    <strong className="text-red-600 dark:text-red-400 font-mono text-sm">
                      - TSh {vehicle.fuelExpenseTzs.toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                      <FileText className="w-4 h-4 text-purple-500" />
                      Ushuru wa Stendi (Magufuli / Kivukoni):
                    </span>
                    <strong className="text-neutral-700 dark:text-neutral-300 font-mono text-sm">
                      - TSh {vehicle.terminalFeeTzs.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PASSENGERS ON THIS VEHICLE */}
          {activeTab === 'passengers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-wider">
                    Abiria Waliopanda Chombo {vehicle.plateNumber} Leo
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Orodha ya abiria, tiketi zao na vituo walivyopandia.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs">
                  Jumla: {vehiclePassengers.length} Abiria
                </span>
              </div>

              {vehiclePassengers.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 space-y-2">
                  <Users className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="font-bold text-xs text-neutral-600 dark:text-neutral-400">
                    Bado hakuna abiria aliyerekodiwa kwenye gari hili kwa siku ya leo.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Kondakta anapokata tiketi au abiria anaposhika kiti, wataonekana hapa moja kwa moja.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  {vehiclePassengers.map((pass) => (
                    <div key={pass.id} className="p-3 bg-white dark:bg-neutral-900 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-neutral-900 dark:text-white">{pass.passengerName}</strong>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            {pass.ticketCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {pass.boardingStop} ➔ {pass.destinationStop} • Simu: {pass.passengerPhone}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                          TSh {pass.fareTzs.toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${pass.paymentMethod === 'cash' ? 'text-amber-500' : 'text-blue-500'}`}>
                          {pass.paymentMethod === 'cash' ? 'Taslimu' : 'M-Pesa'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CREW DETAILS */}
          {activeTab === 'crew' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h4 className="font-black text-xs uppercase tracking-wider text-neutral-900 dark:text-white">
                      Dereva Aliyekabidhiwa Chombo
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                    Kazini
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Jina Kamili:</span>
                    <strong className="text-sm text-neutral-900 dark:text-white block mt-0.5">
                      {vehicle.driverName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Simu ya Mkononi:</span>
                    <strong className="text-sm text-neutral-900 dark:text-white block mt-0.5">
                      {assignedDriver?.phone || '0713 456 789'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Leseni ya LATRA:</span>
                    <strong className="font-mono text-neutral-700 dark:text-neutral-300 block mt-0.5">
                      {assignedDriver?.licenseNumber || 'LATRA-DRV-8942-TZ (Class C)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Ukadiriaji wa Abiria (Rating):</span>
                    <strong className="text-amber-500 block mt-0.5">
                      ⭐ {assignedDriver?.rating || 4.9} ({assignedDriver?.tripsCount || 1420} safari)
                    </strong>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={`tel:${assignedDriver?.phone || '0713456789'}`}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Piga Simu kwa Dereva</span>
                  </a>
                </div>
              </div>

              {/* Conductor Details */}
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-black text-xs uppercase tracking-wider text-neutral-900 dark:text-white">
                      Kondakta (Konda)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                    Kazini
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Jina Kamili:</span>
                    <strong className="text-sm text-neutral-900 dark:text-white block mt-0.5">
                      {vehicle.conductorName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Simu ya M-Pesa ya Nauli:</span>
                    <strong className="text-sm text-neutral-900 dark:text-white block mt-0.5">
                      {assignedConductor?.phone || '0754 112 233'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Kitambulisho cha Taifa (NIDA):</span>
                    <strong className="font-mono text-neutral-700 dark:text-neutral-300 block mt-0.5">
                      {assignedConductor?.nidaNumber || '19920518-21104-00003-14'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Ukadiriaji wa Abiria (Rating):</span>
                    <strong className="text-amber-500 block mt-0.5">
                      ⭐ {assignedConductor?.rating || 4.8} ({assignedConductor?.tripsCount || 1390} safari)
                    </strong>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={`tel:${assignedConductor?.phone || '0754112233'}`}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Piga Simu kwa Konda</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MAINTENANCE & COMPLIANCE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    Service ya Oili ya Injini:
                  </span>
                  <span className={`font-mono font-bold px-2.5 py-1 rounded-xl ${
                    vehicle.oilServiceKmRemaining < 500
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    KM {vehicle.oilServiceKmRemaining.toLocaleString()} zimebaki
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Leseni ya Barabara (LATRA Permit):
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">
                    Inaisha: {vehicle.latraExpiryDate}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Bima ya Chombo (Insurance):
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">
                    Inaisha: {vehicle.insuranceExpiryDate}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.success(`Ombi la ukaguzi na service ya gari ${vehicle.plateNumber} limerekodiwa.`)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 font-bold text-xs transition active:scale-95 shadow-sm"
              >
                Panga Tarehe ya Service & Matengenezo
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer with Quick Actions */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/80 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleShareReport}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Tuma Ripoti kwa WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition active:scale-95"
          >
            Funga
          </button>
        </div>
      </div>
    </div>
  );
}
