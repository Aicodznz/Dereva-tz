import React from 'react';
import { motion } from 'motion/react';
import { Phone, MessageSquare, MapPin, Navigation2, CheckCircle2, ArrowRight } from 'lucide-react';
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

  const [waitTimer, setWaitTimer] = React.useState(0);
  
  React.useEffect(() => {
    let interval: any;
    if (isArrived) {
      interval = setInterval(() => {
        setWaitTimer(prev => prev + 1);
      }, 1000);
    } else {
      setWaitTimer(0);
    }
    return () => clearInterval(interval);
  }, [isArrived]);

  const formatTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ y: 300 }} animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-[#111118] border-t border-[#1e1e2e] p-6 pb-12 rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
    >
      <div className="flex flex-col gap-6">
        <div className="text-center">
           <div className="w-12 h-1.5 bg-[#1e1e2e] rounded-full mx-auto mb-4" />
           <p className="text-[10px] font-black text-[#7F77DD] uppercase tracking-[0.3em] italic">
             {isArriving ? 'Unakwenda kumchukua' : isArrived ? 'Umefika kwa mteja' : 'Safari inaendelea'}
           </p>
        </div>

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
                <h3 className="text-lg font-black italic text-white leading-none">{ride.customerInfo?.name || "John Doe"}</h3>
                <div className="flex items-center gap-2 mt-1">
                   <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <span className="text-[10px] font-black text-amber-500">★ {ride.customerInfo?.rating?.toFixed(1) || '5.0'}</span>
                   </div>
                   <p className="text-[10px] font-bold text-emerald-500 italic">TZS {(ride.fare || 0).toLocaleString()}</p>
                </div>
             </div>
          </div>
          <div className="flex gap-2">
             <a href={`tel:${ride.customerInfo?.phone || '0700000000'}`} className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 active:scale-90 transition-transform">
                <Phone className="w-5 h-5" />
             </a>
             <button className="w-12 h-12 rounded-2xl bg-[#7F77DD]/10 border border-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD] active:scale-90 transition-transform">
                <MessageSquare className="w-5 h-5" />
             </button>
          </div>
        </div>

        {isOnTrip && (
          <div className="space-y-2">
             <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">Safarni...</p>
                <p className="text-[10px] font-black text-[#7F77DD] italic">{ride.distance?.toFixed(1) || '5.1'} km imebaki</p>
             </div>
             <div className="h-2 bg-[#0a0a0f] rounded-full overflow-hidden border border-[#1e1e2e]">
                <motion.div 
                   className="h-full bg-[#1D9E75]"
                   initial={{ width: '0%' }}
                   animate={{ width: '62%' }}
                />
             </div>
          </div>
        )}

        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-3xl p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`mt-1.5 w-2 h-2 ${isArriving || isArrived ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-neutral-800'} rounded-full`} />
            <div className="flex-1 overflow-hidden">
               <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Pickup</p>
               <p className="text-sm font-bold text-white truncate leading-tight">{ride.pickup.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className={`mt-1.5 w-2 h-2 ${isOnTrip ? 'bg-[#D85A30] shadow-[0_0_10px_rgba(216,90,48,0.5)]' : 'bg-neutral-800'} rounded-full`} />
            <div className="flex-1 overflow-hidden">
               <p className="text-[9px] font-black text-neutral-600 uppercase mb-0.5">Destination</p>
               <p className="text-sm font-bold text-white truncate leading-tight">{ride.destination.address}</p>
            </div>
          </div>
        </div>

        {isArrived && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#7F77DD]/5 rounded-2xl border border-[#7F77DD]/20">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-black text-neutral-400 uppercase italic">Mteja Anasubiri...</p>
             </div>
             <p className="text-sm font-black italic font-mono text-amber-500">{formatTimer(waitTimer)} →</p>
          </div>
        )}

        {isArriving && (
          <button 
            onClick={onArrive}
            className="w-full h-16 rounded-2xl bg-white text-[#0a0a0f] font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            NIMEFIKA <ArrowRight className="w-6 h-6" />
          </button>
        )}

        {isArrived && (
          <button 
            onClick={onStart}
            className="w-full h-16 rounded-2xl bg-[#1D9E75] text-white font-black uppercase italic text-lg shadow-[0_10px_30px_rgba(29,158,117,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            ANZA SAFARI <ArrowRight className="w-6 h-6" />
          </button>
        )}

        {isOnTrip && (
          <button 
            onClick={onComplete}
            className="w-full h-16 rounded-2xl bg-[#D85A30] text-white font-black uppercase italic text-lg shadow-[0_10px_30_rgba(216,90,48,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            MALIZA SAFARI <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
