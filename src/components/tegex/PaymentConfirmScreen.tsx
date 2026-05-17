import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Banknote, CheckCircle2, QrCode, Phone } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface PaymentConfirmScreenProps {
  ride: Ride;
  onPaymentConfirmed: () => void;
}

export default function PaymentConfirmScreen({ ride, onPaymentConfirmed }: PaymentConfirmScreenProps) {
  const [method, setMethod] = useState<'cash' | 'online' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

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
      className="fixed inset-0 z-[2000] bg-[#0a0a0f] flex flex-col p-6"
    >
      <div className="flex-1 flex flex-col justify-center items-center gap-8 text-center">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-2">
           <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <div>
           <h2 className="text-3xl font-black italic tracking-tighter text-white leading-none mb-2">Safari Imekamilika!</h2>
           <p className="text-neutral-500 font-bold">Mteja amelipa kwa njia gani leo?</p>
        </div>

        <div className="w-full bg-[#111118] border border-[#1e1e2e] rounded-[40px] p-8">
           <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">KIASI CHA KULIPWA</p>
           <h3 className="text-5xl font-black italic text-[#7F77DD] tracking-tighter">TZS {(ride?.fare ?? 0).toLocaleString()}</h3>
        </div>

        <div className="w-full grid grid-cols-2 gap-4">
           <button 
             onClick={() => setMethod('cash')}
             className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${method === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-[#111118] border-[#1e1e2e] text-neutral-500'}`}
           >
              <Banknote className="w-8 h-8" />
              <div className="text-center">
                 <p className="text-sm font-black uppercase italic">CASH</p>
                 <p className="text-[10px] font-bold">Taslimu</p>
              </div>
           </button>
           
           <button 
             onClick={() => setMethod('online')}
             className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${method === 'online' ? 'bg-[#7F77DD]/10 border-[#7F77DD] text-[#7F77DD]' : 'bg-[#111118] border-[#1e1e2e] text-neutral-500'}`}
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
              <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-3 rounded-2xl flex items-center gap-2">
                 <QrCode className="w-4 h-4 text-neutral-500" />
                 <span className="text-[10px] font-black uppercase text-neutral-400">Scan QR</span>
              </div>
              <div className="bg-[#0a0a0f] border border-[#1e1e2e] p-3 rounded-2xl flex items-center gap-2">
                 <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-extrabold text-black italic">M</div>
                 <span className="text-[10px] font-black uppercase text-neutral-400">Mongike Pay</span>
              </div>
           </motion.div>
        )}
      </div>

      <button 
        disabled={!method || isConfirming}
        onClick={handleConfirmPay}
        className={`h-20 rounded-3xl bg-white text-black font-black uppercase italic text-xl shadow-[0_20px_50px_rgba(255,255,255,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale`}
      >
        {isConfirming ? 'Inatuma...' : 'THIBITISHA MALIPO'}
      </button>
    </motion.div>
  );
}
