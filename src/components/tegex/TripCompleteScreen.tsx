import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Wallet, CreditCard, QrCode } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useTheme } from 'next-themes';

interface TripCompleteScreenProps {
  ride: Ride;
  onPay: (method: string) => void;
}

export const TripCompleteScreen: React.FC<TripCompleteScreenProps> = ({ ride, onPay }) => {
  const [method, setMethod] = useState('mongike');
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

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
        backgroundColor: ['#059669', '#4f46e5', '#ea580c', '#cbd5e1'][Math.floor(Math.random() * 4)],
        left: `${Math.random() * 100}%`,
        top: '-10px'
      }}
    />
  ));

  return (
    <div 
      className={`h-full w-full ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col items-center justify-center p-6 overflow-hidden relative z-50`}
    >
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div
           className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/10 mb-8"
        >
           <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path 
                d="M20 6L9 17l-5-5" 
              />
           </svg>
        </div>

        <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'} text-center leading-none mb-2`}>
          Umefika!<br />Safari Imekamilika
        </h2>
        <p className="text-neutral-500 text-sm font-bold mb-12">Shukrani kwa kutumia TegeX</p>

        <div 
          className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/80'} border rounded-[40px] p-8 shadow-xl relative overflow-hidden`}
        >
          <div className="space-y-6">
            <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              <span>Mchanganuo wa Malipo</span>
              <span>Trip Summary</span>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center text-sm font-bold text-neutral-500">
                  <span>Msingi</span>
                  <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}>TZS 1,200</span>
               </div>
               <div className="flex justify-between items-center text-sm font-bold text-neutral-500">
                  <span>Umbali (4.2 km)</span>
                  <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}>TZS {(ride?.fare ? ride.fare - 1200 : 0).toLocaleString()}</span>
               </div>
               <div className={`h-px ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`} />
               <div className="flex justify-between items-end">
                  <div className="text-left">
                     <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Jumla</p>
                     <h3 className="text-3xl font-black italic text-indigo-600">TZS {(ride?.fare ?? 0).toLocaleString()}</h3>
                  </div>
                  <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[8px] font-black text-emerald-700 uppercase">
                     Bado Hujalipa
                  </div>
               </div>
            </div>

            <div className="space-y-3">
               <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest text-center">Chagua Njia ya Malipo</p>
               <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setMethod('mongike')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'mongike' ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm') : (theme === 'dark' ? 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100')}`}>
                     <Wallet className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">Mongike</span>
                  </button>
                  <button onClick={() => setMethod('namba')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'namba' ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm') : (theme === 'dark' ? 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100')}`}>
                     <CreditCard className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">LipaNamba</span>
                  </button>
                  <button onClick={() => setMethod('qr')} className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${method === 'qr' ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm') : (theme === 'dark' ? 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100')}`}>
                     <QrCode className="w-5 h-5" />
                     <span className="text-[8px] font-black uppercase">QR Code</span>
                  </button>
               </div>
            </div>

            <button 
              onClick={() => onPay(method)}
              className="w-full h-14 bg-emerald-600 text-white rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-emerald-600/15 hover:bg-emerald-700 active:scale-95 transition-all mt-4"
            >
              Lipa Sasa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
