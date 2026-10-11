import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, CheckCircle2, AlertCircle, X, ShieldCheck, Smartphone, RefreshCw, Zap, Receipt, Sparkles } from 'lucide-react';
import { checkNfcSupport, playPaymentChime, triggerHapticTap, startNfcReader } from '../../utils/nfcPayment';
import { toast } from 'sonner';

interface NfcTapPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptData: { txId: string; method: string; amount: number; time: string }) => void;
  amount: number;
  rideId?: string;
  driverName?: string;
  passengerName?: string;
  mode?: 'passenger' | 'driver';
}

export const NfcTapPaymentModal: React.FC<NfcTapPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
  rideId,
  driverName = 'Dereva Papo Hapo',
  passengerName = 'Mteja',
  mode = 'passenger'
}) => {
  const isHardwareSupported = checkNfcSupport();
  const [currentMode, setCurrentMode] = useState<'passenger' | 'driver'>(mode);
  const [currentAmount, setCurrentAmount] = useState<number>(amount > 0 ? amount : 3500);
  const [status, setStatus] = useState<'waiting' | 'scanning' | 'processing' | 'success' | 'error'>('waiting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txId, setTxId] = useState<string>('');

  useEffect(() => {
    setCurrentMode(mode);
    setCurrentAmount(amount > 0 ? amount : 3500);
  }, [mode, amount]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('waiting');
      setErrorMessage(null);
      return;
    }

    // Generate random reference code
    const generatedId = `PAPO-NFC-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxId(generatedId);

    // If device supports Web NFC, start listener
    let stopNfc: (() => void) | null = null;
    if (isHardwareSupported) {
      startNfcReader(
        (serialNumber, message) => {
          triggerSuccess(generatedId);
        },
        (err) => {
          console.warn('NFC hardware notice:', err.message);
        }
      ).then(cleanup => {
        stopNfc = cleanup;
      }).catch(() => {
        // Fallback to tap simulator
      });
    }

    return () => {
      if (stopNfc) stopNfc();
    };
  }, [isOpen, isHardwareSupported]);

  const triggerSuccess = (referenceId: string) => {
    setStatus('processing');
    triggerHapticTap();

    setTimeout(() => {
      setStatus('success');
      playPaymentChime();
      triggerHapticTap();

      const receipt = {
        txId: referenceId,
        method: 'nfc_tap',
        amount: currentAmount,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      toast.success(
        currentMode === 'driver' 
          ? `✓ Nauli ya TZS ${currentAmount.toLocaleString()} imepokelewa kwa NFC Tap!` 
          : `✓ Umelipa TZS ${currentAmount.toLocaleString()} kwa NFC Tap kwa ufanisi!`
      );

      setTimeout(() => {
        onSuccess(receipt);
      }, 1400);
    }, 1100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="w-full max-w-sm rounded-[32px] bg-[#11111a] border border-neutral-800 text-white p-6 shadow-2xl relative overflow-hidden space-y-5"
      >
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight leading-tight uppercase">
                {currentMode === 'driver' ? 'POKEA NAULI (NFC TERMINAL)' : 'LIPA NAULI KWA NFC TAP'}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isHardwareSupported ? 'bg-emerald-400 animate-ping' : 'bg-teal-400'}`} />
                <p className="text-[10px] text-neutral-300 font-mono">
                  {isHardwareSupported ? 'Chip ya NFC Ipo (Hardware Active)' : 'SoftPOS Contactless Ready'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector: Dereva (Pokea) au Mteja (Lipa) */}
        <div className="grid grid-cols-2 p-1 bg-neutral-900/90 rounded-2xl border border-neutral-800 text-[10px] font-black relative z-10">
          <button
            type="button"
            onClick={() => setCurrentMode('passenger')}
            className={`py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentMode === 'passenger'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mteja (Lipa)</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentMode('driver')}
            className={`py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentMode === 'driver'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Dereva (Pokea)</span>
          </button>
        </div>

        {/* Fare Display */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-center relative z-10 space-y-1">
          <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
            {currentMode === 'driver' ? 'Kiasi cha Kupokea Kutoka kwa Abiria' : 'Kiasi cha Kulipa kwa Dereva'}
          </span>
          <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
            TZS {currentAmount.toLocaleString()}
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center justify-center gap-1.5 pt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>0% Ada ya Muamala • BOT Compliant 🇹🇿</span>
          </div>

          {/* Quick Amount Presets if Amount is not fixed */}
          {(!amount || amount <= 0) && (
            <div className="pt-2 flex items-center justify-center gap-1.5">
              {[2000, 3500, 5000, 10000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCurrentAmount(amt)}
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                    currentAmount === amt 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  {amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visual Radar & Contactless Touch Terminal */}
        <div className="py-4 flex flex-col items-center justify-center relative z-10">
          {status === 'success' ? (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-3"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h4 className="text-lg font-black text-emerald-400">
                {currentMode === 'driver' ? 'Nauli Imepokelewa!' : 'Malipo Yamekamilika!'}
              </h4>
              <p className="text-xs text-neutral-300 font-mono">Kodi: {txId}</p>
            </motion.div>
          ) : status === 'processing' ? (
            <div className="text-center space-y-3 py-6">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs font-bold text-neutral-300">Inathibitisha kielektroniki...</p>
            </div>
          ) : (
            <div className="relative flex flex-col items-center justify-center py-4">
              {/* Animated Radar Rings */}
              <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 animate-ping pointer-events-none" />
              <div className="absolute w-32 h-32 rounded-full border border-emerald-400/40 animate-pulse pointer-events-none" />

              {/* Center Phone/NFC Touch Graphic */}
              <div 
                onClick={() => triggerSuccess(txId)}
                className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-500/30 cursor-pointer active:scale-95 transition-all group hover:scale-105"
                title="Gusa hapa kulipa / kukamilisha"
              >
                <Radio className="w-8 h-8 mb-1 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  GUSA HAPA
                </span>
              </div>
            </div>
          )}

          {status !== 'success' && status !== 'processing' && (
            <p className="text-xs text-neutral-400 text-center max-w-[260px] mt-2">
              {currentMode === 'driver'
                ? `Weka simu yako karibu na simu ya ${passengerName} au kadi yake ya NFC.`
                : `Gusa simu yako au kadi ya PapoPay nyuma ya simu ya ${driverName}.`}
            </p>
          )}
        </div>

        {/* Action Button */}
        {status !== 'success' && status !== 'processing' && (
          <div className="space-y-2 relative z-10">
            <button
              type="button"
              onClick={() => triggerSuccess(txId)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-neutral-950" />
              <span>
                {currentMode === 'driver' ? 'Thibitisha Kupokea kwa NFC (Dereva)' : 'Gusisha Kulipa Sasa (Tap to Pay)'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-center text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Ghairi / Funga
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
