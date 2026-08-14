import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  Smartphone,
  Phone,
  RotateCcw,
  AlertTriangle,
  Copy,
  Check,
  Banknote,
  Send,
  HelpCircle,
} from 'lucide-react';

export interface UssdPaymentModalProps {
  isOpen: boolean;
  defaultPhone?: string;
  amount: number;
  recipientName?: string;
  initialOperator?: string;
  onSuccess: (txId: string, phone: string, operator: string) => void;
  onCancel: () => void;
  onFallbackToCash?: () => void;
}

export type MobileOperator = 'mpesa' | 'tigopesa' | 'airtel' | 'halopesa';

export const detectOperatorFromPhone = (phoneNumber: string): MobileOperator => {
  const cleaned = phoneNumber.replace(/[\s\-\+\(\)]/g, '');
  
  // Format standard 07X or 06X or 2557X or 2556X
  let prefix = cleaned;
  if (cleaned.startsWith('255')) {
    prefix = '0' + cleaned.slice(3);
  } else if (!cleaned.startsWith('0') && cleaned.length >= 2) {
    prefix = '0' + cleaned;
  }

  const p3 = prefix.slice(0, 3);
  const p4 = prefix.slice(0, 4);

  // Vodacom: 074, 075, 076, 0775
  if (['074', '075', '076'].includes(p3) || p4 === '0775') {
    return 'mpesa';
  }

  // Tigo / Yas: 071, 065, 067, 077
  if (['071', '065', '067', '077'].includes(p3)) {
    return 'tigopesa';
  }

  // Airtel: 078, 068, 069, 079
  if (['078', '068', '069', '079'].includes(p3)) {
    return 'airtel';
  }

  // Halotel: 062, 061
  if (['062', '061'].includes(p3)) {
    return 'halopesa';
  }

  return 'mpesa';
};

export const operatorDetails: Record<
  MobileOperator,
  {
    name: string;
    shortName: string;
    bgColor: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
    prefix: string;
    ussdCode: string;
    paybillNumber: string;
  }
> = {
  mpesa: {
    name: 'Vodacom M-Pesa',
    shortName: 'M-Pesa',
    bgColor: 'bg-[#E60000]',
    badgeBg: 'bg-red-600 dark:bg-red-700',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    prefix: 'MP',
    ussdCode: '*150*00#',
    paybillNumber: '894021',
  },
  tigopesa: {
    name: 'Tigo Pesa (Mixx by Yas)',
    shortName: 'Tigo Pesa',
    bgColor: 'bg-[#00377B]',
    badgeBg: 'bg-blue-700 dark:bg-blue-800',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500',
    prefix: 'TP',
    ussdCode: '*150*01#',
    paybillNumber: '894021',
  },
  airtel: {
    name: 'Airtel Money',
    shortName: 'Airtel Money',
    bgColor: 'bg-[#ED1C24]',
    badgeBg: 'bg-red-600 dark:bg-red-700',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    prefix: 'AM',
    ussdCode: '*150*60#',
    paybillNumber: '894021',
  },
  halopesa: {
    name: 'HaloPesa',
    shortName: 'HaloPesa',
    bgColor: 'bg-[#FF6600]',
    badgeBg: 'bg-orange-600 dark:bg-orange-700',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    prefix: 'HP',
    ussdCode: '*150*88#',
    paybillNumber: '894021',
  },
};

