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
      className="flex-1 w-full bg-transparent flex flex-col items-center justify-center p-8 overflow-hidden z-[110]"
    >
      <div className="w-24 h-24 bg-[#1D9E75]/20 rounded-full flex items-center justify-center border-4 border-[#1D9E75] relative shadow-[0_0_50px_rgba(29,158,117,0.3)]">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 bg-[#1D9E75]/10 rounded-full"
        />
        <CheckCircle2 className="w-12 h-12 text-[#1D9E75]" />
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center"
      >
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#1D9E75]">
          Dereva Amepatikana! 🎉
        </h2>
        <p className="mt-4 text-[#6b6b8a] font-bold max-w-[280px] mx-auto">
          Dereva wako yuko njiani kuja kukuchukua sasa hivi.
        </p>
      </motion.div>
    </div>
  );
};
