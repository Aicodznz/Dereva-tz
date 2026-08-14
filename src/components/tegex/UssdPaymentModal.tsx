import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, X, Lock, Smartphone } from 'lucide-react';

interface UssdPaymentModalProps {
  isOpen: boolean;
  operator: 'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | string;
  amount: number;
  recipientName?: string;
  onSuccess: (txId: string) => void;
  onCancel: () => void;
}

export const UssdPaymentModal: React.FC<UssdPaymentModalProps> = ({
  isOpen,
  operator,
  amount,
  recipientName = 'PAPO HAPO RIDES TZ',
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState('');

  // Operator configs
  const operatorConfig = {
    mpesa: {
      name: 'Vodacom M-Pesa',
      bgColor: 'bg-[#E60000]',
      badgeColor: 'bg-red-600',
      accentColor: 'text-red-600',
      prefix: 'MP',
      ussdCode: '*150*00#',
    },
    tigopesa: {
      name: 'Tigo Pesa (Mixx by Yas)',
      bgColor: 'bg-[#00377B]',
      badgeColor: 'bg-blue-700',
      accentColor: 'text-blue-600',
      prefix: 'TP',
      ussdCode: '*150*01#',
    },
    airtel: {
      name: 'Airtel Money',
      bgColor: 'bg-[#ED1C24]',
      badgeColor: 'bg-red-700',
      accentColor: 'text-red-500',
      prefix: 'AM',
      ussdCode: '*150*60#',
    },
    halopesa: {
      name: 'HaloPesa',
      bgColor: 'bg-[#FF6600]',
      badgeColor: 'bg-orange-600',
      accentColor: 'text-orange-500',
      prefix: 'HP',
      ussdCode: '*150*88#',
    },
  }[operator] || {
    name: 'Lipa kwa Simu',
    bgColor: 'bg-indigo-600',
    badgeColor: 'bg-indigo-600',
    accentColor: 'text-indigo-600',
    prefix: 'TZ',
    ussdCode: '*150*00#',
  };

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsProcessing(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  const handleKeyClick = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto trigger submit after 4 digits
        handleSubmit(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = (enteredPin = pin) => {
    if (enteredPin.length < 4) return;
    setIsProcessing(true);

    setTimeout(() => {
      const randomTx = `${operatorConfig.prefix}${Math.floor(100000 + Math.random() * 900000)}.${new Date().toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '')}`;
      setTxId(randomTx);
      setIsProcessing(false);
      setIsSuccess(true);

      setTimeout(() => {
        onSuccess(randomTx);
      }, 1400);
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-xs bg-[#121217] text-neutral-100 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden"
        >
          {/* Header styled like a mobile network USSD Push Prompt */}
          <div className={`${operatorConfig.bgColor} p-4 text-white flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 animate-pulse" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider leading-tight">{operatorConfig.name}</h4>
                <p className="text-[9px] opacity-90 font-medium">USSD Push • Malipo ya Papo Hapo</p>
              </div>
            </div>
            {!isProcessing && !isSuccess && (
              <button
                type="button"
                onClick={onCancel}
                className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-5 text-center">
            {isSuccess ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-4 space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-9 h-9 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-base font-black text-emerald-400 uppercase">Malipo Yamekamilika!</h4>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    TZS {amount.toLocaleString()} zimelipwa kwa mafanikio.
                  </p>
                  <p className="text-[10px] font-mono text-neutral-500 mt-2 bg-neutral-900/90 py-1 px-2 rounded-lg inline-block border border-neutral-800">
                    Kumbukumbu: <span className="text-emerald-400 font-bold">{txId}</span>
                  </p>
                </div>
              </motion.div>
            ) : isProcessing ? (
              <div className="py-8 space-y-4">
                <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-200">
                    Inawasiliana na Mtandao...
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1">Tafadhali subiri uthibitisho wa salio lako</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Transaction details message */}
                <div className="bg-neutral-900/90 border border-neutral-800 p-3 rounded-2xl text-left">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 mb-1">
                    <span>Mpokeaji:</span>
                    <span className="font-bold text-neutral-200">{recipientName}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-neutral-400">
                    <span>Kiasi cha Kulipa:</span>
                    <span className="font-black text-sm text-emerald-400 font-mono">
                      TZS {amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10.5px] font-bold text-neutral-300 mb-2 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Weka PIN ya siri ya tarakimu 4:
                  </p>

                  {/* PIN Dots Display */}
                  <div className="flex justify-center gap-3 my-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`w-10 h-11 rounded-xl border-2 flex items-center justify-center text-lg font-black transition-all ${
                          pin.length > index
                            ? 'border-indigo-500 bg-indigo-500/20 text-white shadow-sm'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-600'
                        }`}
                      >
                        {pin.length > index ? '●' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulated USSD Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeyClick(digit)}
                      className="h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-base font-bold text-neutral-200 transition-all font-mono"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={onCancel}
                    className="h-10 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400"
                  >
                    GHAIRI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyClick('0')}
                    className="h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-base font-bold text-neutral-200 transition-all font-mono"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-sm font-bold text-neutral-400"
                  >
                    ⌫
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1 text-[8.5px] text-neutral-500">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>Mfumo uliosimbwa kwa njia salama (Bank Grade Encryption)</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