export const UssdPaymentModal: React.FC<UssdPaymentModalProps> = ({
  isOpen,
  defaultPhone = '',
  amount,
  recipientName = 'PAPO HAPO RIDES TZ',
  initialOperator = 'mpesa',
  onSuccess,
  onCancel,
  onFallbackToCash,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone || '0754 123 456');
  const [operator, setOperator] = useState<MobileOperator>('mpesa');
  const [manualOverride, setManualOverride] = useState(false);
  
  // Stages: 'input_phone' -> 'ussd_push_active' -> 'success' | 'error_insufficient'
  const [stage, setStage] = useState<'input_phone' | 'ussd_push_active' | 'success' | 'error_insufficient'>('ussd_push_active');
  
  // UI Mode: 'keypad' or 'native_dialog'
  const [viewMode, setViewMode] = useState<'keypad' | 'native_dialog'>('keypad');
  
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txId, setTxId] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [copiedTx, setCopiedTx] = useState(false);
  
  // 60-Second Countdown Timer
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Security and error attempts
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Sync default phone or detect operator on open
  useEffect(() => {
    if (isOpen) {
      const initialNum = defaultPhone && defaultPhone.length >= 9 ? defaultPhone : '0754 123 456';
      setPhoneNumber(initialNum);
      const detected = detectOperatorFromPhone(initialNum);
      setOperator(initialOperator ? (initialOperator as MobileOperator) : detected);
      setManualOverride(false);
      setPin('');
      setIsProcessing(false);
      setStage('ussd_push_active');
      setTimeLeft(60);
      setAttemptsRemaining(3);
      setErrorMessage(null);
      setCopiedTx(false);
    }
  }, [isOpen, defaultPhone, initialOperator]);

  // Handle phone change & auto-detect operator
  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    if (!manualOverride) {
      const detected = detectOperatorFromPhone(val);
      setOperator(detected);
    }
  };

  // 60s Countdown Effect during USSD push stage
  useEffect(() => {
    if (isOpen && stage === 'ussd_push_active' && !isProcessing) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, stage, isProcessing]);

  const handleResendPrompt = () => {
    setTimeLeft(60);
    setPin('');
    setErrorMessage(null);
    setStage('ussd_push_active');
  };

  const handleKeyClick = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      setErrorMessage(null);
      if (newPin.length === 4) {
        handleSubmit(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const triggerErrorShake = (msg: string) => {
    setErrorMessage(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = (enteredPin = pin) => {
    if (enteredPin.length < 4) return;
    setIsProcessing(true);
    setErrorMessage(null);

    // Simulation logic: PIN "0000" triggers wrong PIN demonstration
    if (enteredPin === '0000') {
      setTimeout(() => {
        setIsProcessing(false);
        const newAttempts = attemptsRemaining - 1;
        setAttemptsRemaining(newAttempts);
        if (newAttempts <= 0) {
          triggerErrorShake('⚠️ Umezidi kiwango cha makosa! Akaunti imefungwa kwa muda wa dakika 15.');
        } else {
          triggerErrorShake(`⚠️ Namba ya siri (PIN) siyo sahihi! Zimebaki nafasi ${newAttempts}.`);
        }
      }, 1200);
      return;
    }

    // Success flow
    setTimeout(() => {
      const op = operatorDetails[operator];
      const now = new Date();
      const randomCode = `${op.prefix}${Math.floor(100000 + Math.random() * 900000)}.${now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '')}`;
      const formattedDate = now.toLocaleDateString('sw-TZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const formattedTime = now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });
      
      const generatedSms = `${randomCode} Imethibitishwa. TZS ${amount.toLocaleString()} imelipwa kwa ${recipientName} (Akaunti: ${op.paybillNumber}) tarehe ${formattedDate} saa ${formattedTime}. Salio lako la ${op.shortName} ni salama.`;

      setTxId(randomCode);
      setSmsMessage(generatedSms);
      setIsProcessing(false);
      setStage('success');

      setTimeout(() => {
        onSuccess(randomCode, phoneNumber, operator);
      }, 2400);
    }, 1800);
  };

  const handleSimulateInsufficientFunds = () => {
    setStage('error_insufficient');
  };

  const handleCopyTransaction = () => {
    if (txId) {
      navigator.clipboard.writeText(txId);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  if (!isOpen) return null;

  const currentOp = operatorDetails[operator] || operatorDetails.mpesa;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          className={`w-full max-w-sm bg-[#121218] text-neutral-100 rounded-[32px] border border-neutral-800 shadow-2xl overflow-hidden my-auto ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {/* Header styled like a mobile network USSD Push Prompt */}
          <div className={`${currentOp.bgColor} p-4 text-white flex items-center justify-between transition-colors duration-300`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider leading-tight">{currentOp.name}</h4>
                  <span className="text-[8px] bg-black/30 px-1.5 py-0.2 rounded font-mono font-bold">
                    {currentOp.ussdCode}
                  </span>
                </div>
                <p className="text-[9.5px] opacity-90 font-medium">USSD Push & Mobile Money Gateway</p>
              </div>
            </div>
            {!isProcessing && stage !== 'success' && (
              <button
                type="button"
                onClick={onCancel}
                className="w-7 h-7 rounded-full bg-black/25 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5">
            {/* STAGE 1: SUCCESS NOTIFICATION & REALISTIC SMS PREVIEW */}
            {stage === 'success' ? (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-2 space-y-4 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>

                <div>
                  <h4 className="text-lg font-black text-emerald-400 uppercase tracking-tight">Malipo Yamekamilika!</h4>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    TZS <span className="font-mono font-black text-white">{amount.toLocaleString()}</span> zimelipwa kwa mafanikio.
                  </p>
                </div>

                {/* Simulated Telco SMS Notification Card */}
                <div className="bg-neutral-900/90 border border-neutral-800 p-3.5 rounded-2xl text-left space-y-2 relative">
                  <div className="flex items-center justify-between text-[9.5px] text-neutral-400 pb-1 border-b border-neutral-800">
                    <span className="font-bold flex items-center gap-1 text-emerald-400">
                      💬 Ujumbe wa SMS ({currentOp.shortName})
                    </span>
                    <span className="font-mono">Sasa Hivi</span>
                  </div>

                  <p className="text-[11px] font-mono text-neutral-300 leading-relaxed break-words select-all">
                    {smsMessage}
                  </p>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[9px] text-neutral-500 font-mono">
                      Ref: <strong className="text-white">{txId}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyTransaction}
                      className="text-[9.5px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 px-2 py-1 rounded-lg border border-indigo-900/60 cursor-pointer"
                    >
                      {copiedTx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedTx ? 'Imenakiliwa!' : 'Nakili Namba'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-neutral-500 font-medium">
                  Inakamilisha safari yako kiotomatiki...
                </p>
              </motion.div>
            ) : stage === 'error_insufficient' ? (
              /* STAGE 2: INSUFFICIENT FUNDS FALLBACK */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-2 space-y-4 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mx-auto text-amber-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="text-base font-black text-amber-400 uppercase">Salio Halitoshi</h4>
                  <p className="text-xs text-neutral-300 mt-1 leading-normal">
                    Akaunti yako ya <strong className="text-white">{currentOp.name}</strong> ({phoneNumber}) haina salio la kutosha kulipa{' '}
                    <strong className="text-emerald-400 font-mono">TZS {amount.toLocaleString()}</strong>.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  {onFallbackToCash && (
                    <button
                      type="button"
                      onClick={onFallbackToCash}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Lipa kwa Pesa Taslimu (Cash)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setStage('ussd_push_active');
                      setTimeLeft(60);
                    }}
                    className="w-full h-11 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 rounded-2xl font-bold uppercase text-[11px] transition-all cursor-pointer"
                  >
                    Jaribu Tena kwa Namba Nyingine
                  </button>
                </div>
              </motion.div>
            ) : isProcessing ? (
              /* PROCESSING STATE */
              <div className="py-8 space-y-4 text-center">
                <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-200">
                    Inawasiliana na {currentOp.name}...
                  </p>
                  <p className="text-[10.5px] text-neutral-400 mt-1">Tafadhali subiri uthibitisho wa muamala kutoka mtandao</p>
                </div>
              </div>
            ) : (
              /* STAGE 3: ACTIVE USSD PROMPT WITH COUNTDOWN, NUMBER INPUT & KEYPAD */
              <div className="space-y-3.5">
                {/* Operator Selector & Auto-Detection Indicator */}
                <div>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">
                    <span>Mtandao wa Simu:</span>
                    <span className={`${currentOp.textColor} font-bold`}>
                      {manualOverride ? 'Umechagua mwenyewe' : 'Imetambuliwa Kiotomatiki'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.keys(operatorDetails) as MobileOperator[]).map((opKey) => {
                      const op = operatorDetails[opKey];
                      const isSelected = operator === opKey;
                      return (
                        <button
                          key={opKey}
                          type="button"
                          onClick={() => {
                            setOperator(opKey);
                            setManualOverride(true);
                          }}
                          className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? `${op.badgeBg} text-white border-white/40 shadow-xs ring-1 ring-white/30`
                              : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                          }`}
                        >
                          <span className="text-[9px] font-black uppercase block truncate">{op.shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Phone Number Input with 🇹🇿 Auto-detect */}
                <div className="bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-2xl">
                  <label className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Namba ya Simu ya Kulipia:</span>
                    <span className="text-emerald-400 font-bold">🇹🇿 Tanzania (+255)</span>
                  </label>
                  <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
                    <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="0754 123 456"
                      className="bg-transparent border-none outline-none text-xs font-mono font-bold text-white w-full placeholder-neutral-600"
                    />
                  </div>
                </div>

                {/* 60s Countdown Timer Bar */}
                <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400 font-bold">Muda wa Idhini ya USSD:</span>
                    <span className={`font-mono font-black ${timeLeft <= 15 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                      00:{timeLeft.toString().padStart(2, '0')}s
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${timeLeft <= 15 ? 'bg-red-500' : 'bg-emerald-500'}`}
                      initial={{ width: '100%' }}
                      animate={{ width: `${(timeLeft / 60) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {timeLeft === 0 ? (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[9.5px] text-red-400 font-bold">Muda umekwisha!</span>
                      <button
                        type="button"
                        onClick={handleResendPrompt}
                        className="text-[9.5px] font-black text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Tuma Tena (Resend)</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[8.5px] text-neutral-400 italic">
                      Tafadhali kamilisha muamala kwenye simu yako ndani ya sekunde {timeLeft}
                    </p>
                  )}
                </div>

                {/* Switcher between Native Telco Dialog and Interactive Keypad */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[9px] font-black uppercase text-neutral-400">Mtindo wa USSD:</span>
                  <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-xl border border-neutral-800 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode('keypad')}
                      className={`px-2 py-0.5 rounded-lg transition-all ${
                        viewMode === 'keypad' ? 'bg-indigo-600 text-white' : 'text-neutral-400'
                      }`}
                    >
                      Keypad
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('native_dialog')}
                      className={`px-2 py-0.5 rounded-lg transition-all ${
                        viewMode === 'native_dialog' ? 'bg-indigo-600 text-white' : 'text-neutral-400'
                      }`}
                    >
                      Kijisanduku cha Simu
                    </button>
                  </div>
                </div>

                {/* Error Message if wrong PIN */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-[10px] font-bold text-center"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                {/* MODE A: NATIVE TELCO DIALOG BOX (Authentic Pop-up) */}
                {viewMode === 'native_dialog' ? (
                  <div className="bg-[#1c1c24] border border-neutral-700 p-4 rounded-2xl text-left space-y-3 shadow-inner">
                    <div className="space-y-1 text-neutral-200">
                      <p className="text-xs font-mono font-bold leading-relaxed">
                        {currentOp.name.toUpperCase()} PUSH:
                      </p>
                      <p className="text-[11px] font-mono leading-relaxed text-neutral-300">
                        Lipa TZS {amount.toLocaleString()} kwenda {recipientName} (Akaunti {currentOp.paybillNumber}).
                      </p>
                      <p className="text-[11px] font-mono text-amber-300 font-semibold pt-1">
                        Weka PIN yako ya tarakimu 4:
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPin(val);
                          if (val.length === 4) handleSubmit(val);
                        }}
                        placeholder="••••"
                        className="w-full bg-neutral-900 border-2 border-indigo-500 rounded-xl py-2 px-3 text-center text-lg font-mono tracking-widest text-white outline-none focus:ring-2 focus:ring-indigo-400"
                        autoFocus
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-400 hover:text-white"
                      >
                        Ghairi
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit(pin)}
                        disabled={pin.length < 4}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black uppercase flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Tuma</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MODE B: INTERACTIVE PIN KEYPAD */
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-300 mb-1.5 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        Weka PIN ya siri ya tarakimu 4:
                      </p>

                      {/* PIN Dots Display */}
                      <div className="flex justify-center gap-2.5 my-1">
                        {[0, 1, 2, 3].map((index) => (
                          <div
                            key={index}
                            className={`w-9 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-black transition-all ${
                              pin.length > index
                                ? 'border-indigo-500 bg-indigo-500/20 text-white shadow-sm scale-105'
                                : 'border-neutral-800 bg-neutral-900 text-neutral-600'
                            }`}
                          >
                            {pin.length > index ? '●' : ''}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleKeyClick(digit)}
                          className="h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-base font-bold text-neutral-200 transition-all font-mono cursor-pointer"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={onCancel}
                        className="h-9 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:bg-neutral-800 text-[9.5px] font-bold text-neutral-400 cursor-pointer"
                      >
                        GHAIRI
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeyClick('0')}
                        className="h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-base font-bold text-neutral-200 transition-all font-mono cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={handleBackspace}
                        className="h-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 text-sm font-bold text-neutral-400 cursor-pointer"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                )}

                {/* Simulation Utility Controls & Test Options */}
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[9px] text-neutral-400">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span>Usimbaji Salama (Bank Grade)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateInsufficientFunds}
                    className="text-amber-400/80 hover:text-amber-300 underline font-semibold cursor-pointer"
                    title="Bonyeza kujaribu hali ya salio kutotosha"
                  >
                    Jaribu: Salio Halitoshi?
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
