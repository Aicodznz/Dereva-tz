import React, { useState, useMemo } from 'react';
import { DaladalaRoute, DaladalaStop } from '../../types/daladala.types';
import { 
  Calculator, 
  X, 
  MapPin, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  GraduationCap, 
  User, 
  HeartHandshake, 
  PhoneCall, 
  Copy, 
  Share2, 
  Check,
  Compass
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaLatraFareCalculatorModalProps {
  routes: DaladalaRoute[];
  initialOriginStop?: string;
  initialDestinationStop?: string;
  initialRouteId?: string;
  onClose: () => void;
  onSelectRoute?: (routeId: string) => void;
}

export default function DaladalaLatraFareCalculatorModal({
  routes,
  initialOriginStop = '',
  initialDestinationStop = '',
  initialRouteId = '',
  onClose,
  onSelectRoute,
}: DaladalaLatraFareCalculatorModalProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>(initialRouteId || routes[0]?.id || '');
  const [boardingStopName, setBoardingStopName] = useState<string>(initialOriginStop);
  const [alightStopName, setAlightStopName] = useState<string>(initialDestinationStop);
  const [passengerType, setPassengerType] = useState<'adult' | 'student' | 'special'>('adult');
  const [copied, setCopied] = useState(false);

  // Active route
  const currentRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0];
  }, [routes, selectedRouteId]);

  // Set initial stops if not set
  React.useEffect(() => {
    if (currentRoute && currentRoute.stops.length >= 2) {
      if (!boardingStopName) {
        setBoardingStopName(currentRoute.stops[0].name);
      }
      if (!alightStopName) {
        setAlightStopName(currentRoute.stops[currentRoute.stops.length - 1].name);
      }
    }
  }, [currentRoute]);

  // Calculate approximate distance between selected stops
  const calculation = useMemo(() => {
    if (!currentRoute || !currentRoute.stops.length) {
      return { distanceKm: 5, fareTzs: 500, estimatedMinutes: 15, stopsCount: 4 };
    }

    const stops = currentRoute.stops;
    const bIndex = stops.findIndex((s) => s.name.toLowerCase() === boardingStopName.toLowerCase());
    const aIndex = stops.findIndex((s) => s.name.toLowerCase() === alightStopName.toLowerCase());

    const startIndex = bIndex >= 0 ? bIndex : 0;
    const endIndex = aIndex >= 0 ? aIndex : Math.max(0, stops.length - 1);
    const stopDiff = Math.abs(endIndex - startIndex);

    // Approximate distance
    const totalRouteKm = currentRoute.distanceKm || 15;
    const fraction = stops.length > 1 ? stopDiff / (stops.length - 1) : 0.5;
    const calculatedKm = Math.max(1.5, Math.round(fraction * totalRouteKm * 10) / 10);

    // LATRA Official Guidelines (GN No. 416):
    // 0 - 10 km: TSh 500
    // 11 - 15 km: TSh 600
    // 16 - 25 km: TSh 700 - 800
    // 25+ km: TSh 1,000
    // Wanafunzi: TSh 200 ya kudumu
    let officialFare = 500;
    if (passengerType === 'student') {
      officialFare = 200;
    } else if (passengerType === 'special') {
      // Discretionary / LATRA special assistance guidelines
      officialFare = calculatedKm > 15 ? 500 : 400;
    } else {
      if (calculatedKm <= 10) {
        officialFare = 500;
      } else if (calculatedKm <= 15) {
        officialFare = 600;
      } else if (calculatedKm <= 22) {
        officialFare = 700;
      } else if (calculatedKm <= 30) {
        officialFare = 850;
      } else {
        officialFare = 1000;
      }
    }

    const estimatedMins = Math.round(calculatedKm * 2.2 + stopDiff * 1.5);

    return {
      distanceKm: calculatedKm,
      fareTzs: officialFare,
      estimatedMinutes: Math.max(8, estimatedMins),
      stopsCount: stopDiff + 1,
    };
  }, [currentRoute, boardingStopName, alightStopName, passengerType]);

  const handleCopy = () => {
    const text = `Nauli Halali ya LATRA (${currentRoute.name}):\n` +
      `Kupandia: ${boardingStopName}\n` +
      `Kushukia: ${alightStopName}\n` +
      `Umbali: ~${calculation.distanceKm} km\n` +
      `Aina: ${passengerType === 'adult' ? 'Mtu Mzima' : passengerType === 'student' ? 'Mwanafunzi (Uniform)' : 'Wenye Mahitaji'}\n` +
      `Nauli Rasmi: TSh ${calculation.fareTzs.toLocaleString()} (LATRA Approved)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Taarifa ya nauli imenakiliwa!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[600] bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-neutral-900 dark:text-white">
                  Kikokotoo Rasmi cha Nauli cha LATRA
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] uppercase">
                  LATRA GN 416
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Kiwango halali cha nauli za daladala mkoa wa Dar es Salaam
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

        {/* Route Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
            <span>Chagua Ruti ya Daladala:</span>
            <span className="text-[11px] text-neutral-400">{routes.length} Ruti Zinapatikana</span>
          </label>
          <select
            value={selectedRouteId}
            onChange={(e) => {
              setSelectedRouteId(e.target.value);
              const r = routes.find((x) => x.id === e.target.value);
              if (r && r.stops.length > 0) {
                setBoardingStopName(r.stops[0].name);
                setAlightStopName(r.stops[r.stops.length - 1].name);
              }
            }}
            className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                [{r.routeCode}] {r.name} ({r.via})
              </option>
            ))}
          </select>
        </div>

        {/* Boarding and Alighting Stop Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800">
          <div>
            <label className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>1. Kituo cha Kupandia</span>
            </label>
            <select
              value={boardingStopName}
              onChange={(e) => setBoardingStopName(e.target.value)}
              className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
            >
              {currentRoute.stops.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.isTerminal ? '(Stendi)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Kituo cha Kushukia</span>
            </label>
            <select
              value={alightStopName}
              onChange={(e) => setAlightStopName(e.target.value)}
              className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
            >
              {currentRoute.stops.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} {s.isTerminal ? '(Stendi)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Passenger Category Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
            Aina ya Abiria:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPassengerType('adult')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                passengerType === 'adult'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-black shadow-xs ring-1 ring-blue-600'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-xs">Mtu Mzima</span>
              <span className="text-[10px] opacity-75">TSh 500 - 800</span>
            </button>

            <button
              type="button"
              onClick={() => setPassengerType('student')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                passengerType === 'student'
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-black shadow-xs ring-1 ring-emerald-600'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="text-xs">Mwanafunzi</span>
              <span className="text-[10px] opacity-75">TSh 200 Flat</span>
            </button>

            <button
              type="button"
              onClick={() => setPassengerType('special')}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                passengerType === 'special'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-black shadow-xs ring-1 ring-purple-600'
                  : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span className="text-xs">Mzee / Mahitaji</span>
              <span className="text-[10px] opacity-75">Mwongozo</span>
            </button>
          </div>
        </div>

        {/* Calculation Result Hero Card */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10 pointer-events-none">
            <Calculator className="w-36 h-36" />
          </div>

          <div className="flex items-center justify-between text-xs opacity-80 border-b border-white/10 pb-2">
            <span>Safari Yako: {boardingStopName} ➔ {alightStopName}</span>
            <span className="font-mono">Vituo ~{calculation.stopsCount}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block">
                Nauli Rasmi Kisheria (LATRA Approved)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                  TSh {calculation.fareTzs.toLocaleString()}
                </span>
                <span className="text-xs text-white/70">
                  {passengerType === 'student' ? '(Nauli ya Mwanafunzi)' : '(Kila abiria mmoja)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-center">
                <span className="text-[10px] text-white/70 block">Umbali</span>
                <span className="text-xs font-black">{calculation.distanceKm} km</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-center">
                <span className="text-[10px] text-white/70 block">Muda wa Safari</span>
                <span className="text-xs font-black font-mono">~{calculation.estimatedMinutes} dk</span>
              </div>
            </div>
          </div>

          {/* LATRA Legal Warning */}
          <div className="bg-white/10 rounded-xl p-2.5 flex items-start gap-2 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/90 leading-relaxed">
              <strong>Onyo la Sheria:</strong> Kondakta au Dereva haruhusiwi kutoza zaidi ya <strong>TSh {calculation.fareTzs.toLocaleString()}</strong> kwa safari hii. Ukitozwa ziada, toa taarifa LATRA bure.
            </p>
          </div>
        </div>

        {/* Action Buttons: Copy, Share, Report Toll-Free */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Imenakiliwa!' : 'Nakili Nauli'}</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Nauli ya LATRA: ${boardingStopName} hadi ${alightStopName} ni TSh ${calculation.fareTzs.toLocaleString()} (Umbali ~${calculation.distanceKm} km). Usikubali kutozwa zaidi!`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Tuma WhatsApp</span>
            </a>
          </div>

          <a
            href="tel:0800110020"
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            title="Piga LATRA bure kuripoti kondakta anayedai nauli kubwa"
          >
            <PhoneCall className="w-3.5 h-3.5 text-red-500" />
            <span>Ripoti LATRA: 0800 110 020 (Bure)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
