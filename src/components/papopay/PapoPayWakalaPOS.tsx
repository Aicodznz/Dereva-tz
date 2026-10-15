import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Utensils, Building2, Banknote, ArrowDownLeft, ArrowUpRight, 
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck, RefreshCw, 
  Volume2, VolumeX, Sparkles, UserX, UserPlus, Receipt, Printer, 
  Share2, QrCode, Search, Smartphone, Shield, Check, Clock, 
  Coffee, ShoppingBag, Plus, Trash2, Coins, ArrowRight, User
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, BiometricHudMode } from './BiometricFaceCanvas';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { toast } from 'sonner';

export type BusinessType = 'duka' | 'mgahawa' | 'hotel' | 'general_wakala';
export type WakalaOperation = 'face_deposit' | 'face_withdraw' | 'merchant_checkout';

interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
}

const WAKALA_CUSTOMERS_DB: SimulatedCustomer[] = [
  {
    id: 'cust_baraka',
    name: 'Baraka Juma Mrema',
    phone: '0754 *** 892',
    walletBalance: 3450000,
    faceEmbeddingId: 'EMB-TZ-DAR-9821-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isRegistered: true
  },
  {
    id: 'cust_zawadi',
    name: 'Zawadi Bakari Said',
    phone: '0713 *** 401',
    walletBalance: 820000,
    faceEmbeddingId: 'EMB-TZ-DAR-4102-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isRegistered: true
  },
  {
    id: 'cust_kelvin',
    name: 'Kelvin Mwamba',
    phone: '0788 *** 619',
    walletBalance: 125000,
    faceEmbeddingId: 'EMB-TZ-DAR-7719-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isRegistered: true
  },
  {
    id: 'cust_unregistered',
    name: 'Mgeni Hajajisajili (Unregistered)',
    phone: '0769 *** 000',
    walletBalance: 0,
    faceEmbeddingId: 'UNREGISTERED_NULL',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    isRegistered: false
  }
];

