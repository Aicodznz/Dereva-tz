import React from 'react';
import { motion } from 'motion/react';
import { Phone, MessageSquare, MapPin, Navigation2, CheckCircle2 } from 'lucide-react';
import { Ride } from '../../types/ride.types';

interface DriverTripSheetProps {
  ride: Ride;
  onArrive: () => void;
  onStart: () => void;
  onComplete: () => void;
}

export default function DriverTripSheet({ ride, onArrive, onStart, onComplete }: DriverTripSheetProps) {
  const isArriving = ride.status === 'accepted';
  const isArrived = ride.status === 'driver_arrived';
  const isOnTrip = ride.status === 'on_trip';

  return (
    <motion.div 
      initial={{ y: 300 }} animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-[#111118] border-t border-[#1e1e2e] p-6 pb-12 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center bg-[#0a0a0f] p-4 rounded-3xl border border-[#1e1e2e]">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-neutral-800 overflow-hidden border border-[#1e1e2e]">
                <img 
                  src={ride.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                  alt={ride.customerInfo?.name}
                  className="w-full h-full object-cover"
                />
             </div>
             <div>
                <h3 className="text-lg font-black italic text-white leading-none">{ride.customerInfo?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                   <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <span className="text-[10px] font-black text-amber-500">★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}</span>
                   </div>
                   <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mteja</span>
                </div>
             </div>
          </div>
          <div className="flex gap-2">
             <a href={`tel:${ride.customerInfo?.phone}`} className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Phone className="w-5 h-5" />
             </a>
             <button className="w-12 h-12 rounded-2xl bg-[#7F77DD]/10 border border-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD]">
                <MessageSquare className="w-5 h-5" />
             </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className={`mt-1 w-2.5 h-2.5 ${isArriving || isArrived ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'} rounded-full`} />
            <div className="flex-1">
              <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Pickup Location</p>
              <p className="text-sm font-bold text-white leading-tight">{ride.pickup.address}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className={`mt-1 w-2.5 h-2.5 ${isOnTrip ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-neutral-700'} rounded-full`} />
            <div className="flex-1">
              <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Destination</p>
              <p className="text-sm font-bold text-white leading-tight">{ride.destination.address}</p>
            </div>
          </div>
        </div>

        {isArriving && (
          <button 
            onClick={onArrive}
            className="w-full h-16 rounded-2xl bg-emerald-500 text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            NIMEFIKA <MapPin className="w-5 h-5" />
          </button>
        )}

        {isArrived && (
          <button 
            onClick={onStart}
            className="w-full h-16 rounded-2xl bg-[#7F77DD] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(127,119,221,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            ANZA SAFARI <Navigation2 className="w-5 h-5" />
          </button>
        )}

        {isOnTrip && (
          <button 
            onClick={onComplete}
            className="w-full h-16 rounded-2xl bg-[#D85A30] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(216,90,48,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            MALIZA SAFARI <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
