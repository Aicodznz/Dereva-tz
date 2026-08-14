import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Sparkles, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
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
}

export const SearchingScreen: React.FC<SearchingScreenProps> = ({ ride, onCancel, onTimeout, isMinimized, isSpectator }) => {
  const [dots, setDots] = useState('');
  const [statusIndex, setStatusIndex] = useState(0);
  const [poolCountdown, setPoolCountdown] = useState(90);
  const [isSwitchingToSolo, setIsSwitchingToSolo] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const { t, language } = useLanguage();

  const isShareMode = ride?.shareMode === 'share';

  const statuses = isShareMode
    ? [
        "Inatafuta abiria anayeelekea njia moja nawe (PapoShare)...",
        "Inapima 'Detour Budget' ili usichelewe njiani...",
        "Inaunganisha na dereva wa Bajaji/Gari aliyepo kwenye njia yako...",
        "Karibu! Pata punguzo na gawaneni gharama ya safari..."
      ]
    : language === 'en' ? [
    `Searching for ${ride?.vehicleType === 'mini' ? 'Car' : ride?.vehicleType === 'bajaj' ? 'Bajaj' : 'Motorcycle'} drivers nearby...`,
    "Analyzing nearby available drivers...",
    "Sending request to driver...",
    "Please wait, finding the best driver for you..."
  ] : language === 'ar' ? [
    `جاري البحث عن سائقي ${ride?.vehicleType === 'mini' ? 'سيارة' : ride?.vehicleType === 'bajaj' ? 'باجاج' : 'دراجة نارية'} بالقرب منك...`,
    "جاري تحليل السائقين القريبين المتاحين...",
    "جاري إرسال الطلب إلى السائق...",
    "يرجى الانتظار، جاري البحث عن أفضل سائق لك..."
  ] : [
    `Inatafuta madereva wa ${ride?.vehicleType === 'mini' ? 'Gari' : ride?.vehicleType === 'bajaj' ? 'Bajaji' : 'Pikipiki'} Karibu Nawe...`,
    "Inachambua madereva walio karibu nawe...",
    "Tunatuma ombi lako kwa dereva mwenye usafiri husika...",
    "Tafadhali subiri kidogo, tunakutafutia dereva bora..."
  ];

  // 90-second PapoShare match countdown
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
      const fallbackFare = ride.originalSoloFare || Math.round(ride.fare * 1.4);
      await updateDoc(doc(db, 'rides', ride.id), {
        shareMode: 'solo',
        poolStatus: 'solo_fallback',
        fare: fallbackFare,
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
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % statuses.length);
    }, 3000);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onTimeout();
    }, 5 * 60 * 1000); // 5 minutes timeout
    return () => clearTimeout(timeout);
  }, [onTimeout]);

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center bg-transparent pointer-events-none z-[100]"
    >
      <div className="flex-1 w-full flex flex-col items-center justify-between p-4 pt-20 pb-20 overflow-y-auto no-scrollbar pointer-events-none">
        {/* Top Ride Details Card - Clean, compact, modern */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`w-full max-w-[340px] border rounded-[24px] p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-20 shrink-0 pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/90 border-neutral-800/80' : 'bg-white/90 border-neutral-200/80'} backdrop-blur-md`}
            >
              <div className="flex flex-col gap-2.5">
                {/* PapoShare Mode Badge */}
                {isShareMode && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                      <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        PapoShare (Gawana Njia)
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Okoa TZS {ride?.sharedSavings?.toLocaleString() || '1,500+'}
                    </span>
                  </div>
                )}

                {/* Compact Address Row */}
                <div className="flex gap-2.5 relative">
                  {/* Timeline connectors */}
                  <div className="flex flex-col items-center py-1 shrink-0 select-none">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                    <div className="w-[1.5px] bg-neutral-200 dark:bg-neutral-850 h-5 my-0.5 border-dashed border-l border-neutral-300 dark:border-neutral-700" />
                    <div className="w-2 h-2 rounded-full bg-red-500 ring-4 ring-red-500/10" />
                  </div>
                  
                  {/* Text Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Pickup Address */}
                    <div className="min-w-0">
                      <p className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none mb-0.5">{t('from_label')}</p>
                      <p className={`text-[11.5px] font-bold truncate leading-tight ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{ride?.pickup?.address || "..."}</p>
                    </div>
                    {/* Destination Address */}
                    <div className="min-w-0">
                      <p className="text-[7.5px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider leading-none mb-0.5">{t('to_label')}</p>
                      <p className={`text-[11.5px] font-bold truncate leading-tight ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{ride?.destination?.address || "..."}</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className={`border-t ${theme === 'dark' ? 'border-neutral-850' : 'border-neutral-100'}`} />

                {/* Ride details & Cost horizontally */}
                <div className="flex items-center justify-between text-xs">
                  {/* Vehicle Type */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">
                      {ride?.vehicleType === 'mini' ? '🚗' : ride?.vehicleType === 'bajaj' ? '🛺' : '🏍️'}
                    </span>
                    <div>
                      <p className={`text-[11px] font-black uppercase ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}`}>{ride?.vehicleType || 'Gari'}</p>
                      <p className="text-[8px] font-semibold text-neutral-400 uppercase tracking-wide">
                        {isShareMode ? 'PapoShare Pooling' : 'Papo Hapo Solo'}
                      </p>
                    </div>
                  </div>

                  {/* Cost Details */}
                  <div className="text-right">
                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-0.5">{t('fare').toUpperCase()}</p>
                    <p className="text-xs font-black text-indigo-500 leading-none">TZS {ride?.fare?.toLocaleString()}</p>
                    {isShareMode && (
                      <p className="text-[8px] line-through text-neutral-400 font-bold mt-0.5">
                        TZS {ride?.originalSoloFare?.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Status & Cancel / Fallback to Solo - Cohesive, sleek and compact */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-[340px] shrink-0 pointer-events-auto"
            >
              <div className={`border rounded-[24px] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${theme === 'dark' ? 'bg-[#111118]/90 border-neutral-800/80 text-neutral-200' : 'bg-white/90 border-neutral-200/80 text-neutral-800'} backdrop-blur-md`}>
                
                {/* Header status row with small pulsing glowing circle */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </div>
                    <h2 className="text-[11px] font-black text-indigo-500 tracking-wider uppercase leading-none">
                      {isShareMode ? `Kutafuta Abiria wa Njia Moja (${poolCountdown}s)` : `${t('searching_driver')}${dots}`}
                    </h2>
                  </div>

                  {isShareMode && (
                    <span className="text-[8.5px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Detour: ≤{ride?.maxDetourBudgetMinutes || 3} min
                    </span>
                  )}
                </div>

                {/* Sub status animation description */}
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={statusIndex}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    className={`text-[9.5px] font-semibold uppercase tracking-wide italic min-h-[14px] leading-tight ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}
                  >
                    {ride ? statuses[statusIndex] : "..."}
                  </motion.p>
                </AnimatePresence>

                {/* PapoShare Fallback Option: Switch to Solo Immediately */}
                {isShareMode && !isSpectator && (
                  <button
                    type="button"
                    onClick={handleFallbackToSolo}
                    disabled={isSwitchingToSolo}
                    className="w-full mt-2.5 h-9 bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-500" />
                    <span>Endelea na Solo Sasa (Bila Kusubiri)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {/* Cancel Button - Compact & beautiful red style */}
                {!isSpectator && (
                  <button 
                    onClick={onCancel}
                    className="w-full mt-2 h-9 bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-500 border border-red-500/25 rounded-xl font-black uppercase text-[9.5px] tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                    {t('cancel_ride').toUpperCase()}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
