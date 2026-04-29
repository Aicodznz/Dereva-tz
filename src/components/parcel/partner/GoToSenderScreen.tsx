import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Phone, MessageSquare, ChevronRight, Info, AlertTriangle } from 'lucide-react';
import { Parcel } from '../../../types/parcel';
import ParcelMapView from './ParcelMapView';
import { useParcelFlow } from '../../../hooks/parcel/partner/useParcelFlow';
import CategoryBadge from './CategoryBadge';

interface Props {
  parcel: Parcel;
}

const GoToSenderScreen: React.FC<Props> = ({ parcel }) => {
  const { updateParcelStatus } = useParcelFlow();

  const handleArrived = async () => {
    await updateParcelStatus(parcel.id, 'at_sender');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      <div className="flex-1 relative">
        <ParcelMapView 
          destination={{ lat: parcel.sender.lat, lng: parcel.sender.lng }} 
          isDashed={true}
        />
        
        {/* Top Info Overlay */}
        <div className="absolute top-6 inset-x-4 z-[50]">
          <div className="bg-[#111118]/80 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Navigation className="text-indigo-400 w-5 h-5 animate-pulse" />
                </div>
                <div>
                   <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">KUELEKEA KWA MTUMAJI</p>
                   <p className="text-sm font-bold text-white/90">Dakika 8 • 2.4 km</p>
                </div>
             </div>
             <CategoryBadge category={parcel.category} size="sm" />
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-[#111118] border-t border-white/5 rounded-t-[40px] p-8 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">{parcel.sender.name}</h2>
                <p className="text-sm text-white/40 mt-1">{parcel.sender.address}</p>
              </div>
              <div className="flex gap-3">
                 <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                    <MessageSquare className="w-5 h-5" />
                 </button>
                 <a href={`tel:${parcel.sender.phone}`} className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Phone className="w-5 h-5" />
                 </a>
              </div>
           </div>

           {/* Special Instructions UI */}
           {parcel.category === 'medicine' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3 italic">
                 <AlertTriangle className="text-red-500 shrink-0" size={20} />
                 <p className="text-xs text-red-100/70 leading-relaxed">
                   <strong>ONYO:</strong> Hubeba dawa. Hakikisha kiwango cha joto kiko sawa na usizitikise sana.
                 </p>
              </div>
           )}

           <div className="flex items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/5">
              <Info className="text-indigo-400 shrink-0" size={18} />
              <p className="text-xs text-white/50 leading-relaxed">
                Mtumaji amesema: "{parcel.sender.notes || 'Hajatoa maagizo ya ziada.'}"
              </p>
           </div>

           <motion.button
             whileTap={{ scale: 0.98 }}
             onClick={handleArrived}
             className="w-full bg-white text-black py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase shadow-[0_15px_30px_rgba(255,255,255,0.1)]"
           >
              NIMEFIKA KWA MTUMAJI
           </motion.button>
        </div>
      </div>
    </div>
  );
};

export default GoToSenderScreen;
