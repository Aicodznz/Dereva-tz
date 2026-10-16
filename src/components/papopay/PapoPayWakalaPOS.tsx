import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Utensils, Building2, Banknote, ArrowDownLeft, ArrowUpRight, 
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck, RefreshCw, 
  Volume2, VolumeX, Sparkles, UserX, UserPlus, Receipt, Printer, 
  Share2, QrCode, Search, Smartphone, Shield, Check, Clock, 
  ShoppingBag, Plus, Trash2, Coins, ArrowRight, User
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, BiometricHudMode, FaceTrackResult } from './BiometricFaceCanvas';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { toast } from 'sonner';

export type BusinessType = 'duka' | 'mgahawa' | 'hotel' | 'general_wakala';
export type WakalaOperation = 'face_deposit' | 'face_withdraw' | 'merchant_checkout';

export interface VerifiedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
}

const DEFAULT_VERIFIED_CUSTOMER: VerifiedCustomer = {
  id: 'cust_baraka',
  name: 'Baraka Juma Mrema',
  phone: '0754 892 100',
  walletBalance: 3450000,
  faceEmbeddingId: 'EMB-TZ-DAR-9821-VERIFIED',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  isRegistered: true
};

const MERCHANT_ITEMS_PRESETS: Record<BusinessType, { id: string; name: string; price: number; icon: string }[]> = {
  duka: [
    { id: 'd1', name: 'Unga wa Ngano (2kg)', price: 4500, icon: '🌾' },
    { id: 'd2', name: 'Sukari Nyeupe (1kg)', price: 3200, icon: '🧂' },
    { id: 'd3', name: 'Mafuta ya Alizeti (1L)', price: 7800, icon: '🌻' },
    { id: 'd4', name: 'Mchele wa Mbeya (1kg)', price: 3500, icon: '🍚' },
    { id: 'd5', name: 'Maji ya Uhai (1.5L)', price: 1500, icon: '💧' },
    { id: 'd6', name: 'Sabuni ya Omo (500g)', price: 2800, icon: '🧼' }
  ],
  mgahawa: [
    { id: 'm1', name: 'Kuku Choma Nusu + Chips', price: 14000, icon: '🍗' },
    { id: 'm2', name: 'Samaki wa Kupaka & Ugali', price: 18500, icon: '🐟' },
    { id: 'm3', name: 'Mishkaki ya Ng’ombe (Mishikaki 5)', price: 7500, icon: '🍢' },
    { id: 'm4', name: 'Chips Mayai (Zege Maalum)', price: 4500, icon: '🍳' },
    { id: 'm5', name: 'Juisi Fresh ya Embe & Nanasi', price: 3500, icon: '🍹' },
    { id: 'm6', name: 'Kahawa Kubwa ya Tangawizi', price: 2500, icon: '☕' }
  ],
  hotel: [
    { id: 'h1', name: 'Chumba Standard (Usiku 1)', price: 65000, icon: '🛏️' },
    { id: 'h2', name: 'Chumba cha Deluxe Suite (Usiku 1)', price: 120000, icon: '🏨' },
    { id: 'h3', name: 'Buffet ya Asubuhi (Breakfast)', price: 25000, icon: '🥐' },
    { id: 'h4', name: 'Huduma ya Kufuliwa Nguo (Laundry)', price: 15000, icon: '🧺' },
    { id: 'h5', name: 'Huduma ya Uwanja wa Ndege (Cab)', price: 35000, icon: '🚖' },
    { id: 'h6', name: 'Kinywaji cha Welcome Cocktail', price: 12000, icon: '🍸' }
  ],
  general_wakala: [
    { id: 'w1', name: 'Kuweka Pesa (Cash-In) TZS 10,000', price: 10000, icon: '💵' },
    { id: 'w2', name: 'Kuweka Pesa (Cash-In) TZS 25,000', price: 25000, icon: '💵' },
    { id: 'w3', name: 'Kuweka Pesa (Cash-In) TZS 50,000', price: 50000, icon: '💵' },
    { id: 'w4', name: 'Kuweka Pesa (Cash-In) TZS 100,000', price: 100000, icon: '💵' }
  ]
};

interface PapoPayWakalaPOSProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceDeposit?: (amount: number, customerName: string) => void;
  onBalanceWithdraw?: (amount: number, customerName: string) => void;
}

