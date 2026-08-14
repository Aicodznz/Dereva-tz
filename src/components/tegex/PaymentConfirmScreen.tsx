import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Banknote, CheckCircle2, QrCode, Phone } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../../ThemeContext';

interface PaymentConfirmScreenProps {
  ride: Ride;
  onPaymentConfirmed: () => void;
}

export default function PaymentConfirmScreen({ ride, onPaymentConfirmed }: PaymentConfirmScreenProps) {
  const [method, setMethod] = useState<'cash' | 'online' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const handleConfirmPay = async () => {
    if (!method) return;
    setIsConfirming(true);
    try {
      if (ride.id) {
        await updateDoc(doc(db, 'rides', ride.id), {
          paymentMethod: method,
          paymentStatus: 'paid',
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      onPaymentConfirmed();
    } catch (e) {
      console.error("Payment confirmation failed:", e);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`fixed inset-0 z-[2000] ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col p-6`}
    >
      <div className="flex-1 flex flex-col justify-center items-center gap-8 text-center">
        <div className={`w-24 h-24 ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'} border rounded-full flex items-center justify-center mb-2 shadow-sm`}>
           <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <div>
           <h2 className={`text-3xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'} leading-none mb-2`}>Safari Imekamilika!</h2>
           <p className="text-neutral-500 font-bold">Mteja amelipa kwa njia gani leo?</p>
        </div>

        <div className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200'} border rounded-[40px] p-8 shadow-sm`}>
           <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">KIASI CHA KULIPWA</p>
           <h3 className="text-5xl font-black italic text-indigo-600 tracking-tighter">TZS {(ride?.fare ?? 0).toLocaleString()}</h3>
        </div>

        <div className="w-full grid grid-cols-2 gap-4">
           <button 
             onClick={() => setMethod('cash')}
             className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${method === 'cash' ? (theme === 'dark' ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400 shadow-sm' : 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <Banknote className="w-8 h-8" />
              <div className="text-center">
                 <p className="text-sm font-black uppercase italic">CASH</p>
                 <p className="text-[10px] font-bold">Taslimu</p>
              </div>
           </button>
           
           <button 
             onClick={() => setMethod('online')}
             className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${method === 'online' ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <Phone className="w-8 h-8" />
              <div className="text-center">
                 <p className="text-sm font-black uppercase italic">ONLINE</p>
                 <p className="text-[10px] font-bold">Mongike/Selcom</p>
              </div>
           </button>
        </div>

        {method === 'online' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full grid grid-cols-2 gap-3 mt-[-20px]">
              <div className={`border p-3 rounded-2xl flex items-center gap-2 shadow-sm ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'}`}>
                 <QrCode className="w-4 h-4 text-neutral-400" />
                 <span className="text-[10px] font-black uppercase">Scan QR</span>
              </div>
              <div className={`border p-3 rounded-2xl flex items-center gap-2 shadow-sm ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'}`}>
                 <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-extrabold text-white italic">M</div>
                 <span className="text-[10px] font-black uppercase">Mongike Pay</span>
              </div>
           </motion.div>
        )}
      </div>

      <button 
        disabled={!method || isConfirming}
        onClick={handleConfirmPay}
        className={`h-20 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic text-xl shadow-lg shadow-indigo-600/10 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale`}
      >
        {isConfirming ? 'Inatuma...' : 'THIBITISHA MALIPO'}
      </button>
    </motion.div>
  );
}
