import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, ShoppingBag, X, User, ArrowRight, Store } from 'lucide-react';
import { Order } from '../../types';

interface IncomingOrderCardProps {
  order: Order;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
}

export default function IncomingOrderCard({ order, onAccept, onDecline, onTimeout }: IncomingOrderCardProps) {
  const [timeLeft, setTimeLeft] = useState(20);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <motion.div 
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      className="fixed bottom-4 inset-x-4 z-[1000] bg-neutral-900 border-2 border-orange-600/30 p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
    >
      <div className="flex flex-col gap-5">
        <div className="text-center space-y-1">
          <div className="bg-orange-600 text-white text-[10px] font-black px-4 py-1 rounded-full italic inline-block tracking-widest shadow-[0_4px_12px_rgba(234,88,12,0.4)]">
            📦 DELIVERY MPYA!
          </div>
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="relative w-24 h-24">
             <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="44" stroke="#1e1e2e" strokeWidth="6" fill="none" />
                <motion.circle 
                  cx="48" cy="48" r="44" stroke="#ea580c" strokeWidth="6" fill="none"
                  initial={{ pathLength: 1 }}
                  animate={{ pathLength: 0 }}
                  transition={{ duration: 20, ease: "linear" }}
                />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center text-4xl font-black italic text-white font-mono">
                {timeLeft}
             </div>
          </div>
        </div>

        <div className="bg-black/40 border border-neutral-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold shrink-0">
               <Store className="w-4 h-4" />
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-neutral-600 uppercase mb-0.5">Pick up from</p>
                <p className="text-base font-black text-white leading-tight">{(order as any).vendorName || 'Vendor'}</p>
                <p className="text-[10px] font-bold text-neutral-500 mt-1">
                   {(order as any).distanceToVendor?.toFixed(1) || '0.5'} km kutoka hapa
                </p>
             </div>
          </div>
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold shrink-0">
               <MapPin className="w-4 h-4" />
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-neutral-600 uppercase mb-0.5">Deliver to</p>
                <p className="text-sm font-bold text-white leading-tight truncate">{order.deliveryAddress || 'Address'}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-black border border-neutral-800 p-4 rounded-2xl flex items-center gap-3">
              <User className="w-5 h-5 text-orange-600" />
              <div>
                 <p className="text-[9px] font-black text-neutral-500 uppercase">Customer</p>
                 <p className="text-xs font-black text-white truncate max-w-[80px]">{order.customerName}</p>
              </div>
           </div>
           <div className="bg-black border border-neutral-800 p-4 rounded-2xl flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
              <div>
                 <p className="text-[9px] font-black text-neutral-500 uppercase">Items</p>
                 <p className="text-xs font-black text-white">{order.items?.length || 0} Units</p>
              </div>
           </div>
        </div>

        <div className="flex items-center justify-between px-2">
           <p className="text-xs font-black text-neutral-500 uppercase tracking-widest italic font-bold">DELIVERY FEE:</p>
           <h3 className="text-3xl font-black italic text-white tracking-tighter">TZS {(order.deliveryFee ?? 0).toLocaleString()}</h3>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onDecline}
            className="flex-1 h-16 rounded-2xl bg-neutral-800 text-neutral-400 font-black uppercase tracking-widest text-xs hover:bg-neutral-700 transition-all border border-white/5 active:scale-95"
          >
            Kataa
          </button>
          <button 
            onClick={onAccept}
            className="flex-[2] h-16 rounded-2xl bg-orange-600 text-white font-black uppercase italic text-lg shadow-xl shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            KUBALI <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
