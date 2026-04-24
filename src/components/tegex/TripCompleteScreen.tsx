import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Wallet, CreditCard, QrCode } from 'lucide-react';
import { Ride } from '../../types/trip.types';

interface TripCompleteScreenProps {
  ride: Ride;
  onPay: (method: string) => void;
}

export const TripCompleteScreen: React.FC<TripCompleteScreenProps> = ({ ride, onPay }) => {
  const [method, setMethod] = useState('mongike');

  // Pure CSS Confetti
  const confetti = Array.from({ length: 20 }).map((_, i) => (
    <motion.div
      key={i}
      initial={{ y: -20, opacity: 1, scale: 0 }}
      animate={{ 
        y: 400, 
        opacity: 0, 
        scale: Math.random() * 0.5 + 0.5,
        x: (Math.random() - 0.5) * 400
      }}
      transition={{ 
        duration: 2 + Math.random(), 
        repeat: Infinity,
        delay: Math.random() * 2
      }}
      className={`absolute w-2 h-2 rounded-full z-0`}
      style={{ 
        backgroundColor: ['#1D9E75', '#7F77DD', '#D85A30', '#f0eeff'][Math.floor(Math.random() * 4)],
        left: `${Math.random() * 100}%`,
        top: '-10px'
      }}
    />
  ));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-[#0a0a0f] flex flex-col items-center justify-center p-6 overflow-hidden"
    >
      {confetti}

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           transition={{ type: "spring", stiffness: 200, damping: 15 }}
           className="w-20 h-20 bg-[#1D9E75] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(29,158,117,0.5)] mb-8"
        >
           <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeInOut" }}
                d="M20 6L9 17l-5-5" 
              />
           </svg>
        </motion.div>

        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-[#f0eeff] text-center leading-none mb-2">
          Umefika!<br />Safari Imekamilika
        </h2>
        <p className="text-[#6b6b8a] text-sm font-bold mb-12">Shukrani kwa kutumia TegeX</p>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="space-y-6">
            <div className="flex justify-between items-center text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest">
              <span>Mchanganuo wa Malipo</span>
              <span>Trip Summary</span>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center text-sm font-bold text-[#6b6b8a]">
                  <span>Msingi</span>
                  <span className="text-[#f0eeff]">TZS 1,200</span>
               </div>
               <div className="flex justify-between items-center text-sm font-bold text-[#6b6b8a]">
                  <span>Umbali (4.2 km)</span>
                  <span className="text-[#f0eeff]">TZS {(ride.fare - 1200).toLocaleString()}</span>
               </div>
               <div className="h-px bg-[#1e1e2e]" />
               <div className="flex justify-between items-end">
                  <div className="text-left">
                     <p className="text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest leading-none mb-1">Jumla</p>
                     <h3 className="text-3xl font-black italic text-[#7F77DD]">TZS {ride.fare.toLocaleString()}</h3>
                  </div>
                  <div className="px-3 py-1 bg-[#1D9E75]/10 border border-[#1D9E75]/30 rounded-full text-[8px] font-black text-[#1D9E75] uppercase">
                     Bado Hujalipa
                  </div>
               </div>
            </div>

            <div className="space-y-3">
               <p className="text-[9px] font-black text-[#6b6b8a] uppercase tracking-widest text-center">Chagua Njia ya Malipo</p>
               <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setMethod('mongike')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'mongike' ? 'bg-[#7F77DD]/20 border-[#7F77DD] text-[#7F77DD]' : 'bg-[#0a0a0f] border-[#1e1e2e] text-[#6b6b8a]'}`}>
                     <Wallet className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">Mongike</span>
                  </button>
                  <button onClick={() => setMethod('namba')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'namba' ? 'bg-[#7F77DD]/20 border-[#7F77DD] text-[#7F77DD]' : 'bg-[#0a0a0f] border-[#1e1e2e] text-[#6b6b8a]'}`}>
                     <CreditCard className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">LipaNamba</span>
                  </button>
                  <button onClick={() => setMethod('qr')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'qr' ? 'bg-[#7F77DD]/20 border-[#7F77DD] text-[#7F77DD]' : 'bg-[#0a0a0f] border-[#1e1e2e] text-[#6b6b8a]'}`}>
                     <QrCode className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">QR Code</span>
                  </button>
               </div>
            </div>

            <button 
              onClick={() => onPay(method)}
              className="w-full h-14 bg-[#1D9E75] text-white rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-[#1D9E75]/20 active:scale-95 transition-all mt-4"
            >
              Lipa Sasa
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
