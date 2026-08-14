import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Wallet, Smartphone, Banknote, FileText, CheckCircle2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useTheme } from 'next-themes';
import { UssdPaymentModal } from './UssdPaymentModal';
import { DigitalReceiptModal } from './DigitalReceiptModal';

interface TripCompleteScreenProps {
  ride: Ride;
  onPay: (method: string) => void;
}

export const TripCompleteScreen: React.FC<TripCompleteScreenProps> = ({ ride, onPay }) => {
  const [method, setMethod] = useState<'cash' | 'mpesa' | 'tigopesa' | 'wallet'>('mpesa');
  const [showUssdModal, setShowUssdModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const fare = Number(ride?.fare) || 0;
  const distanceKm = Number(ride?.distance) || 3.8;
  const baseFare = Math.min(1500, Math.round(fare * 0.3));
  const vatAmount = Math.round(fare * 0.18);
  const distanceCost = Math.max(0, fare - baseFare - vatAmount);

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
      className="absolute w-2 h-2 rounded-full z-0 pointer-events-none"
      style={{ 
        backgroundColor: ['#059669', '#4f46e5', '#ea580c', '#cbd5e1'][Math.floor(Math.random() * 4)],
        left: `${Math.random() * 100}%`,
        top: '-10px'
      }}
    />
  ));

  const handlePayClick = () => {
    if (method === 'mpesa' || method === 'tigopesa') {
      setShowUssdModal(true);
    } else {
      onPay(method);
    }
  };

  const handleUssdSuccess = (txId: string) => {
    setShowUssdModal(false);
    onPay(method);
  };

  return (
    <div 
      className={`h-full w-full ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto relative z-50`}
    >
      {confetti}

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center my-auto">
        <div
           className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/20 mb-4 animate-bounce"
        >
           <Check className="w-8 h-8 text-white stroke-[3]" />
        </div>

        <h2 className={`text-2xl sm:text-3xl font-black italic uppercase tracking-tighter ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'} text-center leading-none mb-1`}>
          Safari Imekamilika!
        </h2>
        <p className="text-neutral-500 text-xs font-bold mb-6">Asante kwa kusafiri na Papo Hapo</p>

        <div 
          className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/80'} border rounded-[32px] p-6 shadow-xl relative overflow-hidden`}
        >
          <div className="space-y-5">
            <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              <span>Mchanganuo wa Malipo</span>
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="text-indigo-500 hover:text-indigo-400 flex items-center gap-1 font-bold lowercase tracking-normal text-[11px] underline underline-offset-2 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>e-risiti</span>
              </button>
            </div>

            <div className="space-y-2.5">
               <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                  <span>Nauli ya Msingi</span>
                  <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}>TZS {baseFare.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                  <span>Umbali ({distanceKm.toFixed(1)} km)</span>
                  <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}>TZS {distanceCost.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                  <span>VAT (18% TRA)</span>
                  <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'}>TZS {vatAmount.toLocaleString()}</span>
               </div>

               <div className={`h-px ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`} />

               <div className="flex justify-between items-end pt-1">
                  <div className="text-left">
                     <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Jumla ya Kulipa</p>
                     <h3 className="text-2xl sm:text-3xl font-black italic text-indigo-600 font-mono">TZS {fare.toLocaleString()}</h3>
                  </div>
                  <div className={`px-2.5 py-1 border rounded-full text-[8.5px] font-black uppercase ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                     Bado Hujalipa
                  </div>
               </div>
            </div>

            <div className="space-y-2.5">
               <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest text-center">Chagua Njia ya Malipo</p>
               <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => setMethod('mpesa')} 
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      method === 'mpesa' 
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-600 dark:text-red-400 shadow-xs ring-1 ring-red-500' 
                        : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                     <Smartphone className="w-4 h-4 text-red-500" />
                     <span className="text-[8.5px] font-black uppercase">M-Pesa</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setMethod('cash')} 
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      method === 'cash' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500' 
                        : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                     <Banknote className="w-4 h-4 text-emerald-500" />
                     <span className="text-[8.5px] font-black uppercase">Taslimu</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setMethod('wallet')} 
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      method === 'wallet' 
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500' 
                        : 'bg-neutral-50 dark:bg-neutral-850 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                     <Wallet className="w-4 h-4 text-amber-500" />
                     <span className="text-[8.5px] font-black uppercase">Mkoba</span>
                  </button>
               </div>
            </div>

            <button 
              type="button"
              onClick={handlePayClick}
              className="w-full h-13 bg-emerald-600 text-white rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{method === 'mpesa' ? 'Lipa kwa M-Pesa' : method === 'cash' ? 'Lipa Pesa Mkononi' : 'Lipa kwa Mkoba'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="w-full text-center text-[10px] font-bold text-neutral-400 hover:text-indigo-400 transition-colors uppercase tracking-wider cursor-pointer"
            >
              📜 Fungua Risiti ya Kidijitali (E-Receipt)
            </button>
          </div>
        </div>
      </div>

      {/* USSD Prompt Simulation */}
      <UssdPaymentModal
        isOpen={showUssdModal}
        operator={method === 'mpesa' ? 'mpesa' : 'tigopesa'}
        amount={fare}
        recipientName="PAPO HAPO RIDES TZ"
        onSuccess={handleUssdSuccess}
        onCancel={() => setShowUssdModal(false)}
      />

      {/* Digital E-Receipt Modal */}
      <DigitalReceiptModal
        isOpen={showReceiptModal}
        ride={ride}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
};