// Presets for quick merchant bill checkout
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

  // Customer & Scan State
  const [customers, setCustomers] = useState<SimulatedCustomer[]>(WAKALA_CUSTOMERS_DB);
  const [selectedCustomer, setSelectedCustomer] = useState<SimulatedCustomer>(WAKALA_CUSTOMERS_DB[0]);
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(30000);
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number; qty: number; icon: string }[]>([]);

  // Camera & Biometric Verification
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationPhase, setVerificationPhase] = useState<'idle' | 'align' | 'verifying' | 'success' | 'unregistered'>('idle');
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFaceEnrollOpen, setIsFaceEnrollOpen] = useState(false);

  // Receipt Modal
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      speak("Karibu kwenye Kituo cha Wakala na POS cha PapoPay. Chagua kuweka au kutoa pesa kwa uso.");
    } else {
      stopCamera();
      setVerificationPhase('idle');
      setIsVerifying(false);
    }
    return () => stopCamera();
  }, [isOpen]);

  // Adjust Business Name on Type switch
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

  // EXECUTE TRANSACTION WITH FACE SCAN
  const handleExecuteFaceTransaction = () => {
    if (isVerifying) return;

    let transactionAmount = 0;
    let operationTitle = '';

    if (operation === 'face_deposit') {
      transactionAmount = depositAmount;
      operationTitle = 'Wakala Kuweka Pesa (Face Cash-In)';
      if (transactionAmount <= 0) {
        toast.error("Weka kiasi sahihi cha kuweka!");
        return;
      }
    } else if (operation === 'face_withdraw') {
      transactionAmount = withdrawAmount;
      operationTitle = 'Wakala Kutoa Pesa (Face Cash-Out)';
      if (transactionAmount <= 0) {
        toast.error("Weka kiasi sahihi cha kutoa!");
        return;
      }
      if (selectedCustomer.isRegistered && selectedCustomer.walletBalance < transactionAmount) {
        toast.error(`Salio la mteja halitoshi! (Salio: TZS ${selectedCustomer.walletBalance.toLocaleString()})`);
        speak("Salio la mteja halitoshi kwa kutoa kiasi hiki.");
        return;
      }
    } else {
      transactionAmount = cartTotal;
      operationTitle = `Malipo ya ${businessType === 'duka' ? 'Duka' : businessType === 'mgahawa' ? 'Mgahawa' : 'Hotel'} (Face POS)`;
      if (transactionAmount <= 0) {
        toast.error("Weka bidhaa au huduma kwenye bili!");
        return;
      }
    }

    setIsVerifying(true);
    setVerificationPhase('align');
    speak("Tafadhali angalia kamera ili kuthibitisha uso wako.");

    // Check if customer is unregistered
    if (selectedCustomer.isRegistered === false) {
      setTimeout(() => {
        setVerificationPhase('unregistered');
        setIsVerifying(false);
        speak("Samahani, uso wako haujasajiliwa kwenye PapoPay. Tafadhali sajili uso wako kwanza ili kuweka au kutoa pesa.");
        toast.error("Uso Haujasajiliwa! Mteja anapaswa kujisajili kwanza.", { icon: '⚠️' });
      }, 1600);
      return;
    }

    // Customer is registered: proceed with live verification
    setTimeout(() => {
      setVerificationPhase('verifying');
      speak("Inathibitisha bayometriki ya uso...");

      setTimeout(() => {
        setVerificationPhase('success');
        setIsVerifying(false);
        playPaymentChime();
        triggerHapticTap();

        // Calculate commission (0.8% - 1.5% for Wakala)
        const commission = Math.round(transactionAmount * 0.012);
        setTotalCommissionEarned(prev => prev + commission);

        // Update customer balance in state
        if (operation === 'face_deposit') {
          setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: c.walletBalance + transactionAmount } : c));
          setSelectedCustomer(prev => ({ ...prev, walletBalance: prev.walletBalance + transactionAmount }));
          setWakalaFloatBalance(prev => prev - transactionAmount + commission);
          if (onBalanceDeposit) {
            onBalanceDeposit(transactionAmount, selectedCustomer.name);
          }
          speak(`Pesa shilingi ${transactionAmount.toLocaleString()} zimewekwa kikamilifu kwenye akaunti ya ${selectedCustomer.name.split(' ')[0]}. Asante.`);
          toast.success(`TZS ${transactionAmount.toLocaleString()} Zimewekwa kwa Mafanikio! Kamisheni: TZS ${commission.toLocaleString()}`, { icon: '💰' });
        } else if (operation === 'face_withdraw') {
          setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: c.walletBalance - transactionAmount } : c));
          setSelectedCustomer(prev => ({ ...prev, walletBalance: prev.walletBalance - transactionAmount }));
          setWakalaFloatBalance(prev => prev + transactionAmount + commission);
          if (onBalanceWithdraw) {
            onBalanceWithdraw(transactionAmount, selectedCustomer.name);
          }
          speak(`Kutoa pesa kwa shilingi ${transactionAmount.toLocaleString()} kumethibitishwa. Mpe mteja pesa taslimu.`);
          toast.success(`Kutoa Pesa Kumethibitishwa! Kamisheni ya Wakala: TZS ${commission.toLocaleString()}`, { icon: '💵' });
        } else {
          // Merchant checkout
          setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: Math.max(0, c.walletBalance - transactionAmount) } : c));
          setSelectedCustomer(prev => ({ ...prev, walletBalance: Math.max(0, prev.walletBalance - transactionAmount) }));
          speak(`Malipo ya shilingi ${transactionAmount.toLocaleString()} yamekamilika. Risiti imetolewa.`);
          toast.success(`Malipo Yamethibitishwa kwa Uso! TZS ${transactionAmount.toLocaleString()}`, { icon: '🧾' });
        }

        // Generate Digital Receipt
        const receiptData = {
          txId: `WAKALA-${Math.floor(100000 + Math.random() * 900000)}`,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          customerPhoto: selectedCustomer.avatar,
          operationTitle,
          amount: transactionAmount,
          commission,
          businessName,
          wakalaId,
          time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          date: new Date().toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: operation === 'merchant_checkout' ? [...cartItems] : undefined
        };

        setLastReceipt(receiptData);

        setTimeout(() => {
          setVerificationPhase('idle');
        }, 3500);

      }, 1600);
    }, 1400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2400] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-5xl bg-[#0a0f1d] border border-cyan-500/40 rounded-[32px] overflow-hidden shadow-2xl shadow-cyan-950/80 flex flex-col text-white my-auto max-h-[96vh]"
        >
          {/* TOP HEADER */}
          <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d1424] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                    PapoPay Wakala &amp; Merchant POS
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-400/30">
                    {wakalaId}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-medium truncate max-w-xs sm:max-w-md">
                  {businessName} &bull; Huduma za Kuweka/Kutoa Pesa &amp; Malipo ya Uso
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
            {/* Business selector */}
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

            {/* Float & Commission Stats */}
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
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
            {/* LEFT COLUMN: LIVE BIOMETRIC CAMERA & CUSTOMER DETECTION (7 COLS) */}
            <div className="lg:col-span-7 flex flex-col items-center space-y-4">
              {/* OPERATION TABS (DEPOSIT / WITHDRAW / POS BILL) */}
              <div className="w-full grid grid-cols-3 gap-2 bg-neutral-900/80 p-1.5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setOperation('face_deposit');
                    triggerHapticTap();
                    speak("Umechagua kuweka pesa kwa uso.");
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    operation === 'face_deposit'
                      ? 'bg-emerald-500 text-neutral-950 shadow-lg font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Weka Pesa (Face Cash-In)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOperation('face_withdraw');
                    triggerHapticTap();
                    speak("Umechagua kutoa pesa kwa uso.");
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    operation === 'face_withdraw'
                      ? 'bg-amber-500 text-neutral-950 shadow-lg font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Toa Pesa (Cash-Out)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOperation('merchant_checkout');
                    triggerHapticTap();
                    speak("Umechagua kulipia bili ya dukani au mgahawani.");
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                    operation === 'merchant_checkout'
                      ? 'bg-cyan-500 text-neutral-950 shadow-lg font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Lipa Bili / POS</span>
                </button>
              </div>

              {/* CAMERA VIEWPORT WITH BIOMETRIC HUD */}
              <div className="relative w-full aspect-video sm:aspect-[4/3] max-w-md rounded-3xl overflow-hidden border-4 border-cyan-500/40 bg-black flex items-center justify-center shadow-2xl shadow-cyan-950/60">
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
                  phase={
                    verificationPhase === 'unregistered'
                      ? 'unregistered'
                      : verificationPhase === 'success'
                      ? 'success'
                      : verificationPhase === 'verifying'
                      ? 'verifying'
                      : 'align_center'
                  }
                  isUnregistered={!selectedCustomer.isRegistered || verificationPhase === 'unregistered'}
                  hudMode={hudMode}
                  faceConfidence={selectedCustomer.isRegistered ? 99.2 : 0}
                  lightingQuality={94}
                  distanceCm={42}
                />

                {/* Top Corner AI Badge */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Murtaza AI Face Pass</span>
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

                {/* Unregistered Alert Overlay */}
                {verificationPhase === 'unregistered' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 z-30 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center mb-3 shadow-[0_0_35px_#f59e0b] animate-bounce">
                      <UserX className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-black border border-amber-500/40 uppercase mb-1">
                      Mteja Hajajisajili ⚠️
                    </span>
                    <h3 className="text-xl font-black text-white">
                      USO WAKO HAUJASAJILIWA!
                    </h3>
                    <p className="text-amber-200 text-xs font-medium mt-1 max-w-xs">
                      Mfumo wa PapoPay haujapata alama za uso za mteja huyu. Bofya kitufe hapa chini ili kumwandikisha moja kwa moja.
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsFaceEnrollOpen(true)}
                      className="mt-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Sajili Uso wa Mteja Hapa (Enroll)</span>
                    </button>
                  </motion.div>
                )}

                {/* Success Flash Overlay */}
                {verificationPhase === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 z-30 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-[0_0_35px_#10b981] animate-bounce">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                      UTAMBUZI WA USO UMEFANIKIWA!
                    </h3>
                    <p className="text-emerald-300 text-xs font-bold mt-1">
                      {selectedCustomer.name} &bull; Biometric Key Verified (99.8%)
                    </p>
                  </motion.div>
                )}

                {/* Bottom Customer Info Tag inside Viewport */}
                <div className="absolute bottom-3 inset-x-3 z-20 bg-black/80 backdrop-blur-md p-2.5 rounded-2xl border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={selectedCustomer.avatar}
                      alt="Avatar"
                      className="w-9 h-9 rounded-full object-cover border border-cyan-400"
                    />
                    <div>
                      <p className="text-xs font-black text-white leading-tight">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">Salio la Mteja</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      TZS {selectedCustomer.walletBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIMULATED CUSTOMER SWITCHER (Allows testing different customers and unregistered person) */}
              <div className="w-full bg-neutral-900/60 p-3 rounded-2xl border border-white/5 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 block">
                  Simulate Customer Mbele ya Kamera ya Wakala:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setVerificationPhase('idle');
                        triggerHapticTap();
                        speak(`Mteja aliyetambuliwa: ${c.name.split(' ')[0]}`);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        selectedCustomer.id === c.id
                          ? c.isRegistered
                            ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-xs'
                            : 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-xs'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <img src={c.avatar} alt="Face" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-bold truncate">{c.name.split(' ')[0]}</p>
                        <p className="text-[9px] font-mono opacity-80">
                          {c.isRegistered ? '✓ Registered' : '⚠️ Unregistered'}
                        </p>
                      </div>
                    </button>
                  ))}
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

                  {/* Summary Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Mteja:</span>
                      <span className="font-bold text-white">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Kamisheni ya Wakala (1.2%):</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +TZS {Math.round(depositAmount * 0.012).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400 pt-1 border-t border-white/10">
                      <span>Salio Jipya la Mteja Baada ya Scan:</span>
                      <span className="font-mono font-black text-cyan-300">
                        TZS {(selectedCustomer.walletBalance + depositAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Scan & Confirm Button */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={handleExecuteFaceTransaction}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanFace className="w-5 h-5" />
                    )}
                    <span>
                      {isVerifying ? 'Inasoma Uso wa Mteja...' : `Thibitisha Kuweka TZS ${depositAmount.toLocaleString()} kwa Uso`}
                    </span>
                  </button>
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
                        {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                      </button>
                    ))}
                  </div>

                  {/* Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Mteja:</span>
                      <span className="font-bold text-white">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Salio la Sasa:</span>
                      <span className="font-mono text-cyan-300">
                        TZS {selectedCustomer.walletBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Kamisheni ya Wakala (1.2%):</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +TZS {Math.round(withdrawAmount * 0.012).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Withdraw Button */}
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={handleExecuteFaceTransaction}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanFace className="w-5 h-5" />
                    )}
                    <span>
                      {isVerifying ? 'Inathibitisha Uso wa Mteja...' : `Lipa Taslimu TZS ${withdrawAmount.toLocaleString()} kwa Uso`}
                    </span>
                  </button>
                </div>
              )}

              {/* OPERATION 3: MERCHANT POS BILL (DUKA / MGAHAWA / HOTEL CHECKOUT) */}
              {operation === 'merchant_checkout' && (
                <div className="bg-[#0e1628] p-5 rounded-3xl border border-cyan-500/30 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white">
                        {businessType === 'duka' ? 'Bili ya Duka' : businessType === 'mgahawa' ? 'Bili ya Mgahawa' : 'Bili ya Hoteli'}
                      </h4>
                      <p className="text-[11px] text-neutral-400">Mteja analipa bili kwa kuangalia kamera</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-black uppercase">
                      Smile to Pay
                    </span>
                  </div>

                  {/* Quick Items selector for this business type */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-neutral-400 font-bold block">
                      Ongeza Vitu vya Haraka ({businessType.toUpperCase()}):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {MERCHANT_ITEMS_PRESETS[businessType].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left flex items-center gap-2 transition-all active:scale-95"
                        >
                          <span className="text-base">{item.icon}</span>
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] font-mono text-cyan-300">TZS {item.price.toLocaleString()}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Cart List */}
                  <div className="space-y-2">
                    <span className="text-[11px] text-neutral-400 font-bold block">
                      Vitu Vilivyochaguliwa ({cartItems.length}):
                    </span>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {cartItems.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic py-2 text-center">Bili haina vitu kwa sasa.</p>
                      ) : (
                        cartItems.map(item => (
                          <div key={item.id} className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span>{item.icon}</span>
                              <span className="font-bold text-white truncate max-w-[130px]">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-cyan-300">TZS {(item.price * item.qty).toLocaleString()}</span>
                              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                                <button type="button" onClick={() => handleUpdateQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded font-bold">-</button>
                                <span className="px-1 text-[11px] font-mono">{item.qty}</span>
                                <button type="button" onClick={() => handleUpdateQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center hover:bg-white/20 rounded font-bold">+</button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-cyan-500/20 flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-neutral-400">Jumla ya Bili:</span>
                    <span className="text-xl font-mono font-black text-cyan-300">
                      TZS {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Checkout Button */}
                  <button
                    type="button"
                    disabled={isVerifying || cartItems.length === 0}
                    onClick={handleExecuteFaceTransaction}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanFace className="w-5 h-5" />
                    )}
                    <span>
                      {isVerifying ? 'Inasoma Uso na Kuthibitisha...' : `Lipa Bili TZS ${cartTotal.toLocaleString()} kwa Uso`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* DIGITAL RECEIPT MODAL */}
          <AnimatePresence>
            {lastReceipt && (
              <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="bg-[#0b1222] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-white space-y-4"
                >
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-black text-white">Stakabadhi ya Wakala &amp; EFD</h3>
                    <p className="text-[10px] font-mono text-cyan-300">{lastReceipt.txId}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">{lastReceipt.operationTitle}</span>
                    <div className="text-2xl font-black font-mono text-emerald-400">
                      TZS {lastReceipt.amount.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-cyan-300 font-mono">
                      Kamisheni: +TZS {lastReceipt.commission.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-neutral-300 border-t border-b border-white/10 py-3 font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Mteja:</span>
                      <span className="font-bold text-white">{lastReceipt.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Kituo:</span>
                      <span>{lastReceipt.businessName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Muda:</span>
                      <span>{lastReceipt.date} {lastReceipt.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Uthibitisho:</span>
                      <span className="text-emerald-400 font-bold">Face ID Verified ✓</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl">
                    <QRCodeSVG value={`https://papo.tz/wakala/verify/${lastReceipt.txId}`} size={85} />
                    <span className="text-[9px] text-neutral-600 font-mono mt-1">EFD Digital Receipt BOT</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        toast.success("Risiti imetumwa kwa WhatsApp ya mteja!");
                      }}
                      className="py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLastReceipt(null)}
                      className="py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase"
                    >
                      Funga
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ON-THE-SPOT CUSTOMER FACE ENROLLMENT MODAL */}
          <FaceRegistrationModal
            isOpen={isFaceEnrollOpen}
            onClose={() => setIsFaceEnrollOpen(false)}
            initialName={selectedCustomer.name.includes('Unregistered') ? 'Mteja Mpya' : selectedCustomer.name}
            initialPhone="0769 111 222"
            onSuccess={(regData) => {
              const updated = {
                ...selectedCustomer,
                name: regData.name,
                phone: regData.phone,
                faceEmbeddingId: regData.embeddingId,
                isRegistered: true
              };
              setSelectedCustomer(updated);
              setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updated : c));
              setVerificationPhase('idle');
              toast.success(`Uso wa ${regData.name} umesajiliwa kikamilifu! Sasa unaweza kumwekea au kumtolea pesa kwa uso.`);
              speak(`Uso wa ${regData.name.split(' ')[0]} umesajiliwa kikamilifu kwenye kituo cha Wakala.`);
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
