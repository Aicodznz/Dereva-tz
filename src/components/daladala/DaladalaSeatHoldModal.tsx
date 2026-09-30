import React, { useState, useEffect } from 'react';
import { DaladalaVehicle, DaladalaRoute, DaladalaSeatHold } from '../../types/daladala.types';
import { 
  Armchair, 
  X, 
  Clock, 
  MapPin, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  PhoneCall, 
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaSeatHoldModalProps {
  vehicle: DaladalaVehicle;
  route?: DaladalaRoute;
  initialBoardingStop?: string;
  initialAlightStop?: string;
  onClose: () => void;
  onHoldCreated?: (hold: DaladalaSeatHold) => void;
}

export default function DaladalaSeatHoldModal({
  vehicle,
  route,
  initialBoardingStop = '',
  initialAlightStop = '',
  onClose,
  onHoldCreated,
}: DaladalaSeatHoldModalProps) {
  const [passengerName, setPassengerName] = useState(() => {
    try {
      const user = localStorage.getItem('papo_daladala_session_user');
      if (user) {
        const u = JSON.parse(user);
        return u.fullName || '';
      }
    } catch (e) {}
    return '';
  });

  const [passengerPhone, setPassengerPhone] = useState(() => {
    try {
      const user = localStorage.getItem('papo_daladala_session_user');
      if (user) {
        const u = JSON.parse(user);
        return u.phone || '';
      }
    } catch (e) {}
    return '';
  });

  const [boardingStop, setBoardingStop] = useState<string>(initialBoardingStop || vehicle.nextStopName || '');
  const [alightStop, setAlightStop] = useState<string>(initialAlightStop || route?.destination || '');
  const [passengerType, setPassengerType] = useState<'adult' | 'student' | 'special'>('adult');
  const [activeHold, setActiveHold] = useState<DaladalaSeatHold | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(300); // 5 mins
  const [copied, setCopied] = useState(false);

  // Check if there is an active hold for this vehicle in localStorage
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem('papo_daladala_seat_holds');
      if (savedRaw) {
        const holds: DaladalaSeatHold[] = JSON.parse(savedRaw);
        const current = holds.find(
          (h) => h.vehicleId === vehicle.id && h.status === 'active' && h.expiresAt > Date.now()
        );
        if (current) {
          setActiveHold(current);
          setTimeLeftSeconds(Math.max(0, Math.round((current.expiresAt - Date.now()) / 1000)));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [vehicle.id]);

  // Timer countdown
  useEffect(() => {
    if (!activeHold) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((activeHold.expiresAt - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        // Expired
        setActiveHold((prev) => (prev ? { ...prev, status: 'expired' } : null));
        toast.warning('Muda wa dakika 5 wa kushikilia kiti umemalizika!');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeHold]);

  const handleCreateHold = (e: React.FormEvent) => {
    e.preventDefault();

    if (!passengerName.trim()) {
      toast.error('Tafadhali andika jina lako');
      return;
    }
    if (!passengerPhone.trim()) {
      toast.error('Tafadhali andika namba yako ya simu');
      return;
    }
    if (!boardingStop) {
      toast.error('Tafadhali chagua kituo unachopandia');
      return;
    }

    const seatsRemaining = vehicle.capacity - vehicle.seatsTaken;
    if (seatsRemaining <= 0) {
      toast.error('Samahani, gari hili limejaa (Full). Huwezi kushikilia kiti kwa sasa.');
      return;
    }

    const holdCode = `HLD-${Math.floor(100 + Math.random() * 900)}`;
    const fare = passengerType === 'student' ? 200 : (route?.baseFareTzs || 600);
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    const newHold: DaladalaSeatHold = {
      id: `hold_${now}`,
      holdCode,
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim(),
      boardingStop,
      alightStop,
      fareTzs: fare,
      passengerType,
      createdAt: now,
      expiresAt,
      status: 'active',
    };

    // Save to local storage
    try {
      const savedRaw = localStorage.getItem('papo_daladala_seat_holds');
      const holds: DaladalaSeatHold[] = savedRaw ? JSON.parse(savedRaw) : [];
      holds.unshift(newHold);
      localStorage.setItem('papo_daladala_seat_holds', JSON.stringify(holds));
    } catch (e) {
      console.error(e);
    }

    setActiveHold(newHold);
    setTimeLeftSeconds(300);
    onHoldCreated?.(newHold);
    toast.success(`Kiti kimeshikiliwa! Namba yako ya uthibitisho ni ${holdCode}. Dereva & Konda wamearifiwa.`);
  };

  const handleCancelHold = () => {
    if (!activeHold) return;
    try {
      const savedRaw = localStorage.getItem('papo_daladala_seat_holds');
      if (savedRaw) {
        const holds: DaladalaSeatHold[] = JSON.parse(savedRaw);
        const updated = holds.map((h) => (h.id === activeHold.id ? { ...h, status: 'cancelled' as const } : h));
        localStorage.setItem('papo_daladala_seat_holds', JSON.stringify(updated));
      }
    } catch (e) {}

    setActiveHold(null);
    toast.info('Umesitisha ushikiliaji wa kiti.');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[600] bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm sm:text-base text-neutral-900 dark:text-white">
                  Shikilia Kiti Changu (Dk 5)
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                  BURE
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Gari: <strong className="text-neutral-800 dark:text-neutral-200">{vehicle.plateNumber}</strong> ({vehicle.nickname})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeHold && activeHold.status === 'active' ? (
          /* ACTIVE HOLD TICKET CARD */
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold text-[10px] uppercase tracking-wider">
                  Kiti Kimeshikiliwa Halali
                </span>
                <div className="flex items-center gap-1 font-mono font-black text-sm bg-black/30 px-2.5 py-1 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>{formatTime(timeLeftSeconds)}</span>
                </div>
              </div>

              <div className="text-center py-2 border-y border-white/10 space-y-1">
                <span className="text-[11px] text-white/80 uppercase tracking-widest font-semibold block">
                  Namba ya Uthibitisho kwa Konda
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-amber-300">
                  {activeHold.holdCode}
                </span>
                <p className="text-xs text-white/90">
                  Mpe Konda namba hii unapopanda kwenye mlango!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-white/70 block">Abiria</span>
                  <span className="font-bold truncate block">{activeHold.passengerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/70 block">Kituo cha Kupandia</span>
                  <span className="font-bold truncate block">{activeHold.boardingStop}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/70 block">Gari & Ruti</span>
                  <span className="font-bold truncate block">{activeHold.plateNumber} ({vehicle.routeCode})</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/70 block">Nauli ya Kulipa</span>
                  <span className="font-bold text-amber-300 font-mono">TSh {activeHold.fareTzs.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
              <p className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Kondakta & Dereva Wamepokea Arifa</span>
              </p>
              <p className="text-[11px]">
                Kondakta anajua kuwa unakuja kituoni mwa <strong>{activeHold.boardingStop}</strong>. Gari likifika, onyesha namba ya <strong>{activeHold.holdCode}</strong> ili upate kiti chako bila usumbufu.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelHold}
                className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                Sitisha Ushikiliaji
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
              >
                Sawa, Nipo Njiani Kituoni
              </button>
            </div>
          </div>
        ) : (
          /* FORM TO HOLD SEAT */
          <form onSubmit={handleCreateHold} className="space-y-3.5">
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Dakika 5 za Ushikiliaji wa Bure:</span>
              </p>
              <p className="text-[11px] opacity-90">
                Ukiwa unakaribia kituo cha basi, weka ombi hili ili konda akuwekee nafasi ya kiti kabla hakijachukuliwa na mtu mwingine!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Jina Lako Kamili:
                </label>
                <input
                  type="text"
                  required
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Mf. Amina Juma"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Namba ya Simu:
                </label>
                <input
                  type="tel"
                  required
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Kituo Unachopandia:
                </label>
                <select
                  value={boardingStop}
                  onChange={(e) => setBoardingStop(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
                >
                  {route?.stops.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  )) || (
                    <option value={vehicle.nextStopName}>{vehicle.nextStopName}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Kituo cha Kushukia:
                </label>
                <select
                  value={alightStop}
                  onChange={(e) => setAlightStop(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
                >
                  {route?.stops.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  )) || (
                    <option value={vehicle.routeName}>{vehicle.routeName}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Passenger Category */}
            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                Aina ya Abiria:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPassengerType('adult')}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    passengerType === 'adult'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <span>Mtu Mzima (TSh {route?.baseFareTzs || 600})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPassengerType('student')}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    passengerType === 'student'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <span>Mwanafunzi (TSh 200)</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 transition"
              >
                Ghairi
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-neutral-950 font-black text-xs shadow-md transition active:scale-95"
              >
                Shikilia Kiti Changu (Dk 5)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
