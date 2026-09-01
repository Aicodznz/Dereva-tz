import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { useLanguage } from '../../LanguageContext';

interface DriverFoundScreenProps {
  onNext: () => void;
  isMinimized?: boolean;
}

export const DriverFoundScreen: React.FC<DriverFoundScreenProps> = ({ onNext, isMinimized }) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const { t, language } = useLanguage();
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    // Dismiss quickly after 1.4 seconds so it doesn't block the screen
    const timer = setTimeout(() => {
      onNextRef.current?.();
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    onNextRef.current?.();
  };

  return (
    <div 
      onClick={handleDismiss}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] cursor-pointer pointer-events-auto z-[110]"
    >
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className={`w-full max-w-sm border rounded-[36px] p-6 sm:p-8 shadow-2xl flex flex-col items-center pointer-events-auto relative overflow-hidden ${
              theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            {/* Quick auto-dismiss timer bar */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 1.4, ease: "linear" }}
              className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"
            />

            <div className="relative mt-2">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[#1D9E75] rounded-full blur-xl"
              />
              <div className={`w-20 h-20 bg-[#1D9E75] rounded-full flex items-center justify-center border-4 shadow-lg relative z-10 ${
                theme === 'dark' ? 'border-[#111118]' : 'border-white'
              }`}>
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-6 text-center w-full"
            >
              <h2 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'
              }`}>
                {t('driver_found')}
              </h2>
              
              <div className="mt-2.5 flex justify-center">
                <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border ${
                  theme === 'dark' ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-500/20'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                  }`}>
                    {language === 'en' ? '🎉 ON THE WAY' : language === 'ar' ? '🎉 في الطريق' : '🎉 YUKO NJIANI'}
                  </p>
                </div>
              </div>

              <p className={`mt-3 font-medium text-xs leading-relaxed px-2 ${
                theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
              }`}>
                {language === 'en' 
                  ? 'Your driver has accepted your request and is coming to pick you up now.' 
                  : language === 'ar' 
                  ? 'لقد قبل سائقك طلبك وهو في طريقه لاصطحابك الآن.' 
                  : 'Dereva wako amekubali ombi lako na anakuja kukuchukua sasa hivi.'}
              </p>

              {/* Instant dismiss button */}
              <button
                onClick={handleDismiss}
                className="mt-5 w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <span>Tazama Ramani & Dereva</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

