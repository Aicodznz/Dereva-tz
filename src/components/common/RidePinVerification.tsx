import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, KeyRound, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RidePinDisplayProps {
  pin: string;
}

export const RidePinDisplay: React.FC<RidePinDisplayProps> = ({ pin }) => {
  const displayPin = pin || "4821";

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 px-4 rounded-2xl shadow-lg border border-emerald-400/30 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-200 block">PIN YA VERIFICATION YAKO</span>
          <span className="text-xs font-semibold text-emerald-100">Mpe dereva PIN hii kabla hajaanza safari</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 font-mono font-black text-lg tracking-[0.25em] text-white shadow-inner">
        {displayPin.split('').map((char, idx) => (
          <span key={idx} className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">{char}</span>
        ))}
      </div>
    </div>
  );
};

interface DriverPinKeypadModalProps {
  isOpen: boolean;
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const DriverPinKeypadModal: React.FC<DriverPinKeypadModalProps> = ({
  isOpen,
  expectedPin,
  onSuccess,
  onCancel,
}) => {
  const [inputPin, setInputPin] = useState<string>('');
  const [isError, setIsError] = useState(false);

  const targetPin = expectedPin || "4821";

  const handleDigitClick = (digit: string) => {
    if (inputPin.length < 4) {
      const nextPin = inputPin + digit;
      setInputPin(nextPin);
      setIsError(false);

      if (nextPin.length === 4) {
        if (nextPin === targetPin) {
          toast.success("PIN imethibitishwa kikamilifu!", {
            description: "Safari inaanza sasa hivi. Endesha kwa usalama!",
          });
          setTimeout(() => {
            onSuccess();
            setInputPin('');
          }, 400);
        } else {
          setIsError(true);
          toast.error("PIN Sio Sahihi!", {
            description: "Mpe mteja nafasi ya kuangalia PIN kwenye simu yake.",
          });
          setTimeout(() => {
            setInputPin('');
            setIsError(false);
          }, 1000);
        }
      }
    }
  };

  const handleDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
    setIsError(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 text-center space-y-6"
        >
          {/* Header */}
          <div className="space-y-2">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black italic uppercase tracking-tight text-neutral-900 dark:text-white">Weka PIN ya Mteja</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Omba PIN ya tarakimu 4 kutoka kwa mteja kabla ya kuanza safari
            </p>
          </div>

          {/* PIN Display Boxes */}
          <div className="flex justify-center gap-3 my-2">
            {[0, 1, 2, 3].map((idx) => {
              const char = inputPin[idx];
              return (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all ${
                    isError
                      ? 'border-red-500 bg-red-500/10 text-red-500 animate-bounce'
                      : char
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-md'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-300'
                  }`}
                >
                  {char || '•'}
                </div>
              );
            })}
          </div>

          {isError && (
            <p className="text-xs font-black text-red-500 flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4" /> PIN sio sahihi! Jaribu tena.
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleDigitClick(digit)}
                className="h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-mono font-black text-lg text-neutral-800 dark:text-white transition-all active:scale-95 border-0 outline-none"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={onCancel}
              className="h-12 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-black text-xs uppercase transition-all active:scale-95 border-0 outline-none"
            >
              Funga
            </button>
            <button
              onClick={() => handleDigitClick('0')}
              className="h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-mono font-black text-lg text-neutral-800 dark:text-white transition-all active:scale-95 border-0 outline-none"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="h-12 rounded-2xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 font-black text-xs text-neutral-700 dark:text-neutral-200 transition-all active:scale-95 border-0 outline-none flex items-center justify-center"
            >
              ⌫
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
