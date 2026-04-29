import React from 'react';
import { motion } from 'framer-motion';
import { Navigation, Phone, MessageSquare, AlertCircle, Info, ChevronUp, MapPin } from 'lucide-react';
import { Parcel } from '../../../types/parcel';
import ParcelMapView from './ParcelMapView';
import { useParcelFlow } from '../../../hooks/parcel/partner/useParcelFlow';
import CategoryBadge from './CategoryBadge';

interface Props {
  parcel: Parcel;
}

const InTransitScreen: React.FC<Props> = ({ parcel }) => {
  const { updateParcelStatus } = useParcelFlow();

  const handleArrived = async () => {
    await updateParcelStatus(parcel.id, 'arrived_recipient');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      <div className="flex-1 relative">
        <ParcelMapView 
          destination={{ lat: parcel.recipient.lat, lng: parcel.recipient.lng }} 
          isDashed={false}
          routeColor="#10b981"
        />

        {/* Dynamic ETA Floating Chip */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[50]">
          <div className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
             <span className="text-xs font-black tracking-widest uppercase">Dakika 12 kufika</span>
          </div>
        </div>

        {/* Floating Category Tag */}
        <div className="absolute top-6 right-6 z-[50]">
           <CategoryBadge category={parcel.category} size="sm" />
        </div>
      </div>

      {/* Modern Navigation Bottom Sheet */}
      <div className="bg-[#111118]/95 backdrop-blur-md border-t border-white/5 rounded-t-[40px] px-8 py-10 shadow-[0_-30px_60px_rgba(0,0,0,0.8)]">
        <div className="space-y-8">
           {/* Recipient Header */}
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-[24px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <MapPin className="w-8 h-8" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-white leading-none mb-1">{parcel.recipient.name}</h2>
                    <p className="text-sm text-white/40">{parcel.recipient.address}</p>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <MessageSquare className="w-6 h-6" />
                 </button>
                 <a href={`tel:${parcel.recipient.phone}`} className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <Phone className="w-6 h-6" />
                 </a>
              </div>
           </div>

           {/* Warning for Electronics/Meds */}
           {(parcel.category === 'electronics' || parcel.category === 'medicine') && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="text-amber-500 w-6 h-6" />
                 </div>
                 <div>
                    <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">TAHADHARI KUBWA</p>
                    <p className="text-[11px] text-amber-200/50 leading-relaxed">
                       Bidhaa hii ni tete. Epuka mwendo wa kasi sana au kupita kwenye mashimo makubwa barabarani.
                    </p>
                 </div>
              </div>
           )}

           {/* Progress Line */}
           <div className="relative pt-2">
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: '45%' }}
                  className="h-full bg-emerald-500"
                />
             </div>
             <div className="flex justify-between mt-3 px-1">
                <span className="text-[10px] font-bold text-white/30 uppercase">Imepokelewa</span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase">Njiani</span>
                <span className="text-[10px] font-bold text-white/30 uppercase">Mwisho</span>
             </div>
           </div>

           {/* Action */}
           <motion.button
             whileTap={{ scale: 0.98 }}
             onClick={handleArrived}
             className="w-full bg-emerald-500 text-white py-6 rounded-2xl font-black text-sm tracking-[0.2em] uppercase shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
           >
              NIMEFIKA KWA MPOKEAJI
           </motion.button>
        </div>
      </div>
    </div>
  );
};

export default InTransitScreen;
