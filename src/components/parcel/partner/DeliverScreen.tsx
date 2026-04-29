import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, PenTool, CheckCircle2, ShieldAlert, FileCheck, ArrowRight, UserCheck } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Parcel } from '../../../types/parcel';
import { useParcelFlow } from '../../../hooks/parcel/partner/useParcelFlow';
import CategoryBadge from './CategoryBadge';
import { toast } from 'sonner';

interface Props {
  parcel: Parcel;
}

const DeliverScreen: React.FC<Props> = ({ parcel }) => {
  const { updateParcelStatus } = useParcelFlow();
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [idVerified, setIdVerified] = useState(false);
  const sigCanvas = useRef<SignatureCanvas | null>(null);

  const needsSignature = parcel.category === 'electronics' || parcel.category === 'document';
  const needsId = parcel.category === 'electronics';

  const isComplete = photo && (!needsSignature || signature) && (!needsId || idVerified);

  const handleDeliver = async () => {
    if (!isComplete) {
       toast.error('Tafadhali kamilisha hatua zote za usalama');
       return;
    }
    await updateParcelStatus(parcel.id, 'delivered', {
      'photos.delivery': photo,
      'delivery.signature': signature,
      'delivery.idVerified': idVerified
    });
  };

  const saveSignature = () => {
    if (sigCanvas.current) {
        setSignature(sigCanvas.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
        sigCanvas.current.clear();
        setSignature(null);
    }
  };

  const simulatePhoto = () => {
    setPhoto('https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=400&fit=crop');
    toast.info('Picha ya makabidhiano imechukuliwa');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="p-8 bg-[#111118] border-b border-white/5 pt-16">
        <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-black text-white">Kabidhi Parcel</h1>
            <CategoryBadge category={parcel.category} size="md" />
        </div>
        <p className="text-sm text-white/40">Hatua za usalama kabla ya kukabidhi</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-12 pb-32">
        {/* Photo Delivery */}
        <section>
           <div className="flex items-center gap-3 mb-6">
              <Camera className="text-indigo-400 w-6 h-6" />
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-[.2em]">Picha ya Makabidhiano</h3>
           </div>
           
           <div 
             onClick={simulatePhoto}
             className="relative aspect-video w-full rounded-[32px] border-2 border-dashed border-white/10 overflow-hidden bg-white/5 flex flex-col items-center justify-center cursor-pointer"
           >
              {photo ? (
                <img src={photo} alt="p" className="w-full h-full object-cover" />
              ) : (
                <>
                   <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <Camera className="text-white/40 w-8 h-8" />
                   </div>
                   <span className="text-xs font-bold text-white/40 uppercase tracking-widest">PIGA PICHA NA MPOKEAJI</span>
                </>
              )}
           </div>
        </section>

        {/* ID Verification for High Value */}
        {needsId && (
           <section>
              <div className="flex items-center gap-3 mb-6">
                 <ShieldAlert className="text-amber-500 w-6 h-6" />
                 <h3 className="text-xs font-bold text-white/30 uppercase tracking-[.2em]">Uhakiki wa Kitambulisho</h3>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setIdVerified(!idVerified)}
                className={`w-full p-6 rounded-[24px] flex items-center justify-between border transition-all ${
                  idVerified 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-500/80'
                }`}
              >
                 <div className="flex items-center gap-4 text-left">
                    <UserCheck className="w-8 h-8" />
                    <div>
                       <p className="font-bold">Kagua Kitambulisho</p>
                       <p className="text-[10px] opacity-60 uppercase tracking-wider">Mpokeaji lazima aonyeshe ID</p>
                    </div>
                 </div>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${idVerified ? 'bg-emerald-500 text-white' : 'bg-amber-500/20'}`}>
                    {idVerified && <CheckCircle2 size={20} />}
                 </div>
              </motion.button>
           </section>
        )}

        {/* Signature Capture */}
        {needsSignature && (
           <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <PenTool className="text-indigo-400 w-6 h-6" />
                   <h3 className="text-xs font-bold text-white/30 uppercase tracking-[.2em]">Sahihi ya Mpokeaji</h3>
                </div>
                {signature && (
                    <button onClick={clearSignature} className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">FUTA</button>
                )}
              </div>

              <div className="bg-white rounded-[32px] overflow-hidden">
                 <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-48 signature-pad' }}
                    onEnd={saveSignature}
                 />
              </div>
              <p className="mt-3 text-center text-[10px] text-white/20 uppercase tracking-widest">Weka sahihi hapo juu kuthibitisha mapokezi</p>
           </section>
        )}
      </div>

      {/* Footer Action */}
       <div className="fixed bottom-0 inset-x-0 p-8 bg-gradient-to-t from-[#0a0a0f] pt-12">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleDeliver}
            className={`w-full py-6 rounded-[24px] font-black tracking-[0.25em] uppercase flex items-center justify-center gap-4 transition-all ${
              isComplete 
              ? 'bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.1)]' 
              : 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed'
            }`}
          >
             KAMILISHA KAZI HII
             <FileCheck className="w-6 h-6" />
          </motion.button>
       </div>
    </div>
  );
};

export default DeliverScreen;
