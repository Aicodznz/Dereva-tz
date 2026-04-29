import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, AlertTriangle, Info, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { Parcel } from '../../../types/parcel';
import { useParcelFlow } from '../../../hooks/parcel/partner/useParcelFlow';
import CategoryBadge from './CategoryBadge';
import { toast } from 'sonner';

interface Props {
  parcel: Parcel;
}

const AtSenderScreen: React.FC<Props> = ({ parcel }) => {
  const { updateParcelStatus } = useParcelFlow();
  const [photo, setPhoto] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [isCapturing, setIsCapturing] = useState(false);

  const categoryChecklists: Record<string, string[]> = {
    gift: ['Kifurushi kimefungwa vizuri', 'Hakuna uharibifu wa nje', 'Kadi ya zawadi ipo'],
    document: ['Bahasha imefungwa', 'Hati hazijajikunja', 'Anwani iko wazi'],
    electronics: ['Vifaa viko kwenye box', 'Box limezibwa (Sealed)', 'Betri zimeondolewa/zimezimwa'],
    package: ['Kifurushi kimefungwa', 'Uzito na ukubwa ni sahihi', 'Hakiruhusu kumwagika'],
    medicine: ['Dawa zimewekwa kwenye mfuko', 'Joto la baridi linazingatiwa', 'Mkataba wa dawa upo'],
    pet_supplies: ['Chakula kimefungwa', 'Vifaa havina sehemu kali', 'Mnyama hayumo ndani']
  };

  const currentChecklist = categoryChecklists[parcel.category] || [];

  const toggleCheck = (item: string) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const isComplete = currentChecklist.every(item => checklist[item]) && photo;

  const handlePickUp = async () => {
    if (!isComplete) {
       toast.error('Tafadhali kamilisha checklist na piga picha kwanza');
       return;
    }
    await updateParcelStatus(parcel.id, 'picked_up', { 
      'photos.pickup': photo,
      'checks.pickup': checklist 
    });
  };

  const simulatePhoto = () => {
    setIsCapturing(true);
    setTimeout(() => {
        setPhoto('https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?w=400&h=400&fit=crop');
        setIsCapturing(false);
        toast.info('Picha imechukuliwa na kuhifadhiwa');
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="p-6 bg-[#111118] border-b border-white/5 pt-12">
        <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black text-white">Chukua Parcel</h1>
            <CategoryBadge category={parcel.category} size="sm" />
        </div>
        <p className="text-sm text-white/40">Thibitisha vitu kabla ya kuondoka</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {/* Checklist Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
             <ShieldCheck className="text-indigo-400 w-5 h-5" />
             <h3 className="text-xs font-bold text-white/30 uppercase tracking-[.15em]">Orodha ya uhakiki (Checklist)</h3>
          </div>
          
          <div className="space-y-3">
             {currentChecklist.map((item, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleCheck(item)}
                  className={`w-full p-4 rounded-2xl flex items-center gap-4 border transition-all ${
                    checklist[item] 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                    : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                   <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      checklist[item] ? 'bg-emerald-500 text-white' : 'bg-white/5'
                   }`}>
                      {checklist[item] && <Check size={14} />}
                   </div>
                   <span className="text-sm font-medium text-left">{item}</span>
                </motion.button>
             ))}
          </div>
        </section>

        {/* Photo Section */}
        <section>
           <div className="flex items-center gap-2 mb-4">
              <Camera className="text-indigo-400 w-5 h-5" />
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-[.15em]">Picha ya Kifurushi (Lazima)</h3>
           </div>

           <div className="relative aspect-square w-full max-w-[200px] mx-auto group">
              <button 
                onClick={simulatePhoto}
                disabled={isCapturing}
                className="absolute inset-0 rounded-[40px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer z-10"
              >
                 {photo ? (
                    <img src={photo} alt="p" className="w-full h-full object-cover rounded-[38px]" />
                 ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <Camera className="text-white/40" />
                      </div>
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Piga Picha</span>
                    </>
                 )}
              </button>

              {isCapturing && (
                 <div className="absolute inset-0 bg-black/60 rounded-[40px] z-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                 </div>
              )}
           </div>
        </section>

        {/* Warnings */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
           <AlertTriangle className="text-amber-500 shrink-0" size={20} />
           <p className="text-[11px] text-amber-200/70 leading-relaxed">
             Ukikamilisha hatua hii, unakiri kuwa umepokea kifurushi kikiwa katika hali salama kama ilivyoelezwa hapo juu.
           </p>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent">
         <motion.button
           whileTap={{ scale: 0.98 }}
           onClick={handlePickUp}
           className={`w-full py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all ${
             isComplete 
             ? 'bg-indigo-500 text-white shadow-[0_15px_30px_rgba(79,70,229,0.3)]' 
             : 'bg-white/5 text-white/20 border border-white/10 grayscale cursor-not-allowed'
           }`}
         >
            NIMEPOKEA NAONDOKA
            <ArrowRight className="w-5 h-5" />
         </motion.button>
      </div>
    </div>
  );
};

export default AtSenderScreen;
