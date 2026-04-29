import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, FileText, Smartphone, Box, Pill, Dog, MapPin, Navigation, ArrowRight, X } from 'lucide-react';
import { Parcel, ParcelCategory } from '../../../types/parcel';
import { useAcceptParcel } from '../../../hooks/parcel/partner/useAcceptParcel';
import { toast } from 'sonner';

interface Props {
  parcel: Parcel;
}

const categoryConfig: Record<ParcelCategory, { 
  icon: any, 
  color: string, 
  title: string, 
  desc: string,
  bg: string 
}> = {
  gift: { 
    icon: Package, 
    color: '#D4537E', 
    title: 'GIFT', 
    desc: 'Send heartfelt presents',
    bg: 'from-pink-500/20 to-transparent'
  },
  document: { 
    icon: FileText, 
    color: '#378ADD', 
    title: 'HATI', 
    desc: 'From IDs to forms, we deliver',
    bg: 'from-blue-500/20 to-transparent'
  },
  electronics: { 
    icon: Smartphone, 
    color: '#EF9F27', 
    title: 'ELECTRONICS', 
    desc: 'Safeguard your gadgets',
    bg: 'from-amber-500/20 to-transparent'
  },
  package: { 
    icon: Box, 
    color: '#888780', 
    title: 'PACKAGE', 
    desc: 'Small or large, delivered fast',
    bg: 'from-neutral-500/20 to-transparent'
  },
  medicine: { 
    icon: Pill, 
    color: '#E24B4A', 
    title: 'DAWA', 
    desc: 'Medical essentials, delivered',
    bg: 'from-red-500/20 to-transparent'
  },
  pet_supplies: { 
    icon: Dog, 
    color: '#639922', 
    title: 'PET SUPPLIES', 
    desc: 'Furry friend needs, with love',
    bg: 'from-emerald-500/20 to-transparent'
  }
};

const IncomingParcelCard: React.FC<Props> = ({ parcel }) => {
  const [timeLeft, setTimeLeft] = useState(15);
  const { acceptParcel } = useAcceptParcel();
  const config = categoryConfig[parcel.category];
  const Icon = config.icon;

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAccept = async () => {
    try {
      await acceptParcel(parcel.id);
      toast.success('Ombi limekubaliwa! Anza kuelekea kwa mtumaji.');
    } catch (error: any) {
      toast.error(error.message || 'Hitilafu ilitokea');
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 50 }}
      className="bg-[#111118] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative"
    >
      {/* Category Header */}
      <div className={`p-8 bg-gradient-to-b ${config.bg} relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Icon size={120} style={{ color: config.color }} />
        </div>

        <div className="flex items-start justify-between relative z-10">
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl" style={{ backgroundColor: config.color }}>
                 <Icon className="text-white w-9 h-9" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-50 block mb-1">OMBI JIPYA</span>
                <h2 className="text-2xl font-black text-white leading-none">{config.title}</h2>
              </div>
           </div>

           {/* Countdown Circle */}
           <div className="relative w-14 h-14 flex items-center justify-center">
             <svg className="w-full h-full -rotate-90">
               <circle
                 cx="28" cy="28" r="24"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="4"
                 className="text-white/10"
               />
               <motion.circle
                 cx="28" cy="28" r="24"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="4"
                 strokeDasharray="150.79"
                 initial={{ strokeDashoffset: 0 }}
                 animate={{ strokeDashoffset: 150.79 * (1 - timeLeft/15) }}
                 className="text-white"
               />
             </svg>
             <span className="absolute text-sm font-black">{timeLeft}</span>
           </div>
        </div>
        
        <p className="mt-6 text-white/50 text-sm font-medium italic">"{config.desc}"</p>
      </div>

      {/* Details Section */}
      <div className="p-8 space-y-8">
        <div className="space-y-6 relative">
          <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px border-l-2 border-dashed border-white/10" />
          
          <div className="flex items-start gap-4 relative">
             <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 mt-1 shadow-[0_0_10px_rgba(99,102,241,0.5)] z-10" />
             <div className="flex-1">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Mtumaji</p>
                <p className="text-sm font-bold text-white/90 leading-tight">{parcel.sender.address}</p>
                <p className="text-[11px] text-indigo-400 font-bold mt-1">2.1 km mbali (kuchukua)</p>
             </div>
          </div>

          <div className="flex items-start gap-4 relative">
             <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10" />
             <div className="flex-1">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Mpokeaji</p>
                <p className="text-sm font-bold text-white/90 leading-tight">{parcel.recipient.address}</p>
                <p className="text-[11px] text-emerald-400 font-bold mt-1">5.3 km safari (kupeleka)</p>
             </div>
          </div>
        </div>

        {/* Category Specific Data */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <p className="text-[10px] font-bold text-white/30 uppercase mb-1">Mapato Yako</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-white/50">TZS</span>
                    <span className="text-xl font-black text-white">{parcel.pricing.partnerEarnings?.toLocaleString()}</span>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold text-white/30 uppercase mb-1">Maelezo</p>
                 <p className="text-xs font-bold text-white/90">
                    {parcel.category === 'gift' && (parcel.categoryDetails?.wrapping ? '🎁 Is amefungwa' : 'Zawadi ya wazi')}
                    {parcel.category === 'document' && (parcel.categoryDetails?.isConfidential ? '🔒 Hati ya Siri' : 'Hati za kawaida')}
                    {parcel.category === 'electronics' && '⚠️ Fragile item'}
                    {parcel.category === 'medicine' && (parcel.categoryDetails?.requiresCold ? '❄️ Cold Chain' : 'Dawa za kawaida')}
                    {parcel.category === 'package' && `${parcel.categoryDetails?.weight || 'Kawaida'} kg`}
                    {parcel.category === 'pet_supplies' && '🐶 Kwa ajili ya mnyama'}
                 </p>
              </div>
           </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
           <button className="flex-1 py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-xs tracking-widest uppercase hover:bg-white/10 transition-colors">
              KATAA
           </button>
           <motion.button
             onClick={handleAccept}
             whileTap={{ scale: 0.95 }}
             className="flex-[2] py-5 rounded-2xl bg-white text-black font-black text-xs tracking-widest uppercase shadow-[0_10px_30px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3"
           >
              KUBALI OMBI
              <ArrowRight className="w-4 h-4" />
           </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default IncomingParcelCard;
