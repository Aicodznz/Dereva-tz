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
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-2 inset-x-3 z-[1000] max-w-[380px] mx-auto bg-neutral-900/98 border border-orange-600/40 p-3 rounded-2xl shadow-2xl backdrop-blur-md space-y-2 text-white"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {/* Compact Timer */}
          <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="14" cy="14" r="11" stroke="#1f1f2e" strokeWidth="2.5" fill="none" />
              <motion.circle 
                cx="14" cy="14" r="11" stroke="#ea580c" strokeWidth="2.5" fill="none"
                initial={{ pathLength: 1 }}
                animate={{ pathLength: 0 }}
                transition={{ duration: 20, ease: "linear" }}
              />
            </svg>
            <span className="absolute text-[11px] font-black italic font-mono text-white">
              {timeLeft}
            </span>
          </div>

          <span className="bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
            📦 DELIVERY MPYA!
          </span>
        </div>

        <div className="text-right">
          <span className="text-[7.5px] font-black text-neutral-500 uppercase tracking-widest block leading-none">MAOKOTO</span>
          <span className="text-[15px] font-black italic text-emerald-400 tracking-tight leading-none">
            TZS {(order.deliveryFee ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Vendor & Customer Row */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-black/40 border border-neutral-800/80 rounded-xl text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="font-bold text-[11px] truncate">{(order as any).vendorName || 'Vendor'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] shrink-0">
          <span>{order.customerName}</span>
          <span className="bg-neutral-800 px-1 py-0.5 rounded text-[9px] text-neutral-300">
            {order.items?.length || 1} vitu
          </span>
        </div>
      </div>

      {/* Address */}
      <div className="px-2.5 py-1.5 bg-black/40 border border-neutral-800/80 rounded-xl space-y-1 text-[11px]">
        <div className="flex items-center gap-2 truncate">
          <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <span className="text-neutral-400 text-[10px] shrink-0">Chukua:</span>
          <span className="font-bold truncate text-white">{(order as any).distanceToVendor?.toFixed(1) || '0.5'} km kutoka hapa</span>
        </div>
        <div className="flex items-center gap-2 truncate">
          <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="text-neutral-400 text-[10px] shrink-0">Peleka:</span>
          <span className="font-bold truncate text-white">{order.deliveryAddress || 'Address'}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-0.5">
        <button 
          onClick={onDecline}
          className="w-[80px] h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black text-xs active:scale-95 transition-all"
        >
          KATAA
        </button>
        <button 
          onClick={onAccept}
          className="flex-1 h-9 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs tracking-wide shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <span>KUBALI ODA</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
