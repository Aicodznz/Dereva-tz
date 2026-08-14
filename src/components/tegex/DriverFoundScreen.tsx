import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
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

  useEffect(() => {
    const timer = setTimeout(() => {
      onNext();
    }, 2500); // Show for 2.5 seconds (1.5s as requested + transition)
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-transparent pointer-events-none z-[110]"
    >
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`w-full max-w-sm border rounded-[40px] p-8 shadow-2xl flex flex-col items-center pointer-events-auto ${theme === 'dark' ? 'bg-[#111118]/95 border-neutral-800' : 'bg-white border-neutral-200/80'}`}
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[#1D9E75] rounded-full blur-2xl"
              />
              <div className={`w-24 h-24 bg-[#1D9E75] rounded-full flex items-center justify-center border-4 shadow-lg relative z-10 ${theme === 'dark' ? 'border-[#111118]' : 'border-white'}`}>
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-center"
            >
              <h2 className={`text-3xl font-black tracking-tight leading-tight ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'}`}>
                {t('driver_found')}
              </h2>
              <motion.div 
                animate={{ x: [-1, 1, -1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className={`mt-3 inline-block px-4 py-1.5 rounded-full border ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/60' : 'bg-emerald-50 border-emerald-500/20'}`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {language === 'en' ? '🎉 ON THE WAY' : language === 'ar' ? '🎉 في الطريق' : '🎉 YUKO NJIANI'}
                </p>
              </motion.div>
              <p className={`mt-4 font-medium text-xs leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {language === 'en' ? 'Your driver has accepted your request and is coming to pick you up now.' : language === 'ar' ? 'لقد قبل سائقك طلبك وهو في طريقه لاصطحابك الآن.' : 'Dereva wako amekubali ombi lako na anakuja kukuchukua sasa hivi.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
