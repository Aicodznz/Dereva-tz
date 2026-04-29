import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Banknote, CreditCard, Smartphone, QrCode, CheckCircle2, ChevronRight, ShieldCheck, Download } from 'lucide-react';
import { Parcel } from '../../../types/parcel';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';

interface Props {
  parcel: Parcel;
}

const PaymentScreen: React.FC<Props> = ({ parcel }) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const earnings = parcel.pricing.partnerEarnings || 0;
  const totalCharge = parcel.pricing.total || 0;

  const handleConfirmPayment = async () => {
    setIsVerifying(true);
    // Simulate payment confirmation
    setTimeout(async () => {
       await updateDoc(doc(db, 'parcels', parcel.id), {
          paymentStatus: 'paid',
          status: 'rated' // Move to next screen
       });
       setIsVerifying(false);
       toast.success('Malipo yamethibitishwa!');
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex-1 overflow-y-auto p-8 space-y-10 pt-20">
         {/* Success Header */}
         <div className="text-center">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-emerald-500 w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black mb-2">Imewasilishwa!</h1>
            <p className="text-sm text-white/40">Sasa kamilisha hatua ya malipo</p>
         </div>

         {/* Total Summary */}
         <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Banknote size={100} />
            </div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Jumla ya Malipo</p>
            <div className="flex items-baseline justify-center gap-2">
               <span className="text-lg font-bold text-white/50">TZS</span>
               <span className="text-5xl font-black">{totalCharge.toLocaleString()}</span>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center px-4">
                <span className="text-[10px] font-bold text-white/30 uppercase">Mapato yako</span>
                <span className="text-emerald-400 font-bold">TZS {earnings.toLocaleString()}</span>
            </div>
         </div>

         {/* Payment Methods */}
         <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-2">Mbinu za Malipo</h3>
            <div className="grid grid-cols-2 gap-4">
               {[
                 { id: 'cash', icon: Banknote, label: 'CASH', color: 'bg-emerald-500' },
                 { id: 'mobile', icon: Smartphone, label: 'MODGIKE', color: 'bg-indigo-500' },
                 { id: 'lipa', icon: CreditCard, label: 'LIPA NO.', color: 'bg-pink-500' },
                 { id: 'qr', icon: QrCode, label: 'SCAN QR', color: 'bg-amber-500' }
               ].map((method) => (
                 <motion.button
                   key={method.id}
                   whileTap={{ scale: 0.95 }}
                   onClick={() => setSelectedMethod(method.id)}
                   className={`p-6 rounded-[32px] border transition-all flex flex-col items-center gap-3 ${
                      selectedMethod === method.id 
                      ? `border-white bg-white/10 ring-4 ring-white/5` 
                      : 'border-white/5 bg-white/5'
                   }`}
                 >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${method.color}`}>
                       <method.icon className="text-white w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold tracking-widest">{method.label}</span>
                 </motion.button>
               ))}
            </div>
         </section>

         {/* Mock QR Code if selected */}
         {selectedMethod === 'qr' && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-6 rounded-[32px] max-w-[200px] mx-auto"
            >
               <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=SwiftAppPayment" alt="qr" className="w-full" />
               <p className="text-black text-[10px] font-bold text-center mt-4">SCAN KULIPA</p>
            </motion.div>
         )}
      </div>

      {/* Footer */}
      <div className="p-8 pb-12 bg-gradient-to-t from-[#0a0a0f] pt-12">
         <motion.button
           disabled={!selectedMethod || isVerifying}
           onClick={handleConfirmPayment}
           whileTap={{ scale: 0.98 }}
           className={`w-full py-6 rounded-[24px] font-black tracking-widest uppercase flex items-center justify-center gap-4 transition-all ${
              selectedMethod && !isVerifying
              ? 'bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.1)]' 
              : 'bg-white/5 text-white/10 cursor-not-allowed'
           }`}
         >
            {isVerifying ? (
               <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
               <>
                  THIBITISHA MALIPO
                  <ShieldCheck className="w-6 h-6" />
               </>
            )}
         </motion.button>
         <button className="w-full mt-4 flex items-center justify-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-widest">
            <Download size={14} /> PAKUA RISITI
         </button>
      </div>
    </div>
  );
};

export default PaymentScreen;
