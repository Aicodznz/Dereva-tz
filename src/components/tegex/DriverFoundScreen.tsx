import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

interface DriverFoundScreenProps {
  onNext: () => void;
}

export const DriverFoundScreen: React.FC<DriverFoundScreenProps> = ({ onNext }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onNext();
    }, 2500); // Show for 2.5 seconds (1.5s as requested + transition)
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div 
      className="flex-1 w-full flex flex-col items-center justify-center p-8 overflow-hidden z-[110]"
    >
      {/* Dynamic Background */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-0 bg-gradient-to-t from-[#1D9E75]/40 via-[#1D9E75]/10 to-transparent pointer-events-none"
      />

      <div className="relative">
        <motion.div
          animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-[#1D9E75] rounded-full blur-3xl opacity-20"
        />
        <div className="w-28 h-28 bg-[#1D9E75] rounded-full flex items-center justify-center border-8 border-white shadow-2xl relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12 }}
          >
            <CheckCircle2 className="w-14 h-14 text-white" />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-10 text-center relative z-10"
      >
        <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] tracking-tight">
          Tumepata Dereva!
        </h2>
        <motion.div 
          animate={{ x: [-2, 2, -2] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="mt-2 inline-block px-4 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30"
        >
          <p className="text-white text-xs font-black uppercase tracking-widest">🎉 YUKO NJIANI</p>
        </motion.div>
        <p className="mt-6 text-white/80 font-bold max-w-[280px] mx-auto text-sm leading-relaxed drop-shadow-sm">
          Dereva wako amekubali ombi lako na anakuja kukuchukua sasa hivi.
        </p>
      </motion.div>
    </div>
  );
};
