import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Banknote, CheckCircle2, QrCode, Phone, Radio, Zap, ScanFace, Sparkles } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../../ThemeContext';
import { NfcTapPaymentModal } from './NfcTapPaymentModal';
import { FacePaymentModal } from './FacePaymentModal';
import { checkNfcSupport } from '../../utils/nfcPayment';

interface PaymentConfirmScreenProps {
  ride: Ride;
  onPaymentConfirmed: () => void;
}

export default function PaymentConfirmScreen({ ride, onPaymentConfirmed }: PaymentConfirmScreenProps) {
  const isHardwareSupported = checkNfcSupport();
  const [method, setMethod] = useState<'cash' | 'online' | 'nfc' | 'face' | null>('face');
  const [showNfcModal, setShowNfcModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const handleConfirmPay = async () => {
    if (!method) return;
    setIsConfirming(true);
    try {
      if (ride.id) {
        await updateDoc(doc(db, 'rides', ride.id), {
          paymentMethod: method,
          paymentStatus: 'paid',
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      onPaymentConfirmed();
    } catch (e) {
      console.error("Payment confirmation failed:", e);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleNfcCollected = async () => {
    setShowNfcModal(false);
    setMethod('nfc');
    setIsConfirming(true);
    try {
      if (ride.id) {
        await updateDoc(doc(db, 'rides', ride.id), {
          paymentMethod: 'nfc',
          paymentStatus: 'paid',
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      onPaymentConfirmed();
    } catch (e) {
      console.error("NFC Payment collection failed:", e);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleFacePaymentSuccess = async (receipt: any) => {
    setShowFaceModal(false);
    setMethod('face');
    setIsConfirming(true);
    try {
      if (ride.id) {
        await updateDoc(doc(db, 'rides', ride.id), {
          paymentMethod: 'face',
          paymentStatus: 'paid',
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          faceVerified: true,
          faceTxId: receipt.txId
        });
      }
      onPaymentConfirmed();
    } catch (e) {
      console.error("Face Payment collection failed:", e);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`fixed inset-0 z-[2000] ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col p-6`}
    >
      <div className="flex-1 flex flex-col justify-center items-center gap-8 text-center">
        <div className={`w-24 h-24 ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'} border rounded-full flex items-center justify-center mb-2 shadow-sm`}>
           <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <div>
           <h2 className={`text-3xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'} leading-none mb-2`}>Safari Imekamilika!</h2>
           <p className="text-neutral-500 font-bold">Mteja amelipa kwa njia gani leo?</p>
        </div>

        <div className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200'} border rounded-[40px] p-8 shadow-sm`}>
           <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">KIASI CHA KULIPWA</p>
           <h3 className="text-5xl font-black italic text-indigo-600 tracking-tighter">TZS {(ride?.fare ?? 0).toLocaleString()}</h3>
        </div>

        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
           {/* 1. Face Payment (Smile-to-Pay) */}
           <button 
             onClick={() => {
               setMethod('face');
               setShowFaceModal(true);
             }}
             className={`h-28 rounded-3xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer relative overflow-hidden ${method === 'face' ? (theme === 'dark' ? 'bg-cyan-950/30 border-cyan-500 text-cyan-400 shadow-sm' : 'bg-cyan-50 border-cyan-600 text-cyan-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <div className="relative">
                <ScanFace className="w-7 h-7 text-cyan-400 animate-pulse" />
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="text-center">
                 <p className="text-xs font-black uppercase italic">FACE PAY</p>
                 <p className="text-[9px] font-bold">Smile-to-Pay ⚡</p>
              </div>
           </button>

           {/* 2. NFC Tap */}
           <button 
             onClick={() => {
               setMethod('nfc');
               setShowNfcModal(true);
             }}
             className={`h-28 rounded-3xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${method === 'nfc' ? (theme === 'dark' ? 'bg-teal-950/30 border-teal-500 text-teal-400 shadow-sm' : 'bg-teal-50 border-teal-600 text-teal-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <div className="relative">
                <Radio className="w-7 h-7 text-teal-500 animate-pulse" />
                <span className={`absolute -top-1 -right-2 w-2 h-2 rounded-full ${isHardwareSupported ? 'bg-emerald-400 animate-ping' : 'bg-teal-400'}`} />
              </div>
              <div className="text-center">
                 <p className="text-xs font-black uppercase italic">NFC TAP</p>
                 <p className="text-[9px] font-bold">{isHardwareSupported ? 'Chip Ipo ✅' : 'Gusa Simu'}</p>
              </div>
           </button>

           {/* 3. Cash */}
           <button 
             onClick={() => setMethod('cash')}
             className={`h-28 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${method === 'cash' ? (theme === 'dark' ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400 shadow-sm' : 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <Banknote className="w-7 h-7" />
              <div className="text-center">
                 <p className="text-xs font-black uppercase italic">CASH</p>
                 <p className="text-[9px] font-bold">Taslimu</p>
              </div>
           </button>
           
           {/* 4. Online */}
           <button 
             onClick={() => setMethod('online')}
             className={`h-28 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${method === 'online' ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-850 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
           >
              <Phone className="w-7 h-7" />
              <div className="text-center">
                 <p className="text-xs font-black uppercase italic">ONLINE</p>
                 <p className="text-[9px] font-bold">Simu / QR</p>
              </div>
           </button>
        </div>

        {method === 'face' && (
           <div className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs gap-2 ${theme === 'dark' ? 'bg-cyan-950/20 border-cyan-800 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-800'}`}>
              <div className="flex items-center gap-2 min-w-0 text-left">
                 <ScanFace className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                 <div className="min-w-0">
                   <p className="font-black text-xs leading-tight">
                     Face Payment (Smile-to-Pay) Tayari ⚡
                   </p>
                   <p className="text-[10px] opacity-80 truncate">
                     Mteja anatazama kamera ya simu kwa sekunde 2, anatabasamu na kukamilisha malipo
                   </p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFaceModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] font-black uppercase shrink-0 transition-colors cursor-pointer"
              >
                Fungua Sura
              </button>
           </div>
        )}

        {method === 'nfc' && (
           <div className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs gap-2 ${theme === 'dark' ? 'bg-teal-950/20 border-teal-800 text-teal-300' : 'bg-teal-50 border-teal-200 text-teal-800'}`}>
              <div className="flex items-center gap-2 min-w-0 text-left">
                 <Radio className="w-4 h-4 text-teal-400 animate-ping shrink-0" />
                 <div className="min-w-0">
                   <p className="font-black text-xs leading-tight">
                     {isHardwareSupported ? 'NFC Hardware Tayari ✅' : 'Contactless SoftPOS Tayari 📡'}
                   </p>
                   <p className="text-[10px] opacity-80 truncate">
                     {isHardwareSupported ? 'Mteja aguse simu au kadi yake nyuma ya simu yako' : 'Fungua terminal kupokea malipo kwa mguso'}
                   </p>
                 </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNfcModal(true)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-[10px] font-black uppercase shrink-0 transition-colors cursor-pointer"
              >
                Fungua Terminal
              </button>
           </div>
        )}

        {method === 'online' && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full grid grid-cols-2 gap-3 mt-[-20px]">
              <div className={`border p-3 rounded-2xl flex items-center gap-2 shadow-sm ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'}`}>
                 <QrCode className="w-4 h-4 text-neutral-400" />
                 <span className="text-[10px] font-black uppercase">Scan QR</span>
              </div>
              <div className={`border p-3 rounded-2xl flex items-center gap-2 shadow-sm ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'}`}>
                 <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-extrabold text-white italic">M</div>
                 <span className="text-[10px] font-black uppercase">Mongike Pay</span>
              </div>
           </motion.div>
        )}
      </div>

      <button 
        disabled={!method || isConfirming}
        onClick={handleConfirmPay}
        className={`h-20 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic text-xl shadow-lg shadow-indigo-600/10 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale`}
      >
        {isConfirming ? 'Inatuma...' : 'THIBITISHA MALIPO'}
      </button>

      {/* Face Payment Modal */}
      <FacePaymentModal
        isOpen={showFaceModal}
        amount={ride?.fare ?? 0}
        recipientName="Dereva Papo Hapo"
        serviceTitle="Nauli ya Safari"
        onClose={() => setShowFaceModal(false)}
        onSuccess={handleFacePaymentSuccess}
      />

      {/* NFC Tap Terminal Modal for Driver */}
      <NfcTapPaymentModal
        isOpen={showNfcModal}
        amount={ride?.fare ?? 0}
        rideId={ride?.id}
        passengerName="Mteja"
        mode="driver"
        onClose={() => setShowNfcModal(false)}
        onSuccess={handleNfcCollected}
      />
    </motion.div>
  );
}
