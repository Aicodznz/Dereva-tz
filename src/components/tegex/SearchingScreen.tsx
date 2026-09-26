import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, ArrowRight, Zap, MapPin, Compass, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useTheme } from '../../ThemeContext';
import { useLanguage } from '../../LanguageContext';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface SearchingScreenProps {
  ride: Ride | null;
  onCancel: () => void;
  onTimeout: () => void;
  isMinimized?: boolean;
  isSpectator?: boolean;
  fallbackPickup?: string;
  fallbackDestination?: string;
  fallbackFare?: number;
  fallbackVehicleType?: string;
  fallbackShareMode?: 'solo' | 'share';
  nearbyDrivers?: any[];
}

export const SearchingScreen: React.FC<SearchingScreenProps> = ({
  ride,
  onCancel,
  onTimeout,
  isMinimized = false,
  isSpectator = false,
  fallbackPickup,
  fallbackDestination,
  fallbackFare,
  fallbackVehicleType,
  fallbackShareMode = 'solo',
  nearbyDrivers = [],
}) => {
  const [dots, setDots] = useState('');
  const [statusIndex, setStatusIndex] = useState(0);
  const [poolCountdown, setPoolCountdown] = useState(90);
  const [isSwitchingToSolo, setIsSwitchingToSolo] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMinimized);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const { t, language } = useLanguage();

  const isShareMode = (ride?.shareMode || fallbackShareMode) === 'share';
  const vehicleType = ride?.vehicleType || fallbackVehicleType || 'mini';
  const fare = ride?.fare || fallbackFare || 3000;
  const pickupAddress = ride?.pickup?.address || fallbackPickup || "Mahali Ulipo (GPS)";
  const destinationAddress = ride?.destination?.address || fallbackDestination || "Eneo la Safari";

  const vehicleName = 
    vehicleType === 'mini' ? 'Gari (Taxi)' :
    vehicleType === 'bajaj' ? 'Bajaji (Tuk-Tuk)' :
    vehicleType === 'boda' || vehicleType === 'bike' ? 'Pikipiki (Boda)' : 'Gari';

  const vehicleEmoji = 
    vehicleType === 'mini' ? '🚗' :
    vehicleType === 'bajaj' ? '🛺' : '🏍️';

  const statuses = isShareMode
    ? [
        "Inatafuta abiria anayeelekea njia moja nawe (PapoShare)...",
        "Inapima 'Detour Budget' ili usichelewe njiani...",
        "Inaunganisha na dereva wa Bajaji/Gari aliyepo kwenye njia yako...",
        "Karibu! Pata punguzo na gawaneni gharama ya safari..."
      ]
    : language === 'en'
    ? [
        `Searching for ${vehicleName} drivers nearby...`,
        "Analyzing nearby available drivers on the map...",
        "Dispatching request to nearest verified driver...",
        "Please hold on, waiting for driver confirmation..."
      ]
    : language === 'ar'
    ? [
        `جاري البحث عن سائقي ${vehicleName} بالقرب منك...`,
        "جاري تحليل السائقين القريبين المتاحين...",
        "جاري إرسال الطلب إلى أقرب سائق معتمد...",
        "يرجى الانتظار، السائق يؤكد طلبك..."
      ]
    : [
        `Inatafuta madereva wa ${vehicleName} walio karibu nawe...`,
        "Inachambua madereva waliopo mtaani kwenye ramani...",
        "Tunatuma ombi lako kwa dereva aliye karibu zaidi...",
        "Tafadhali subiri kidogo, dereva anathibitisha safari yako..."
      ];

  // PapoShare countdown timer
  useEffect(() => {
    if (!isShareMode) return;
    const timer = setInterval(() => {
      setPoolCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFallbackToSolo();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isShareMode, ride?.id]);

  const handleFallbackToSolo = async () => {
    if (!ride?.id || isSwitchingToSolo) return;
    try {
      setIsSwitchingToSolo(true);
      const fallbackFareVal = ride.originalSoloFare || Math.round(fare * 1.4);
      await updateDoc(doc(db, 'rides', ride.id), {
        shareMode: 'solo',
        poolStatus: 'solo_fallback',
        fare: fallbackFareVal,
        allowSharingConsent: false,
        updatedAt: serverTimestamp(),
      });
      toast.info("Tunaendelea na Safari Binafsi (Solo) bila kuchelewa!");
    } catch (e) {
      console.error("Fallback to solo error:", e);
    } finally {
      setIsSwitchingToSolo(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 2800);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onTimeout();
    }, 5 * 60 * 1000); // 5 minutes timeout
    return () => clearTimeout(timeout);
  }, [onTimeout]);

  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-[75] p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Floating Sleek Badge - Non-intrusive, leaves map 100% full & visible */}
      <div className="w-full flex justify-center pt-2 sm:pt-4">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.18)] border backdrop-blur-xl transition-all ${
            theme === 'dark'
              ? 'bg-[#111118]/90 border-neutral-800 text-white'
              : 'bg-white/95 border-neutral-200 text-neutral-900'
          }`}
        >
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
          </div>
          <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
            <span>PapoRide: Inatafuta Madereva</span>
            <span className="text-indigo-500 font-mono">{dots}</span>
          </span>
          {isShareMode && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
              PapoShare ({poolCountdown}s)
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`pointer-events-auto ml-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 border cursor-pointer ${
              isCollapsed
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                : (theme === 'dark' ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white' : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:text-neutral-900')
            }`}
            title={isCollapsed ? "Onyesha Maelezo ya Safari" : "Onyesha Ramani Yote (Full Map)"}
          >
            <Compass className="w-3 h-3 text-emerald-400" />
            <span>{isCollapsed ? "Maelezo" : "Ramani Kamili"}</span>
          </button>
        </motion.div>
      </div>

      {/* Bottom Main Driver Searching Sheet */}
      <div className="w-full flex justify-center pb-2 sm:pb-3">
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className={`pointer-events-auto w-full max-w-[420px] rounded-[28px] border shadow-[0_16px_48px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition-all overflow-hidden ${
            theme === 'dark'
              ? 'bg-[#0f0f17]/95 border-neutral-800 text-neutral-100 shadow-black/60'
              : 'bg-white/95 border-neutral-200 text-neutral-800 shadow-neutral-900/15'
          }`}
        >
          {/* Top Grab Bar / Toggle Header */}
          <div 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full pt-2.5 pb-1 flex flex-col items-center cursor-pointer group select-none"
          >
            <div className={`w-10 h-1 rounded-full transition-all ${
              theme === 'dark' ? 'bg-neutral-700 group-hover:bg-neutral-600' : 'bg-neutral-300 group-hover:bg-neutral-400'
            }`} />
          </div>

          <div className="p-4 sm:p-5 pt-2 space-y-3.5">
            {/* Header: Finding your driver / Asking drivers near you */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  {isShareMode ? 'Kutafuta Safari ya PapoShare' : 'Inatafuta Dereva Wako...'}
                </h3>
                <p className={`text-xs font-bold mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Inatuma maombi kwa madereva wa <span className="font-extrabold text-indigo-500">{vehicleName}</span> walio karibu nawe
                </p>
              </div>

              {/* Collapse / Expand Toggle Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 transition-all ${
                  theme === 'dark' 
                    ? 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-700' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200'
                }`}
                title={isCollapsed ? "Fungua maelezo kamili" : "Punguza kadi"}
              >
                {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Middle Vehicle & Fare Card (Matching reference Screenshot_20260926-080021.jpg) */}
            <div className={`flex items-center justify-between p-3 rounded-2xl border ${
              theme === 'dark' ? 'bg-[#151520] border-neutral-800' : 'bg-neutral-50/90 border-neutral-200/80'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-2xl border border-indigo-500/20 shrink-0">
                  {vehicleEmoji}
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight leading-tight">
                    {vehicleName}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-bold flex items-center gap-1 mt-0.5">
                    <span>💵 Pesa Taslimu (Cash)</span>
                    <span>•</span>
                    <span className="text-emerald-500 font-extrabold">Imethibitishwa</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block leading-none">
                  Gharama Yako
                </span>
                <p className="text-sm sm:text-base font-black text-indigo-500 dark:text-indigo-400 font-mono leading-tight mt-0.5">
                  TZS {fare.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Overlapping Driver Profile Avatars Row (Matching Screenshot_20260926-080021.jpg) */}
            {(() => {
              const displayList = nearbyDrivers && nearbyDrivers.length > 0
                ? nearbyDrivers.slice(0, 3)
                : [
                    { id: 'd1', name: 'Juma Bakari', photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80' },
                    { id: 'd2', name: 'Emmanuel Mwita', photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80' },
                    { id: 'd3', name: 'Baraka Said', photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80' }
                  ];
              const count = nearbyDrivers?.length || 3;
              return (
                <div className={`flex items-center gap-3 py-2 px-3 rounded-2xl border ${
                  theme === 'dark' ? 'bg-[#12121a]/80 border-neutral-800/80' : 'bg-neutral-100/70 border-neutral-200/60'
                }`}>
                  <div className="flex -space-x-2.5 overflow-hidden shrink-0">
                    {displayList.map((drv: any, idx: number) => (
                      <img
                        key={drv.id || idx}
                        src={drv.photoURL || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80`}
                        alt={drv.name || 'Dereva'}
                        className="inline-block w-8 h-8 rounded-full ring-2 ring-white dark:ring-neutral-900 object-cover shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                  <p className="text-[11.5px] font-bold leading-snug">
                    <span className="font-black text-indigo-500 dark:text-indigo-400">
                      Madereva {count}
                    </span> wapo karibu kwenye rada, wanasubiri kujibu ombi
                  </p>
                </div>
              );
            })()}

            {/* Expandable Route Details */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2.5 overflow-hidden"
                >
                  <div className={`p-2.5 sm:p-3 rounded-2xl border space-y-2 ${
                    theme === 'dark' ? 'bg-[#151520] border-neutral-800' : 'bg-neutral-50/90 border-neutral-200/80'
                  }`}>
                    {/* Pickup */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block leading-none">
                          Kuanzia (Pickup)
                        </span>
                        <p className="text-[11px] font-bold truncate leading-tight mt-0.5">
                          {pickupAddress}
                        </p>
                      </div>
                    </div>

                    <div className="ml-1 w-0.5 h-1.5 bg-neutral-300 dark:bg-neutral-700" />

                    {/* Destination */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block leading-none">
                          Kuelekea (Destination)
                        </span>
                        <p className="text-[11px] font-bold truncate leading-tight mt-0.5">
                          {destinationAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PapoShare Switch to Solo Button if available */}
                  {isShareMode && !isSpectator && (
                    <button
                      type="button"
                      onClick={handleFallbackToSolo}
                      disabled={isSwitchingToSolo}
                      className="w-full h-9 bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-amber-500" />
                      <span>Endelea na Solo Sasa (Bila Kusubiri)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cancel Trip Button */}
            {!isSpectator && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full h-10 bg-red-500/10 hover:bg-red-500/20 active:scale-98 text-red-500 dark:text-red-400 border border-red-500/30 rounded-2xl font-black uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
                <span>Ghairi Safari (Cancel Search)</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
