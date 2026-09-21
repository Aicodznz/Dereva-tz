import React, { useState } from 'react';
import { DaladalaVehicle, DaladalaRoute } from '../../types/daladala.types';
import { 
  Users, 
  QrCode, 
  Banknote, 
  AlertTriangle, 
  Gauge, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Minus, 
  RefreshCw,
  Send,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaConductorModeProps {
  vehicle: DaladalaVehicle;
  route?: DaladalaRoute;
  onUpdateVehicle: (updated: Partial<DaladalaVehicle>) => void;
}

export default function DaladalaConductorMode({
  vehicle,
  route,
  onUpdateVehicle,
}: DaladalaConductorModeProps) {
  const [activeTab, setActiveTab] = useState<'seats' | 'scanner' | 'cash' | 'driver'>('seats');

  // Scanner state
  const [scannedTicketCode, setScannedTicketCode] = useState('');
  const [scanResult, setScanResult] = useState<{ valid: boolean; message: string; passenger?: string } | null>(null);

  // Cash / Change calculator state
  const [receivedAmount, setReceivedAmount] = useState(1000);
  const [ticketFare, setTicketFare] = useState(600);

  // Off route / Traffic report state
  const [isReportingDeviation, setIsReportingDeviation] = useState(false);
  const [deviationReason, setDeviationReason] = useState('Njia ya kawaida ina foleni kali');

  // Fast Seat adjustments (#6, #20)
  const handleSeatChange = (delta: number) => {
    const newTaken = Math.max(0, Math.min(vehicle.capacity, vehicle.seatsTaken + delta));
    const seatsRemaining = vehicle.capacity - newTaken;

    let newStatus: DaladalaVehicle['seatStatus'] = 'available';
    if (seatsRemaining === 0) newStatus = vehicle.standingCount > 0 ? 'standing' : 'full';
    else if (seatsRemaining <= 3) newStatus = 'few';

    onUpdateVehicle({
      seatsTaken: newTaken,
      seatStatus: newStatus,
      lastUpdated: 'Muda huu',
    });
    toast.success(`Nafasi zimebadilishwa: ${seatsRemaining} viti vimebaki.`);
  };

  const handleSetFull = () => {
    onUpdateVehicle({
      seatsTaken: vehicle.capacity,
      seatStatus: 'full',
      lastUpdated: 'Muda huu',
    });
    toast.warning('Gari limewekwa FULL! Abiria hawataarifiwa kuwa kuna viti.');
  };

  const handleSetStanding = () => {
    onUpdateVehicle({
      seatsTaken: vehicle.capacity,
      standingCount: Math.min(20, vehicle.standingCount + 2),
      seatStatus: 'standing',
      lastUpdated: 'Muda huu',
    });
    toast.info('Hali ya Kusimama (Msimamo) imewekwa.');
  };

  // QR Ticket Validator (#19, #20)
  const handleVerifyTicket = () => {
    if (!scannedTicketCode.trim()) {
      toast.error('Weka namba au skani msimbo wa tiketi');
      return;
    }

    if (scannedTicketCode.toUpperCase().includes('DL-') || scannedTicketCode.includes('PAPO-DALADALA')) {
      setScanResult({
        valid: true,
        message: 'Tiketi Halali! Nauli TSh 600 Imethibitishwa.',
        passenger: 'Mteja wa Papo Hapo',
      });
      toast.success('Tiketi imethibitishwa vizuri!');
    } else {
      setScanResult({
        valid: false,
        message: 'Tiketi siyo halali au imekwisha muda wake!',
      });
      toast.error('Tiketi batili!');
    }
  };

  // Next Stop Voice Announcer (#21: Driver Mode)
  const handleAnnounceNextStop = () => {
    if (!vehicle.nextStopName) return;
    const text = `Kituo kinachofuata ni ${vehicle.nextStopName}. Abiria wa kushuka tafadhali sogea mlangoni.`;
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'sw-TZ';
      window.speechSynthesis.speak(utterance);
    }
    toast.info(`Tangazo la sauti: "${text}"`);
  };

  // Broadcast Route Deviation (#10)
  const handleBroadcastDeviation = () => {
    onUpdateVehicle({
      isOffRoute: true,
      offRouteReason: deviationReason,
      lastUpdated: 'Muda huu',
    });
    setIsReportingDeviation(false);
    toast.warning('Taarifa ya kuchepuka ruti imetumwa kwa abiria wote!');
  };

  const changeDue = Math.max(0, receivedAmount - ticketFare);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header: Driver / Conductor HUD */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
              Njia ya Kondakta na Dereva (Conductor & Driver Mode)
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gari: <strong className="text-neutral-800 dark:text-neutral-200">{vehicle.plateNumber}</strong> ({vehicle.nickname}) • Ruti: {vehicle.routeCode}
          </p>
        </div>

        {/* Mode Switcher Pills */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('seats')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'seats'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            🪑 Viti ({vehicle.capacity - vehicle.seatsTaken})
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'scanner'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            🎫 Skani QR
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'cash'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            💰 Chenji
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'driver'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            🚍 Dereva HUD
          </button>
        </div>
      </div>

      {/* TAB 1: SEAT OCCUPANCY MANAGER (#6, #20) */}
      {activeTab === 'seats' && (
        <div className="space-y-4">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                Viti Vilivyobaki Wazi
              </span>
              <span className="text-3xl font-black text-neutral-900 dark:text-white">
                {vehicle.capacity - vehicle.seatsTaken}
              </span>
              <span className="text-xs text-neutral-400 ml-1.5">/ {vehicle.capacity}</span>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full font-black text-xs uppercase ${
                vehicle.seatStatus === 'available'
                  ? 'bg-emerald-500 text-white'
                  : vehicle.seatStatus === 'few'
                  ? 'bg-amber-500 text-white'
                  : vehicle.seatStatus === 'standing'
                  ? 'bg-orange-500 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                Hali: {vehicle.seatStatus}
              </span>
              {vehicle.standingCount > 0 && (
                <p className="text-[11px] font-bold text-orange-600 mt-1">
                  Kusimama: {vehicle.standingCount} abiria
                </p>
              )}
            </div>
          </div>

          {/* Quick Increment/Decrement Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleSeatChange(-1)}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Kiti Kimefunguka (+1 Wazi)</span>
            </button>

            <button
              onClick={() => handleSeatChange(1)}
              className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Minus className="w-4 h-4" />
              <span>Abiria Amepanda (-1 Wazi)</span>
            </button>

            <button
              onClick={handleSetStanding}
              className="py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <Users className="w-4 h-4" />
              <span>Weka Kusimama</span>
            </button>

            <button
              onClick={handleSetFull}
              className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Weka FULL</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: QR TICKET SCANNER (#19, #20) */}
      {activeTab === 'scanner' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100">
              Kikagua Tiketi za Abiria (QR Code Scanner)
            </h4>
            <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
              Weka namba ya tiketi au tumia kamera ya simu kuthibitisha nauli ya mteja.
            </p>

            <div className="flex gap-2 max-w-sm mx-auto mt-2">
              <input
                type="text"
                value={scannedTicketCode}
                onChange={(e) => setScannedTicketCode(e.target.value)}
                placeholder="Ingiza DL-XXXXXX au skani..."
                className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-xs font-mono"
              />
              <button
                onClick={handleVerifyTicket}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
              >
                Hakiki
              </button>
            </div>
          </div>

          {scanResult && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              scanResult.valid
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-900 dark:text-red-200'
            }`}>
              {scanResult.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-extrabold">{scanResult.message}</p>
                {scanResult.passenger && <p className="text-[11px] opacity-80">Mteja: {scanResult.passenger}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CASH & CHENJI CALCULATOR */}
      {activeTab === 'cash' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                Pesa Iliyotolewa na Abiria:
              </label>
              <div className="flex items-center gap-1.5">
                {[1000, 2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setReceivedAmount(amt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${
                      receivedAmount === amt
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block mb-1">
                Nauli ya Safari:
              </label>
              <div className="flex items-center gap-1.5">
                {[500, 600, 700, 1000].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTicketFare(f)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${
                      ticketFare === f
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900 text-white flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                Chenji ya Kumrudishia Mteja
              </span>
              <span className="text-2xl font-black text-amber-400">
                TSh {changeDue.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => toast.success(`Chenji ya TSh ${changeDue.toLocaleString()} imethibitishwa!`)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-900 font-extrabold text-xs transition"
            >
              Nimempa Chenji
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: DRIVER HUD & DEVIATION ALERT (#10, #21) */}
      {activeTab === 'driver' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
              <span className="text-[10px] text-neutral-500 font-semibold block">Spidi ya Sasa</span>
              <strong className="text-lg font-black text-neutral-900 dark:text-neutral-100 flex items-center justify-center gap-1">
                <Gauge className="w-4 h-4 text-blue-600" />
                {vehicle.speedKmH} km/h
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
              <span className="text-[10px] text-neutral-500 font-semibold block">Kituo Kinachofuata</span>
              <strong className="text-xs font-extrabold text-neutral-900 dark:text-neutral-100 truncate block mt-1">
                {vehicle.nextStopName}
              </strong>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center">
              <button
                onClick={handleAnnounceNextStop}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Volume2 className="w-4 h-4" />
                <span>Tangaza Kituo kwa Sauti</span>
              </button>
            </div>
          </div>

          {/* Route Deviation Broadcaster (#10) */}
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Arifa ya Kuchepuka Ruti (Off-Route Deviation)
              </span>
              <button
                onClick={() => setIsReportingDeviation(!isReportingDeviation)}
                className="text-xs font-bold text-red-600 underline"
              >
                {isReportingDeviation ? 'Funga' : 'Badili Njia'}
              </button>
            </div>

            {isReportingDeviation && (
              <div className="space-y-2 pt-2 border-t border-red-200 dark:border-red-900">
                <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block">
                  Sababu ya Kukatisha/Kuchepuka Ruti:
                </label>
                <select
                  value={deviationReason}
                  onChange={(e) => setDeviationReason(e.target.value)}
                  className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs bg-white dark:bg-neutral-800"
                >
                  <option value="Njia ya kawaida ina foleni kali sana">Njia ya kawaida ina foleni kali</option>
                  <option value="Kuna ajali imefunga barabara mbele">Kuna ajali imefunga barabara mbele</option>
                  <option value="Barabara imejaa maji ya mvua">Barabara imejaa maji ya mvua</option>
                  <option value="Matengenezo ya barabara (Roadworks)">Matengenezo ya barabara (Roadworks)</option>
                </select>
                <button
                  onClick={handleBroadcastDeviation}
                  className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  Tuma Arifa kwa Abiria Wote
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