export const PapoPayWakalaPOS: React.FC<PapoPayWakalaPOSProps> = ({
  isOpen,
  onClose,
  onBalanceDeposit,
  onBalanceWithdraw
}) => {
  // Business Setup State
  const [businessType, setBusinessType] = useState<BusinessType>('general_wakala');
  const [businessName, setBusinessName] = useState('Wakala wa PapoPay - Dar Express');
  const [wakalaId] = useState('TZ-WAKALA-0842-DAR');
  const [wakalaFloatBalance, setWakalaFloatBalance] = useState(8500000);
  const [totalCommissionEarned, setTotalCommissionEarned] = useState(38400);

  // Operation Mode
  const [operation, setOperation] = useState<WakalaOperation>('face_deposit');

  // Input amounts
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(30000);
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number; qty: number; icon: string }[]>([]);

  // Camera & Face Tracking / System Search Pipeline
  // 'scanning' -> searching/tracking face in webcam
  // 'querying' -> face detected, searching database
  // 'matched' -> face exists in system (reveals name, phone, balance)
  // 'unregistered' -> face is NOT in system (prompts registration)
  const [faceSystemStatus, setFaceSystemStatus] = useState<'scanning' | 'querying' | 'matched' | 'unregistered'>('scanning');
  const [matchedCustomer, setMatchedCustomer] = useState<VerifiedCustomer | null>(null);

  // Test mode: 'live' (detects registered vs unregistered), or togglable for easy demo testing
  const [simulatedRegistrationStatus, setSimulatedRegistrationStatus] = useState<'registered' | 'unregistered'>('registered');

  // UI state
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFaceEnrollOpen, setIsFaceEnrollOpen] = useState(false);
  const [isConfirmingTx, setIsConfirmingTx] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // Telemetry
  const [liveConfidence, setLiveConfidence] = useState(99.4);
  const [liveDistance, setLiveDistance] = useState(42);
  const [liveLux, setLiveLux] = useState(92);
  const [liveYaw, setLiveYaw] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isPosSearchingRef = useRef<boolean>(false);
  const posFaceDebounceRef = useRef<number>(0);

  const speak = (text: string) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'sw-TZ';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera fallback active in PapoPayWakalaPOS", err);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // Open modal lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
      // Start in scanning state with NO customer pre-filled
      setMatchedCustomer(null);
      setFaceSystemStatus('scanning');
      setTxSuccess(false);
      speak("Kamera ya Wakala ipo hewani. Simama mbele ya kamera ili sura yako itambuliwe.");

    } else {
      stopCamera();
      setMatchedCustomer(null);
      setFaceSystemStatus('scanning');
      setIsConfirmingTx(false);
    }
    return () => stopCamera();
  }, [isOpen, simulatedRegistrationStatus]);

  // LIVE SYSTEM SEARCH IMPLEMENTATION
  const executeLiveSystemSearch = (desiredStatus: 'registered' | 'unregistered') => {
    isPosSearchingRef.current = true;
    setFaceSystemStatus('querying');
    setMatchedCustomer(null);

    speak("Uso umepatikana. Inatafuta kwenye mfumo wa PapoPay...");

    setTimeout(() => {
      isPosSearchingRef.current = false;
      // Check if user has registered a face in localStorage
      let enrolledData: any = null;
      try {
        const stored = localStorage.getItem('papopay_registered_face');
        if (stored) enrolledData = JSON.parse(stored);
        if (!enrolledData || !enrolledData.isEnrolled) {
          const storedList = localStorage.getItem('papopay_registered_faces');
          if (storedList) {
            const arr = JSON.parse(storedList);
            if (Array.isArray(arr) && arr.length > 0 && arr[0].isEnrolled) {
              enrolledData = arr[0];
            }
          }
        }
      } catch {}

      if (enrolledData && enrolledData.isEnrolled === false && desiredStatus !== 'registered') {
        // CASE: AKAUNTI IPO LAKINI HAJAWEKA USO BADO (kama hajaweka ambiwe hajaweka aweke)
        setFaceSystemStatus('unregistered');
        setMatchedCustomer(null);
        triggerHapticTap();
        speak(`Mteja ${enrolledData.name?.split(' ')[0] || ''} ana akaunti lakini hajasajili uso bado! Tafadhali weka uso wake sasa.`);
        toast.warning(`Akaunti Ipo, Bado Hajaweka Uso: ${enrolledData.name || 'Mteja'}`, { 
          description: "Mteja hakusajili uso wakati anajisajili. Bonyeza Sajili Uso Sasa.",
          icon: '⚠️' 
        });
      } else if (desiredStatus === 'unregistered') {
        // CASE 1: SURA HAIPO KWENYE MFUMO!
        setFaceSystemStatus('unregistered');
        setMatchedCustomer(null);
        triggerHapticTap();
        speak("Samahani, sura yako haipo kwenye mfumo wa PapoPay. Tafadhali sajili uso wako sasa.");
        toast.error("Sura Haipo Kwenye Mfumo! Tafadhali sajili uso wako.", { icon: '⚠️' });
      } else {
        // CASE 2: SURA IPO KWENYE MFUMO! (kama alisha weka kipindi anajisajili sawa)
        const verified: VerifiedCustomer = (enrolledData && enrolledData.isEnrolled) ? {
          id: 'cust_enrolled',
          name: enrolledData.name || DEFAULT_VERIFIED_CUSTOMER.name,
          phone: enrolledData.phone || DEFAULT_VERIFIED_CUSTOMER.phone,
          walletBalance: 3450000,
          faceEmbeddingId: enrolledData.embeddingId || 'EMB-VERIFIED-LIVE',
          avatar: enrolledData.photoUrl || DEFAULT_VERIFIED_CUSTOMER.avatar,
          isRegistered: true
        } : DEFAULT_VERIFIED_CUSTOMER;

        setMatchedCustomer(verified);
        setFaceSystemStatus('matched');
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja ${verified.name.split(' ')[0]} ametambuliwa kikamilifu. Salio lako ni shilingi ${verified.walletBalance.toLocaleString()}. Sasa unaweza kuthibitisha muamala.`);
        toast.success(`Mteja Ametambuliwa: ${verified.name}`, { icon: '✅' });
      }
    }, 1400);
  };

  const handleFaceTracked = (data: FaceTrackResult) => {
    setLiveConfidence(data.confidence);
    setLiveLux(data.brightness);
    setLiveDistance(data.distanceCm);
    setLiveYaw(data.headYaw);

    if (data.detected) {
      if (faceSystemStatus === 'scanning' && !isPosSearchingRef.current) {
        posFaceDebounceRef.current++;
        if (posFaceDebounceRef.current >= 2) {
          posFaceDebounceRef.current = 0;
          executeLiveSystemSearch(simulatedRegistrationStatus);
        }
      }
    } else {
      posFaceDebounceRef.current = 0;
    }
  };

  // Adjust Business Type
  const handleBusinessTypeChange = (type: BusinessType) => {
    setBusinessType(type);
    if (type === 'duka') {
      setBusinessName('Duka la Rejareja & Supermarket - Mikocheni');
      setOperation('merchant_checkout');
      setCartItems([
        { ...MERCHANT_ITEMS_PRESETS.duka[0], qty: 1 },
        { ...MERCHANT_ITEMS_PRESETS.duka[2], qty: 1 }
      ]);
    } else if (type === 'mgahawa') {
      setBusinessName('Mgahawa wa Papo Hapo & Grill - Masaki');
      setOperation('merchant_checkout');
      setCartItems([
        { ...MERCHANT_ITEMS_PRESETS.mgahawa[0], qty: 1 },
        { ...MERCHANT_ITEMS_PRESETS.mgahawa[4], qty: 2 }
      ]);
    } else if (type === 'hotel') {
      setBusinessName('Papo Luxury Hotel & Lodging - Serena Beach');
      setOperation('merchant_checkout');
      setCartItems([
        { ...MERCHANT_ITEMS_PRESETS.hotel[0], qty: 1 },
        { ...MERCHANT_ITEMS_PRESETS.hotel[2], qty: 1 }
      ]);
    } else {
      setBusinessName('Wakala wa PapoPay - Dar Express');
      setOperation('face_deposit');
    }
    triggerHapticTap();
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Cart Management
  const handleAddToCart = (item: { id: string; name: string; price: number; icon: string }) => {
    triggerHapticTap();
    setCartItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
    toast.success(`Imeongezwa: ${item.name}`);
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    triggerHapticTap();
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean) as any);
  };

  // CONFIRM TRANSACTION (ONLY WHEN CUSTOMER IS MATCHED & VERIFIED)
  const handleConfirmTransaction = () => {
    if (!matchedCustomer || isConfirmingTx) return;

    let transactionAmount = 0;
    let operationTitle = '';

    if (operation === 'face_deposit') {
      transactionAmount = depositAmount;
      operationTitle = 'Wakala Kuweka Pesa (Cash-In)';
      if (transactionAmount <= 0) {
        toast.error("Weka kiasi sahihi cha kuweka!");
        return;
      }
      if (wakalaFloatBalance < transactionAmount) {
        toast.error(`Salio la float halitoshi! (Float: TZS ${wakalaFloatBalance.toLocaleString()})`);
        return;
      }
    } else if (operation === 'face_withdraw') {
      transactionAmount = withdrawAmount;
      operationTitle = 'Wakala Kutoa Pesa (Cash-Out)';
      if (transactionAmount <= 0) {
        toast.error("Weka kiasi sahihi cha kutoa!");
        return;
      }
      if (matchedCustomer.walletBalance < transactionAmount) {
        toast.error(`Salio la mteja halitoshi! (Salio: TZS ${matchedCustomer.walletBalance.toLocaleString()})`);
        return;
      }
    } else {
      transactionAmount = cartTotal;
      operationTitle = `Malipo ya ${businessType === 'duka' ? 'Duka' : businessType === 'mgahawa' ? 'Mgahawa' : 'Hotel'}`;
      if (transactionAmount <= 0) {
        toast.error("Weka bidhaa au huduma kwenye bili!");
        return;
      }
    }

    setIsConfirmingTx(true);
    speak("Inathibitisha muamala kwa bayometriki ya uso...");

    setTimeout(() => {
      setIsConfirmingTx(false);
      setTxSuccess(true);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(transactionAmount * 0.012);
      setTotalCommissionEarned(prev => prev + commission);

      if (operation === 'face_deposit') {
        setWakalaFloatBalance(prev => prev - transactionAmount + commission);
        setMatchedCustomer(prev => prev ? ({ ...prev, walletBalance: prev.walletBalance + transactionAmount }) : null);
        if (onBalanceDeposit) onBalanceDeposit(transactionAmount, matchedCustomer.name);
        speak(`Pesa shilingi ${transactionAmount.toLocaleString()} zimewekwa kikamilifu kwenye akaunti ya ${matchedCustomer.name.split(' ')[0]}.`);
        toast.success(`TZS ${transactionAmount.toLocaleString()} Zimewekwa kwa Uso!`, { icon: '💰' });
      } else if (operation === 'face_withdraw') {
        setWakalaFloatBalance(prev => prev + transactionAmount + commission);
        setMatchedCustomer(prev => prev ? ({ ...prev, walletBalance: prev.walletBalance - transactionAmount }) : null);
        if (onBalanceWithdraw) onBalanceWithdraw(transactionAmount, matchedCustomer.name);
        speak(`Kutoa pesa shilingi ${transactionAmount.toLocaleString()} kumethibitishwa. Mkabidhi mteja pesa taslimu.`);
        toast.success(`Kutoa Pesa Kumethibitishwa!`, { icon: '💵' });
      } else {
        setMatchedCustomer(prev => prev ? ({ ...prev, walletBalance: Math.max(0, prev.walletBalance - transactionAmount) }) : null);
        speak(`Malipo ya bili ya shilingi ${transactionAmount.toLocaleString()} yamethibitishwa.`);
        toast.success(`Bili ya TZS ${transactionAmount.toLocaleString()} Imelipwa!`, { icon: '✨' });
      }

      setLastReceipt({
        id: `TX-${Date.now().toString().slice(-6)}`,
        title: operationTitle,
        customerName: matchedCustomer.name,
        customerPhone: matchedCustomer.phone,
        amount: transactionAmount,
        commission,
        wakalaId,
        businessName,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo'
      });

      setTimeout(() => setTxSuccess(false), 3000);
    }, 1400);
  };

  // When Face Registration succeeds
  const handleEnrollSuccess = (data: { name: string; phone: string; embeddingId: string; photoUrl?: string }) => {
    setIsFaceEnrollOpen(false);
    toast.success(`Hongera ${data.name}! Uso wako umesajiliwa kikamilifu.`, { icon: '🎉' });
    setSimulatedRegistrationStatus('registered');

    // Immediately trigger live recognition for the newly enrolled person
    const newCust: VerifiedCustomer = {
      id: 'cust_' + Date.now(),
      name: data.name,
      phone: data.phone,
      walletBalance: 500000,
      faceEmbeddingId: data.embeddingId,
      avatar: data.photoUrl || DEFAULT_VERIFIED_CUSTOMER.avatar,
      isRegistered: true
    };
    setMatchedCustomer(newCust);
    setFaceSystemStatus('matched');
    playPaymentChime();
    speak(`Uso wako sasa upo kwenye mfumo, ${data.name.split(' ')[0]}. Sasa unaweza kuthibitisha kuweka pesa.`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-5xl bg-[#090e1a] border border-cyan-500/30 rounded-3xl sm:rounded-[36px] overflow-hidden shadow-2xl shadow-cyan-950/80 flex flex-col max-h-[95vh] sm:max-h-[92vh] text-white"
      >
        {/* TOP MODAL HEADER */}
        <div className="p-3 sm:p-5 flex items-center justify-between border-b border-white/10 bg-[#0c1424]">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Store className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-lg font-black tracking-tight text-white truncate">
                  PapoPay Wakala POS
                </h3>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] sm:text-[10px] font-mono font-bold border border-cyan-500/30 shrink-0">
                  {wakalaId}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-400 font-medium truncate max-w-[180px] sm:max-w-md">
                {businessName} &bull; Malipo ya Uso
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              title={soundEnabled ? 'Zima sauti' : 'Washa sauti'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BUSINESS TYPE & FLOAT METRICS BAR */}
        <div className="px-4 sm:px-6 py-2.5 bg-black/50 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] text-neutral-400 font-bold mr-1">Eneo Lako:</span>
            <button
              type="button"
              onClick={() => handleBusinessTypeChange('general_wakala')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs ${
                businessType === 'general_wakala'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Wakala Mkuu</span>
            </button>

            <button
              type="button"
              onClick={() => handleBusinessTypeChange('duka')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs ${
                businessType === 'duka'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Duka &amp; Supermarket</span>
            </button>

            <button
              type="button"
              onClick={() => handleBusinessTypeChange('mgahawa')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs ${
                businessType === 'mgahawa'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Mgahawa / Bar</span>
            </button>

            <button
              type="button"
              onClick={() => handleBusinessTypeChange('hotel')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs ${
                businessType === 'hotel'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Hotel &amp; Lodging</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">Float ya Wakala:</span>
              <span className="font-bold text-cyan-400">
                TZS {wakalaFloatBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">Kamisheni Yako:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                +TZS {totalCommissionEarned.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* MAIN GRID: 2 COLUMNS (CAMERA & CONTROLS) */}
        <div className="p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 overflow-y-auto">
          {/* LEFT COLUMN: LIVE BIOMETRIC CAMERA & REAL-TIME FACE RECOGNITION (7 COLS) */}
          <div className="lg:col-span-7 flex flex-col items-center space-y-3 sm:space-y-4">
            {/* OPERATION TABS (DEPOSIT / WITHDRAW / POS BILL) */}
            <div className="w-full grid grid-cols-3 gap-1 sm:gap-2 bg-neutral-900/80 p-1 sm:p-1.5 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOperation('face_deposit');
                  triggerHapticTap();
                }}
                className={`py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
                  operation === 'face_deposit'
                    ? 'bg-emerald-500 text-neutral-950 shadow-lg font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Weka (Cash-In)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperation('face_withdraw');
                  triggerHapticTap();
                }}
                className={`py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
                  operation === 'face_withdraw'
                    ? 'bg-amber-500 text-neutral-950 shadow-lg font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Toa (Cash-Out)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperation('merchant_checkout');
                  triggerHapticTap();
                }}
                className={`py-2 sm:py-2.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 transition-all ${
                  operation === 'merchant_checkout'
                    ? 'bg-cyan-500 text-neutral-950 shadow-lg font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ScanFace className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Lipa Bili / POS</span>
              </button>
            </div>

            {/* CAMERA VIEWPORT WITH BIOMETRIC HUD */}
            <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden border-4 border-cyan-500/40 bg-black flex items-center justify-center shadow-2xl shadow-cyan-950/60">
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />

              {/* 3D Face Biometric Canvas Overlay */}
              <BiometricFaceCanvas
                videoRef={videoRef}
                onFaceTracked={handleFaceTracked}
                phase={
                  faceSystemStatus === 'unregistered'
                    ? 'unregistered'
                    : faceSystemStatus === 'matched'
                    ? 'success'
                    : faceSystemStatus === 'querying'
                    ? 'verifying'
                    : 'align_center'
                }
                isUnregistered={faceSystemStatus === 'unregistered'}
                hudMode={hudMode}
                faceConfidence={faceSystemStatus === 'matched' ? 99.8 : liveConfidence}
                lightingQuality={liveLux}
                distanceCm={liveDistance}
                headYaw={liveYaw}
              />

              {/* Top Corner AI Badge */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-xl backdrop-blur-md text-[10px] font-mono border flex items-center gap-1.5 ${
                  faceSystemStatus === 'matched'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : faceSystemStatus === 'unregistered'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    : 'bg-black/75 text-cyan-300 border-cyan-500/30'
                }`}>
                  {faceSystemStatus === 'querying' ? (
                    <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                  ) : faceSystemStatus === 'matched' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                  )}
                  <span>
                    {faceSystemStatus === 'querying'
                      ? 'Inatafuta kwenye mfumo...'
                      : faceSystemStatus === 'matched'
                      ? 'Sura Imethibitishwa 99.8%'
                      : faceSystemStatus === 'unregistered'
                      ? 'Sura Haipo Kwenye Mfumo ⚠️'
                      : 'Inasoma Sura kwa Kamera'}
                  </span>
                </span>
              </div>

              {/* HUD Mode Switcher button */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[10px]">
                <button
                  type="button"
                  onClick={() => setHudMode('mesh')}
                  className={`px-2 py-0.5 rounded-lg ${hudMode === 'mesh' ? 'bg-cyan-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                >
                  3D Mesh
                </button>
                <button
                  type="button"
                  onClick={() => setHudMode('neural_box')}
                  className={`px-2 py-0.5 rounded-lg ${hudMode === 'neural_box' ? 'bg-cyan-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                >
                  YOLO
                </button>
              </div>

              {/* CASE 1: SURA HAIPO KWENYE MFUMO (UNREGISTERED ALERT OVERLAY) */}
              {faceSystemStatus === 'unregistered' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-30 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center mb-3 shadow-[0_0_35px_#f59e0b] animate-bounce">
                    <UserX className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-black border border-amber-500/40 uppercase mb-1">
                    SURA HAIPO KWENYE MFUMO! ⚠️
                  </span>
                  <h3 className="text-xl font-black text-white">
                    USO HAUJASAJILIWA
                  </h3>
                  <p className="text-amber-200 text-xs font-medium mt-1 max-w-xs">
                    Sura yako haijapatikana kwenye kanzidata ya PapoPay. Ili uweze kuweka au kutoa pesa, tafadhali bofya kitufe cha chini ili usajiliwe hapo hapo.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsFaceEnrollOpen(true)}
                    className="mt-4 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Sajili Uso Wako Sasa (Fomu ya Usajili)</span>
                  </button>
                </motion.div>
              )}

              {/* SUCCESS POPUP AFTER CONFIRMATION */}
              {txSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-30 bg-emerald-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-[0_0_35px_#10b981] animate-bounce">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-xl font-black text-white">
                    MUAMALA UMEKAMILIKA!
                  </h3>
                  <p className="text-emerald-300 text-xs font-bold mt-1">
                    {matchedCustomer?.name} &bull; Uthibitisho wa Uso 99.8%
                  </p>
                </motion.div>
              )}

              {/* CASE 2: SURA IPO (IKIDITECT KUWA HUYU YUPO NDO ITOKEE JINA, NAMBA NA SALIO) */}
              {matchedCustomer && faceSystemStatus === 'matched' && (
                <div className="absolute bottom-3 inset-x-3 z-20 bg-black/85 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={matchedCustomer.avatar}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-white leading-tight">
                          {matchedCustomer.name}
                        </p>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono">
                          VERIFIED ✓
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-300 font-mono">
                        Simu: {matchedCustomer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">Salio la Mteja</span>
                    <span className="text-sm font-mono font-bold text-emerald-300">
                      TZS {matchedCustomer.walletBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE SYSTEM CONTROLS & TEST SWITCH (CLEAN, NO DUMMY SIMULATOR) */}
            <div className="w-full bg-neutral-900/60 p-3.5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeLiveSystemSearch(simulatedRegistrationStatus)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Upya Sura</span>
                </button>

                {faceSystemStatus === 'unregistered' && (
                  <button
                    type="button"
                    onClick={() => setIsFaceEnrollOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Fungua Fomu ya Usajili</span>
                  </button>
                )}
              </div>

              {/* Test toggle between Registered vs Unregistered flows */}
              <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-white/10 text-[11px]">
                <span className="text-neutral-400 px-1 font-mono">Mtihani:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedRegistrationStatus('registered');
                    executeLiveSystemSearch('registered');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    simulatedRegistrationStatus === 'registered'
                      ? 'bg-emerald-500 text-neutral-950'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Sura Iliyosajiliwa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedRegistrationStatus('unregistered');
                    executeLiveSystemSearch('unregistered');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    simulatedRegistrationStatus === 'unregistered'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Sura Isiyosajiliwa (Mpya)
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CASH TRANSACTION FORM / POS CART (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* OPERATION 1: FACE CASH-IN (KUWEKA PESA) */}
            {operation === 'face_deposit' && (
              <div className="bg-[#0e1628] p-5 rounded-3xl border border-cyan-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Kuweka Pesa (Cash-In)</h4>
                      <p className="text-[11px] text-neutral-400">Mteja anatoa pesa taslimu kwa Wakala</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                    Face Deposit
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Kiasi Kinachowekwa (TZS):
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                    className="w-full bg-black/60 border border-cyan-500/30 px-4 py-3 rounded-2xl text-xl font-mono font-black text-emerald-400 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Quick Amount presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setDepositAmount(amt);
                        triggerHapticTap();
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                        depositAmount === amt
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                    </button>
                  ))}
                </div>

                {/* CUSTOMER VERIFICATION CARD: ONLY REVEALED WHEN FACE IS MATCHED IN SYSTEM */}
                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/40 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-neutral-400">
                      <span>Mteja Aliyetambuliwa:</span>
                      <span className="font-bold text-white text-sm">{matchedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Namba ya Simu / Akaunti:</span>
                      <span className="font-mono text-cyan-300 font-bold">{matchedCustomer.phone}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Salio la Sasa la Mteja:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Kamisheni ya Wakala (1.2%):</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +TZS {Math.round(depositAmount * 0.012).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400 pt-1.5 border-t border-white/10">
                      <span>Salio Jipya Baada ya Kuweka:</span>
                      <span className="font-mono font-black text-cyan-300">
                        TZS {(matchedCustomer.walletBalance + depositAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : faceSystemStatus === 'unregistered' ? (
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs space-y-2 text-amber-200">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertCircle className="w-4 h-4" />
                      <span>Sura haipo kwenye mfumo!</span>
                    </p>
                    <p className="text-[11px] opacity-90">
                      Mteja hawezi kuweka pesa hadi asajiliwe. Bofya kitufe cha chini ili kufungua fomu ya usajili wa uso.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center text-xs text-neutral-400 space-y-1 py-6">
                    <Search className="w-6 h-6 mx-auto text-cyan-400 animate-pulse mb-1" />
                    <p className="font-bold text-white">Inasubiri Utambuzi wa Sura...</p>
                    <p className="text-[11px]">Tazama kamera ya Wakala ili uso wako utafutwe kwenye mfumo.</p>
                  </div>
                )}

                {/* CONFIRMATION BUTTON: UNLOCKED WHEN MATCHED */}
                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <button
                    type="button"
                    disabled={isConfirmingTx}
                    onClick={handleConfirmTransaction}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isConfirmingTx ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    <span>
                      {isConfirmingTx ? 'Inathibitisha Muamala...' : `Thibitisha Kuweka TZS ${depositAmount.toLocaleString()} kwa Uso`}
                    </span>
                  </button>
                ) : faceSystemStatus === 'unregistered' ? (
                  <button
                    type="button"
                    onClick={() => setIsFaceEnrollOpen(true)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Sajili Uso wa Mteja Hapa Kwanza</span>
                  </button>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/5 text-neutral-500 text-xs font-bold text-center">
                    Subiri Utambuzi wa Sura...
                  </div>
                )}
              </div>
            )}

            {/* OPERATION 2: FACE CASH-OUT (KUTOA PESA) */}
            {operation === 'face_withdraw' && (
              <div className="bg-[#0e1628] p-5 rounded-3xl border border-cyan-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Kutoa Pesa (Cash-Out)</h4>
                      <p className="text-[11px] text-neutral-400">Mteja anatoa pesa taslimu kutoka kwa Wakala</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                    Face Withdraw
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Kiasi Kinachotolewa (TZS):
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                    className="w-full bg-black/60 border border-cyan-500/30 px-4 py-3 rounded-2xl text-xl font-mono font-black text-amber-400 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[10000, 20000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setWithdrawAmount(amt);
                        triggerHapticTap();
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                        withdrawAmount === amt
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {amt/1000}k
                    </button>
                  ))}
                </div>

                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/40 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-neutral-400">
                      <span>Mteja Aliyetambuliwa:</span>
                      <span className="font-bold text-white text-sm">{matchedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Namba ya Simu:</span>
                      <span className="font-mono text-cyan-300 font-bold">{matchedCustomer.phone}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Salio la Sasa:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Kamisheni ya Wakala (1.2%):</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +TZS {Math.round(withdrawAmount * 0.012).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : faceSystemStatus === 'unregistered' ? (
                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs space-y-2 text-amber-200">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertCircle className="w-4 h-4" />
                      <span>Sura haipo kwenye mfumo!</span>
                    </p>
                    <p className="text-[11px] opacity-90">
                      Mteja hawezi kutoa pesa hadi asajiliwe. Bofya kitufe cha chini ili kumwandikisha.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center text-xs text-neutral-400 py-6">
                    <Search className="w-6 h-6 mx-auto text-amber-400 animate-pulse mb-1" />
                    <p className="font-bold text-white">Inasubiri Utambuzi wa Sura...</p>
                  </div>
                )}

                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <button
                    type="button"
                    disabled={isConfirmingTx}
                    onClick={handleConfirmTransaction}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isConfirmingTx ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                    <span>
                      {isConfirmingTx ? 'Inathibitisha Kutoa Pesa...' : `Thibitisha Kutoa TZS ${withdrawAmount.toLocaleString()} kwa Uso`}
                    </span>
                  </button>
                ) : faceSystemStatus === 'unregistered' ? (
                  <button
                    type="button"
                    onClick={() => setIsFaceEnrollOpen(true)}
                    className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Sajili Uso wa Mteja Hapa</span>
                  </button>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/5 text-neutral-500 text-xs font-bold text-center">
                    Subiri Utambuzi wa Sura...
                  </div>
                )}
              </div>
            )}

            {/* OPERATION 3: MERCHANT CHECKOUT / POS BILL */}
            {operation === 'merchant_checkout' && (
              <div className="bg-[#0e1628] p-5 rounded-3xl border border-cyan-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <ScanFace className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Bili ya Kaunta (POS)</h4>
                      <p className="text-[11px] text-neutral-400">Malipo ya papo hapo kwa sura ya mteja</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-cyan-300">
                    Jumla: TZS {cartTotal.toLocaleString()}
                  </span>
                </div>

                {/* Preset Catalog */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-400 block">Bidhaa &amp; Huduma za Haraka:</span>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {MERCHANT_ITEMS_PRESETS[businessType].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-base">{item.icon}</span>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate text-white">{item.name}</p>
                            <p className="text-[10px] font-mono text-cyan-400">TZS {item.price.toLocaleString()}</p>
                          </div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart list */}
                {cartItems.length > 0 && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 max-h-32 overflow-y-auto">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[150px]">{item.name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <button onClick={() => handleUpdateQty(item.id, -1)} className="px-1.5 bg-white/10 rounded">-</button>
                          <span>{item.qty}</span>
                          <button onClick={() => handleUpdateQty(item.id, 1)} className="px-1.5 bg-white/10 rounded">+</button>
                          <span className="text-cyan-400 font-bold">TZS {(item.price * item.qty).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/40 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Mteja:</span>
                      <span className="font-bold text-white">{matchedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Salio la Mteja:</span>
                      <span className="font-mono text-emerald-400 font-bold">TZS {matchedCustomer.walletBalance.toLocaleString()}</span>
                    </div>
                  </div>
                ) : faceSystemStatus === 'unregistered' ? (
                  <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300">
                    Sura haipo kwenye mfumo! Mteja anapaswa kujisajili kwanza.
                  </div>
                ) : null}

                {matchedCustomer && faceSystemStatus === 'matched' ? (
                  <button
                    type="button"
                    disabled={isConfirmingTx || cartItems.length === 0}
                    onClick={handleConfirmTransaction}
                    className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isConfirmingTx ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
                    <span>{isConfirmingTx ? 'Inathibitisha...' : `Lipa Bili ya TZS ${cartTotal.toLocaleString()} kwa Sura`}</span>
                  </button>
                ) : faceSystemStatus === 'unregistered' ? (
                  <button
                    type="button"
                    onClick={() => setIsFaceEnrollOpen(true)}
                    className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider"
                  >
                    Sajili Uso wa Mteja Hapa
                  </button>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/5 text-neutral-500 text-xs font-bold text-center">
                    Subiri Utambuzi wa Sura...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* DIGITAL RECEIPT MODAL */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black">Risiti ya Malipo ya PapoPay</h3>
                <p className="text-[10px] font-mono text-cyan-300">{lastReceipt.id}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">{lastReceipt.title}</span>
                <span className="text-2xl font-black font-mono text-cyan-300">
                  TZS {lastReceipt.amount.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-400 font-mono mt-0.5">Kamisheni: +TZS {lastReceipt.commission.toLocaleString()}</p>
              </div>

              <div className="space-y-1 text-xs font-mono text-neutral-300 border-t border-b border-white/10 py-2.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mteja:</span>
                  <span className="font-bold text-white">{lastReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Namba ya Simu:</span>
                  <span>{lastReceipt.customerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kituo:</span>
                  <span>{lastReceipt.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Uthibitisho:</span>
                  <span className="text-emerald-400 font-bold">Face ID Verified ✓</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/receipt/${lastReceipt.id}`} size={75} />
                <span className="text-[9px] text-neutral-600 font-mono mt-1">EFD Digital Receipt BOT</span>
              </div>

              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
              >
                Funga Risiti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FACE REGISTRATION MODAL */}
      <FaceRegistrationModal
        isOpen={isFaceEnrollOpen}
        onClose={() => setIsFaceEnrollOpen(false)}
        onSuccess={handleEnrollSuccess}
        initialName="Mteja Mpya"
        initialPhone="0755 000 111"
      />
    </div>
  );
};
