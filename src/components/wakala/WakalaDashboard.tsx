import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Banknote, ArrowDownLeft, ArrowUpRight, ScanFace, 
  CheckCircle2, AlertCircle, X, ShieldCheck, RefreshCw, 
  Volume2, VolumeX, Sparkles, UserX, UserPlus, Receipt, 
  Printer, Share2, QrCode, Search, Smartphone, Shield, 
  Check, Clock, Coins, Plus, Trash2, ArrowRight, User, 
  LogOut, Wallet, Building2, Sliders, MapPin, Phone,
  Zap, Droplets, Tv, Send, FileText, ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, BiometricHudMode, FaceTrackResult } from '../papopay/BiometricFaceCanvas';
import { FaceRegistrationModal } from '../papopay/FaceRegistrationModal';
import { toast } from 'sonner';

export interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
  hasAccountButNoFace?: boolean;
  nidaNumber?: string;
}

const DEFAULT_WAKALA_CLIENTS: SimulatedCustomer[] = [
  {
    id: 'cust_baraka',
    name: 'Baraka Juma Mrema',
    phone: '0754 892 100',
    walletBalance: 3450000,
    faceEmbeddingId: 'EMB-TZ-DAR-9821-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19880412-14102-00001-24'
  },
  {
    id: 'cust_zawadi',
    name: 'Zawadi Bakari Said',
    phone: '0713 401 200',
    walletBalance: 820000,
    faceEmbeddingId: 'EMB-TZ-DAR-4102-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19930725-21040-00002-18'
  },
  {
    id: 'cust_kelvin',
    name: 'Kelvin Mwamba',
    phone: '0788 619 450',
    walletBalance: 125000,
    faceEmbeddingId: 'EMB-TZ-DAR-7719-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19961103-31890-00003-91'
  },
  {
    id: 'cust_no_face',
    name: 'Amina Hamisi (Akaunti Ipo, Bado Uso)',
    phone: '0714 888 333',
    walletBalance: 250000,
    faceEmbeddingId: 'NOT_ENROLLED',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    isRegistered: false,
    hasAccountButNoFace: true,
    nidaNumber: '19950312-51203-00004-55'
  },
  {
    id: 'cust_unregistered',
    name: 'Mgeni Hajajisajili (Unknown Visitor)',
    phone: '0769 000 000',
    walletBalance: 0,
    faceEmbeddingId: 'UNREGISTERED_NULL',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    isRegistered: false
  }
];

export type WakalaServiceTab = 'deposit' | 'withdraw' | 'airtime' | 'bills' | 'send_money' | 'statement';

export default function WakalaDashboard() {
  const navigate = useNavigate();

  // Load wakala profile from storage
  const [wakalaProfile, setWakalaProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('papopay_current_wakala');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      wakalaId: 'TZ-WAKALA-0842-DAR',
      businessName: 'Wakala wa PapoPay - Dar Express',
      agentName: 'Baraka Juma Mrema',
      phone: '0754 892 100',
      location: 'Dar es Salaam, Posta / Kariakoo',
      wakalaFloatBalance: 8500000,
      commissionEarned: 38400,
      role: 'wakala'
    };
  });

  const [floatBalance, setFloatBalance] = useState<number>(wakalaProfile.wakalaFloatBalance || 8500000);
  const [commissionEarned, setCommissionEarned] = useState<number>(wakalaProfile.commissionEarned || 38400);

  // Active top-level navigation
  const [portalMode, setPortalMode] = useState<'terminal' | 'ledger' | 'float_mgmt'>('terminal');

  // Customer DB with localStorage registration support
  const [customers, setCustomers] = useState<SimulatedCustomer[]>(() => {
    try {
      const customFace = localStorage.getItem('papopay_registered_face');
      if (customFace) {
        const parsed = JSON.parse(customFace);
        const isEnrolled = Boolean(parsed.isEnrolled);
        const enrolledCust: SimulatedCustomer = {
          id: 'cust_enrolled_' + (parsed.phone || 'custom'),
          name: parsed.name || 'Mteja Aliyetengeneza Akaunti',
          phone: parsed.phone || '0754 000 000',
          walletBalance: 500000,
          faceEmbeddingId: isEnrolled ? (parsed.embeddingId || 'EMB-CUSTOM-REGISTERED') : 'NOT_ENROLLED',
          avatar: parsed.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isRegistered: isEnrolled,
          hasAccountButNoFace: !isEnrolled,
          nidaNumber: '20010815-44210-00012-77'
        };
        return [enrolledCust, ...DEFAULT_WAKALA_CLIENTS];
      }
    } catch {}
    return DEFAULT_WAKALA_CLIENTS;
  });

  // Simulated target currently in front of camera
  const [activeSubject, setActiveSubject] = useState<SimulatedCustomer>(DEFAULT_WAKALA_CLIENTS[0]);

  // Face Tracking & System Search Pipeline
  // 'tracking' -> searching/detecting face in video
  // 'searching_db' -> face locked, searching database
  // 'customer_found' -> customer verified, services unlocked
  // 'unregistered' -> face found but not in system
  const [searchState, setSearchState] = useState<'tracking' | 'searching_db' | 'customer_found' | 'unregistered'>('tracking');
  const [searchProgress, setSearchProgress] = useState<number>(0);
  const [matchedCustomer, setMatchedCustomer] = useState<SimulatedCustomer | null>(null);

  // Active Wakala Service when customer is unlocked
  const [activeService, setActiveService] = useState<WakalaServiceTab>('deposit');

  // Inputs for services
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(30000);
  const [airtimeNetwork, setAirtimeNetwork] = useState<'Vodacom' | 'Tigo' | 'Airtel' | 'Halotel'>('Vodacom');
  const [airtimeAmount, setAirtimeAmount] = useState<number>(5000);
  const [billType, setBillType] = useState<'luku' | 'daway' | 'azam'>('luku');
  const [billMeterNumber, setBillMeterNumber] = useState('04291882901');
  const [billAmount, setBillAmount] = useState<number>(20000);
  const [sendRecipientPhone, setSendRecipientPhone] = useState('0712 345 678');
  const [sendAmount, setSendAmount] = useState<number>(25000);

  // Biometric camera controls
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Live Telemetry from BiometricFaceCanvas
  const [liveConfidence, setLiveConfidence] = useState(99.4);
  const [liveDistance, setLiveDistance] = useState(42);
  const [liveLux, setLiveLux] = useState(92);
  const [liveYaw, setLiveYaw] = useState(0);

  // Float modal & Receipt modal
  const [isFloatModalOpen, setIsFloatModalOpen] = useState(false);
  const [floatTopUpAmount, setFloatTopUpAmount] = useState('1000000');
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // History ledger
  const [transactions, setTransactions] = useState<any[]>([
    {
      id: 'WAK-DEP-9921',
      customer: 'Baraka Juma Mrema',
      type: 'Cash-In (Kuweka)',
      amount: 50000,
      commission: 600,
      time: '10:42 AM',
      date: 'Leo',
      status: 'completed'
    },
    {
      id: 'WAK-WTH-8812',
      customer: 'Zawadi Bakari Said',
      type: 'Cash-Out (Kutoa)',
      amount: 30000,
      commission: 360,
      time: '09:15 AM',
      date: 'Leo',
      status: 'completed'
    }
  ]);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera fallback active in Wakala", err);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    speak(`Karibu kwenye Kituo cha Wakala cha PapoPay, ${wakalaProfile.businessName}. Mfumo unatafuta uso wa mteja.`);
    // Automatically trigger system face search for active subject
    triggerFaceSearch(activeSubject);
    return () => stopCamera();
  }, []);

  // Sync balances to storage
  useEffect(() => {
    try {
      const updated = {
        ...wakalaProfile,
        wakalaFloatBalance: floatBalance,
        commissionEarned
      };
      localStorage.setItem('papopay_current_wakala', JSON.stringify(updated));
    } catch {}
  }, [floatBalance, commissionEarned]);

  // FACE TRACKER CALLBACK from BiometricFaceCanvas
  const handleFaceTracked = (data: FaceTrackResult) => {
    if (data.detected) {
      setLiveConfidence(data.confidence);
      setLiveLux(data.brightness);
      setLiveDistance(data.distanceCm);
      setLiveYaw(data.headYaw);
    }
  };

  // TRIGGER AUTOMATIC DATABASE SEARCH (ITAFUTE KWENYE SISTIM)
  const triggerFaceSearch = (subject: SimulatedCustomer) => {
    setActiveSubject(subject);
    setSearchState('searching_db');
    setMatchedCustomer(null);
    setSearchProgress(15);

    speak("Uso umepatikana. Inatafuta mteja kwenye mfumo wa PapoPay...");

    // Animate search progress bar
    const pInterval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 90) {
          clearInterval(pInterval);
          return 90;
        }
        return prev + 25;
      });
    }, 250);

    setTimeout(() => {
      clearInterval(pInterval);
      setSearchProgress(100);

      if (subject.isRegistered) {
        // MATCHED CUSTOMER FOUND IN SYSTEM! (kama alisha weka kipindi anajisajili sawa)
        setMatchedCustomer(subject);
        setSearchState('customer_found');
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja ${subject.name.split(' ')[0]} ametambuliwa kikamilifu. Sasa unaweza kuweka pesa au kufanya huduma nyengine.`);
        toast.success(`Mteja Ametambuliwa: ${subject.name}`, { icon: '✅' });
      } else if (subject.hasAccountButNoFace) {
        // AKAUNTI IPO LAKINI HAJAWEKA USO (kama hajaweka ambiwe hajaweka aweke)
        setSearchState('unregistered');
        setMatchedCustomer(null);
        triggerHapticTap();
        speak(`Mteja ${subject.name.split(' ')[0]} ana akaunti lakini hajasajili uso bado! Tafadhali weka uso wake sasa ili kuwezesha miamala.`);
        toast.warning(`Akaunti Ipo, Bado Uso: ${subject.name}`, { 
          description: "Mteja hakusajili uso wakati anajisajili. Weka uso wake sasa ili kuweka pesa.",
          icon: '⚠️' 
        });
      } else {
        // UNREGISTERED FACE!
        setSearchState('unregistered');
        setMatchedCustomer(null);
        triggerHapticTap();
        speak("Samahani, uso huu haujasajiliwa kwenye mfumo wa PapoPay. Tafadhali bonyeza Sajili Mteja ili kumsajili sasa.");
        toast.error("Uso Haujasajiliwa! Mteja anapaswa kusajiliwa kwanza kituoni.", { icon: '⚠️' });
      }
    }, 1200);
  };

  // 1. KUWEKA PESA (CASH-IN DEPOSIT)
  const handleExecuteDeposit = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (depositAmount <= 0) {
      toast.error('Weka kiasi sahihi cha kuweka pesa!');
      return;
    }
    if (floatBalance < depositAmount) {
      toast.error(`Salio la Float ya Wakala halitoshi! (Float: TZS ${floatBalance.toLocaleString()})`);
      speak("Salio lako la float halitoshi kufanya muamala huu. Tafadhali ongeza float.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Inaweka shilingi ${depositAmount.toLocaleString()} kwenye akaunti ya ${matchedCustomer.name.split(' ')[0]}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(depositAmount * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev - depositAmount + commission);

      // Update customer balance
      const updatedBalance = matchedCustomer.walletBalance + depositAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const newTx = {
        id: `WAK-DEP-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: 'Cash-In (Kuweka)',
        amount: depositAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setLastReceipt({
        ...newTx,
        customerPhone: matchedCustomer.phone,
        customerPhoto: matchedCustomer.avatar,
        wakalaId: wakalaProfile.wakalaId,
        businessName: wakalaProfile.businessName
      });

      speak(`Pesa shilingi ${depositAmount.toLocaleString()} zimewekwa kikamilifu kwa ${matchedCustomer.name.split(' ')[0]}. Kamisheni yako ni shilingi ${commission.toLocaleString()}.`);
      toast.success(`TZS ${depositAmount.toLocaleString()} Zimewekwa kwa Uso! Kamisheni: +TZS ${commission.toLocaleString()}`, { icon: '💰' });
    }, 1400);
  };

  // 2. KUTOA PESA (CASH-OUT WITHDRAWAL)
  const handleExecuteWithdraw = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (withdrawAmount <= 0) {
      toast.error('Weka kiasi sahihi cha kutoa pesa!');
      return;
    }
    if (matchedCustomer.walletBalance < withdrawAmount) {
      toast.error(`Salio la mteja halitoshi! (Salio: TZS ${matchedCustomer.walletBalance.toLocaleString()})`);
      speak("Salio la mteja halitoshi kwa kutoa kiasi hiki.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Mteja anatoa shilingi ${withdrawAmount.toLocaleString()}. Inathibitisha kibayometriki...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(withdrawAmount * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev + withdrawAmount + commission);

      const updatedBalance = matchedCustomer.walletBalance - withdrawAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const newTx = {
        id: `WAK-WTH-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: 'Cash-Out (Kutoa)',
        amount: withdrawAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setLastReceipt({
        ...newTx,
        customerPhone: matchedCustomer.phone,
        customerPhoto: matchedCustomer.avatar,
        wakalaId: wakalaProfile.wakalaId,
        businessName: wakalaProfile.businessName
      });

      speak(`Kutoa pesa kwa shilingi ${withdrawAmount.toLocaleString()} kumethibitishwa. Mkabidhi mteja pesa taslimu.`);
      toast.success(`Kutoa Pesa Kumethibitishwa! Mkabidhi mteja TZS ${withdrawAmount.toLocaleString()}`, { icon: '💵' });
    }, 1400);
  };

  // 3. NUNUA VOCHA (AIRTIME)
  const handleExecuteAirtime = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (airtimeAmount <= 0) return;
    if (matchedCustomer.walletBalance < airtimeAmount) {
      toast.error("Salio la mteja halitoshi kununua vocha.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Inanunua vocha ya ${airtimeNetwork} shilingi ${airtimeAmount.toLocaleString()}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(airtimeAmount * 0.03); // 3% airtime commission
      setCommissionEarned(prev => prev + commission);

      const updatedBalance = matchedCustomer.walletBalance - airtimeAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const newTx = {
        id: `WAK-AIR-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: `Vocha (${airtimeNetwork})`,
        amount: airtimeAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);

      speak(`Vocha ya ${airtimeNetwork} ya shilingi ${airtimeAmount.toLocaleString()} imetumwa kwenye simu ya ${matchedCustomer.name.split(' ')[0]}.`);
      toast.success(`Vocha ya ${airtimeNetwork} TZS ${airtimeAmount.toLocaleString()} Imetumwa!`, { icon: '📱' });
    }, 1200);
  };

  // 4. LIPA BILI (LUKU / MAJI / AZAMTV)
  const handleExecuteBill = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (billAmount <= 0) return;
    if (matchedCustomer.walletBalance < billAmount) {
      toast.error("Salio la mteja halitoshi kulipia bili hii.");
      return;
    }

    setIsProcessingAction(true);
    const billName = billType === 'luku' ? 'LUKU Umeme' : billType === 'daway' ? 'DAWASCO Maji' : 'AzamTV';
    speak(`Inalipia bili ya ${billName} shilingi ${billAmount.toLocaleString()}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = 500;
      setCommissionEarned(prev => prev + commission);

      const updatedBalance = matchedCustomer.walletBalance - billAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const tokenLuku = billType === 'luku' ? `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}` : undefined;

      const newTx = {
        id: `WAK-BIL-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: `Lipa Bili (${billName})`,
        amount: billAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed',
        extraNote: tokenLuku ? `Token: ${tokenLuku}` : undefined
      };
      setTransactions(prev => [newTx, ...prev]);

      speak(`Bili ya ${billName} imelipwa kikamilifu. ${tokenLuku ? 'Token ya LUKU imetolewa.' : ''}`);
      toast.success(`Bili ya ${billName} TZS ${billAmount.toLocaleString()} Imelipwa!`, { icon: '⚡' });
    }, 1300);
  };

  // Float top up execution
  const handleTopUpFloat = () => {
    const amt = Number(floatTopUpAmount) || 0;
    if (amt <= 0) return;
    setFloatBalance(prev => prev + amt);
    setIsFloatModalOpen(false);
    toast.success(`Float ya TZS ${amt.toLocaleString()} imeongezwa kikamilifu kwenye kituo chako!`);
    speak(`Float ya shilingi ${amt >= 1000000 ? (amt/1000000).toFixed(1) + ' milioni' : amt.toLocaleString()} imeongezwa.`);
  };

  // Withdraw commission
  const handleWithdrawCommission = () => {
    if (commissionEarned <= 0) {
      toast.error('Huna kamisheni ya kutoa kwa sasa.');
      return;
    }
    const amt = commissionEarned;
    setCommissionEarned(0);
    toast.success(`Kamisheni ya TZS ${amt.toLocaleString()} imetumwa kwenye simu yako!`);
    speak(`Kamisheni ya shilingi ${amt.toLocaleString()} imetolewa kikamilifu.`);
  };

  // When face registration completes successfully
  const handleEnrollSuccess = (registeredData: { name: string; phone: string; embeddingId: string }) => {
    const newClient: SimulatedCustomer = {
      id: 'cust_' + Date.now(),
      name: registeredData.name,
      phone: registeredData.phone,
      walletBalance: 200000,
      faceEmbeddingId: registeredData.embeddingId,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isRegistered: true,
      nidaNumber: '20030101-77120-00045-88'
    };

    setCustomers(prev => [newClient, ...prev]);
    setActiveSubject(newClient);
    setIsEnrollOpen(false);

    // Immediately trigger search & match so they can deposit right away!
    triggerFaceSearch(newClient);
    toast.success(`Mteja ${registeredData.name} amesajiliwa! Sasa mfumo umemtambua.`, { icon: '🎉' });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans">
      {/* TOP WAKALA PORTAL HEADER */}
      <header className="border-b border-white/10 bg-[#0c1222] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  PapoPay Wakala Portal
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                  {wakalaProfile.wakalaId}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Kituo Kipo Hewani
                </span>
              </div>
              <p className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>{wakalaProfile.businessName}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-neutral-500"><MapPin className="w-3 h-3" /> {wakalaProfile.location}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              title={soundEnabled ? 'Zima sauti' : 'Washa sauti'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <Link
              to="/papopay"
              className="hidden sm:flex px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 items-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Akaunti ya Mteja</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('papopay_current_wakala');
                toast.info("Umetoka kwenye Portal ya Wakala.");
                navigate('/wakala/login');
              }}
              className="p-2.5 sm:px-3.5 sm:py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Ondoka kwenye kituo"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Toka Kituoni</span>
            </button>
          </div>
        </div>
      </header>

      {/* METRICS & FLOAT BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Float Balance */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0c1628] to-[#091120] border border-cyan-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-neutral-400">Salio la Float ya Wakala</span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
                TZS {floatBalance.toLocaleString()}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Inatumika kwa Kuweka (Cash-In)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFloatModalOpen(true)}
              className="mt-2 py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ongeza Float (Bank / M-Pesa)</span>
            </button>
          </div>

          {/* Card 2: Commission Earned */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0a1b18] to-[#081512] border border-emerald-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-neutral-400">Kamisheni Uliyopata</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                +TZS {commissionEarned.toLocaleString()}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Faida yako ya leo (1.2% - 3%)</p>
            </div>
            <button
              type="button"
              onClick={handleWithdrawCommission}
              className="mt-2 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Toa Kamisheni kwenda Simuni</span>
            </button>
          </div>

          {/* Card 3: Cash-In Completed */}
          <div className="p-5 rounded-3xl bg-[#0e1424] border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-neutral-400">Kuweka Pesa (Cash-In)</span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white">
                {transactions.filter(t => t.type.includes('Kuweka')).length} Miamala
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Hakuna namba ya siri inayohitajika</p>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono font-bold">Face Recognition Active</span>
          </div>

          {/* Card 4: Cash-Out Completed */}
          <div className="p-5 rounded-3xl bg-[#0e1424] border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-neutral-400">Kutoa Pesa (Cash-Out)</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white">
                {transactions.filter(t => t.type.includes('Kutoa') || t.type.includes('Vocha') || t.type.includes('Bili')).length} Miamala
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Bila Kadi wala Simu Mkononi</p>
            </div>
            <span className="text-[11px] text-amber-400 font-mono font-bold">Smile-to-Withdraw Active</span>
          </div>
        </div>

        {/* TOP TAB CONTROLS (TERMINAL vs LEDGER) */}
        <div className="mt-6 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalMode('terminal');
                triggerHapticTap();
              }}
              className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                portalMode === 'terminal'
                  ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <ScanFace className="w-4 h-4" />
              <span>1. Kituo cha Utambuzi wa Uso (Terminal)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalMode('ledger');
                triggerHapticTap();
              }}
              className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                portalMode === 'ledger'
                  ? 'bg-cyan-500 text-neutral-950 shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>2. Kumbukumbu ya Miamala ({transactions.length})</span>
            </button>
          </div>

          {/* Quick Rescan Button */}
          <button
            type="button"
            onClick={() => triggerFaceSearch(activeSubject)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scan Upya Uso Mbele ya Kamera</span>
          </button>
        </div>

        {/* TAB 1: TERMINAL WITH LIVE FACE TRACKING & DATABASE SEARCH */}
        {portalMode === 'terminal' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: LIVE BIOMETRIC CAMERA & TRACKING (6 COLS) */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden border-4 border-emerald-500/40 bg-black flex items-center justify-center shadow-2xl shadow-emerald-950/60">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />

                {/* Biometric Face Mesh & Real Video Tracking HUD */}
                <BiometricFaceCanvas
                  videoRef={videoRef}
                  onFaceTracked={handleFaceTracked}
                  phase={
                    searchState === 'unregistered'
                      ? 'unregistered'
                      : searchState === 'customer_found'
                      ? 'success'
                      : searchState === 'searching_db'
                      ? 'verifying'
                      : 'align_center'
                  }
                  isUnregistered={searchState === 'unregistered'}
                  hudMode={hudMode}
                  faceConfidence={searchState === 'customer_found' ? 99.8 : liveConfidence}
                  lightingQuality={liveLux}
                  distanceCm={liveDistance}
                  headYaw={liveYaw}
                />

                {/* Top Corner Badge: Scanner Status */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl backdrop-blur-md text-[10px] font-mono border flex items-center gap-1.5 ${
                    searchState === 'customer_found'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : searchState === 'searching_db'
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                      : searchState === 'unregistered'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-black/80 text-neutral-300 border-white/10'
                  }`}>
                    {searchState === 'searching_db' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : searchState === 'customer_found' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>
                      {searchState === 'searching_db'
                        ? 'Inatafuta kwenye mfumo...'
                        : searchState === 'customer_found'
                        ? 'Mteja Ametambuliwa 99.8%'
                        : searchState === 'unregistered'
                        ? 'Uso Haujasajiliwa ⚠️'
                        : 'Ina-track Uso kwa Kamera'}
                    </span>
                  </span>
                </div>

                {/* HUD Mode Switcher */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setHudMode('mesh')}
                    className={`px-2 py-0.5 rounded-lg ${hudMode === 'mesh' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                  >
                    3D Mesh
                  </button>
                  <button
                    type="button"
                    onClick={() => setHudMode('neural_box')}
                    className={`px-2 py-0.5 rounded-lg ${hudMode === 'neural_box' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                  >
                    YOLO
                  </button>
                  <button
                    type="button"
                    onClick={() => setHudMode('liveness_depth')}
                    className={`px-2 py-0.5 rounded-lg ${hudMode === 'liveness_depth' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                  >
                    Depth
                  </button>
                </div>

                {/* SYSTEM SEARCHING OVERLAY (INATAFUTA KWENYE SISTIM) */}
                {searchState === 'searching_db' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center mb-3 shadow-[0_0_30px_#06b6d4]">
                      <Search className="w-8 h-8 animate-pulse" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold uppercase mb-1">
                      Biometric Query Engine
                    </span>
                    <h3 className="text-lg font-black text-white">
                      Inatafuta kwenye mfumo wa PapoPay...
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 max-w-xs">
                      Inalinganisha sura ya mteja na kanzidata ya akaunti (12,450 records)
                    </p>

                    <div className="w-56 bg-white/10 rounded-full h-2 mt-4 overflow-hidden border border-white/20">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${searchProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 mt-1.5">{searchProgress}% Rekodi Zimechanganuliwa</span>
                  </motion.div>
                )}

                {/* UNREGISTERED / NOT ENROLLED ALERT OVERLAY */}
                {searchState === 'unregistered' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 z-30 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center mb-2 shadow-[0_0_35px_#f59e0b] animate-bounce">
                      <UserX className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-black border border-amber-500/40 uppercase mb-1">
                      {activeSubject.hasAccountButNoFace ? 'Akaunti Ipo, Bado Hajaweka Uso ⚠️' : 'Mteja Hajapatikana Kwenye Database ⚠️'}
                    </span>
                    <h3 className="text-xl font-black text-white">
                      {activeSubject.hasAccountButNoFace ? 'HUJAWEKA USO BADO!' : 'USO HAUJASAJILIWA!'}
                    </h3>
                    <p className="text-amber-200 text-xs font-medium mt-1 max-w-xs">
                      {activeSubject.hasAccountButNoFace
                        ? `Mteja huyu (${activeSubject.name}) ana akaunti halali lakini hakusajili uso wake wakati anajisajili. Weka uso wake sasa ili kufanya miamala.`
                        : 'Sura hii haipo kwenye mfumo wa PapoPay. Mteja hawezi kuweka pesa hadi asajiliwe.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsEnrollOpen(true)}
                      className="mt-4 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{activeSubject.hasAccountButNoFace ? 'Weka Uso wa Mteja Sasa (Enroll Face)' : 'Sajili Mteja Mpya kwa Uso Hapa'}</span>
                    </button>
                  </motion.div>
                )}

                {/* Bottom Viewport Banner */}
                {matchedCustomer && searchState === 'customer_found' && (
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
                            VERIFIED
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          Simu: {matchedCustomer.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-neutral-400 block">Salio la Sasa</span>
                      <span className="text-sm font-mono font-bold text-emerald-300">
                        TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SIMULATOR: CHANGE PERSON IN FRONT OF CAMERA */}
              <div className="w-full bg-[#0c1322] p-4 rounded-3xl border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-neutral-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mteja Aliyesimama Mbele ya Kamera ya Wakala:</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">Bofya kugeuza mteja</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        triggerFaceSearch(c);
                        triggerHapticTap();
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                        activeSubject.id === c.id
                          ? c.isRegistered
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                            : 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <img src={c.avatar} alt="Face" className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/20" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate">{c.name.split(' ')[0]}</p>
                        <p className={`text-[9px] font-mono font-bold ${
                          c.isRegistered ? 'text-emerald-400' : c.hasAccountButNoFace ? 'text-amber-300' : 'text-neutral-400'
                        }`}>
                          {c.isRegistered ? '✓ Imesajiliwa' : c.hasAccountButNoFace ? '⚠️ Bado Uso' : '❌ Hajajisajili'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: UNLOCKED WAKALA SERVICES (6 COLS) */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              {matchedCustomer && searchState === 'customer_found' ? (
                <div className="bg-[#0c1322] p-5 sm:p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-5">
                  {/* Verified Customer Header Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-[#0e1c28] border border-emerald-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={matchedCustomer.avatar}
                        alt="Customer Photo"
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-400 shadow-lg shadow-emerald-500/20"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-black text-white">{matchedCustomer.name}</h2>
                          <span className="p-0.5 rounded-full bg-emerald-500 text-neutral-950" title="NIDA Verified">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 font-mono mt-0.5">
                          Simu: <span className="text-emerald-400 font-bold">{matchedCustomer.phone}</span>
                        </p>
                        {matchedCustomer.nidaNumber && (
                          <p className="text-[10px] text-neutral-400 font-mono">
                            NIDA: {matchedCustomer.nidaNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block">Salio la Akaunti</span>
                      <div className="text-lg sm:text-xl font-mono font-black text-emerald-300">
                        TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* SERVICE SELECTION TABS */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                      Chagua Huduma ya Kumpatia Mteja Huyu:
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => { setActiveService('deposit'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all ${
                          activeService === 'deposit'
                            ? 'bg-emerald-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        <span className="text-[10px]">1. Kuweka</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('withdraw'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all ${
                          activeService === 'withdraw'
                            ? 'bg-amber-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="text-[10px]">2. Kutoa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('airtime'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all ${
                          activeService === 'airtime'
                            ? 'bg-purple-500 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span className="text-[10px]">3. Vocha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('bills'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all ${
                          activeService === 'bills'
                            ? 'bg-cyan-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        <span className="text-[10px]">4. Bili</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('statement'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all ${
                          activeService === 'statement'
                            ? 'bg-white/20 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px]">5. Salio</span>
                      </button>
                    </div>
                  </div>

                  {/* SERVICE 1: KUWEKA PESA (CASH-IN) */}
                  {activeService === 'deposit' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Kiasi cha Pesa Mteja Anachotaka Kuweka (TZS):
                        </label>
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-emerald-500/40 px-4 py-3.5 rounded-2xl text-2xl font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[10000, 25000, 50000, 100000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => { setDepositAmount(amt); triggerHapticTap(); }}
                            className="py-2 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300"
                          >
                            {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between text-neutral-400">
                          <span>Mteja Anayepokea:</span>
                          <span className="font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Kamisheni Yako ya Wakala (1.2%):</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +TZS {Math.round(depositAmount * 0.012).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400 pt-2 border-t border-white/10">
                          <span>Float Yako Baada ya Kuweka:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            TZS {(floatBalance - depositAmount).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteDeposit}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        {isProcessingAction ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                        <span>
                          {isProcessingAction ? 'Inaweka Pesa Kwenye Akaunti...' : `Weka TZS ${depositAmount.toLocaleString()} kwa Uso wa Mteja`}
                        </span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 2: KUTOA PESA (CASH-OUT) */}
                  {activeService === 'withdraw' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Kiasi cha Pesa Mteja Anachotaka Kutoa (TZS):
                        </label>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-amber-500/40 px-4 py-3.5 rounded-2xl text-2xl font-mono font-black text-amber-400 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[10000, 20000, 30000, 50000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => { setWithdrawAmount(amt); triggerHapticTap(); }}
                            className="py-2 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300"
                          >
                            {amt/1000}k
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between text-neutral-400">
                          <span>Mteja Anayetoa Pesa:</span>
                          <span className="font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Salio Lake la Sasa:</span>
                          <span className="font-mono text-emerald-400 font-bold">TZS {matchedCustomer.walletBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Kamisheni Yako ya Wakala (1.2%):</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +TZS {Math.round(withdrawAmount * 0.012).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteWithdraw}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        {isProcessingAction ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                        <span>
                          {isProcessingAction ? 'Inaidhinisha Kutoa...' : `Idhinisha Kutoa TZS ${withdrawAmount.toLocaleString()} & Mkabidhi Fedha`}
                        </span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 3: NUNUA VOCHA (AIRTIME) */}
                  {activeService === 'airtime' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-300">Mtandao:</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['Vodacom', 'Tigo', 'Airtel', 'Halotel'] as const).map(net => (
                            <button
                              key={net}
                              type="button"
                              onClick={() => setAirtimeNetwork(net)}
                              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${
                                airtimeNetwork === net
                                  ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                                  : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {net}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">Kiasi cha Vocha (TZS):</label>
                        <input
                          type="number"
                          value={airtimeAmount}
                          onChange={(e) => setAirtimeAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-purple-500/40 px-4 py-3 rounded-2xl font-mono text-xl font-black text-purple-300"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[1000, 2000, 5000, 10000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAirtimeAmount(amt)}
                            className="py-1.5 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 text-neutral-300"
                          >
                            {amt/1000}k
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteAirtime}
                        className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        <Smartphone className="w-5 h-5" />
                        <span>Nunua Vocha ya TZS {airtimeAmount.toLocaleString()} kwa Akaunti ya Mteja</span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 4: LIPA BILI (LUKU / MAJI / AZAMTV) */}
                  {activeService === 'bills' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setBillType('luku')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'luku' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Zap className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                          <span className="text-xs block">LUKU Umeme</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillType('daway')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'daway' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Droplets className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                          <span className="text-xs block">DAWASCO Maji</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillType('azam')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'azam' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Tv className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                          <span className="text-xs block">Azam TV</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          {billType === 'luku' ? 'Namba ya Mita ya LUKU:' : billType === 'daway' ? 'Namba ya Akaunti ya Maji:' : 'Namba ya Smartcard:'}
                        </label>
                        <input
                          type="text"
                          value={billMeterNumber}
                          onChange={(e) => setBillMeterNumber(e.target.value)}
                          className="w-full bg-black/60 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-mono text-sm text-cyan-300"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">Kiasi cha Bili (TZS):</label>
                        <input
                          type="number"
                          value={billAmount}
                          onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-mono text-lg font-bold text-cyan-300"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteBill}
                        className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        <Zap className="w-5 h-5" />
                        <span>Lipia Bili ya TZS {billAmount.toLocaleString()} kwa Uso wa Mteja</span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 5: TAARIFA FUPI & SALIO */}
                  {activeService === 'statement' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="p-4 rounded-2xl bg-black/50 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Jina la Akaunti:</span>
                          <span className="text-xs font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Namba ya Simu:</span>
                          <span className="text-xs font-mono text-cyan-300">{matchedCustomer.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Salio Halisi la Sasa:</span>
                          <span className="text-sm font-mono font-black text-emerald-400">
                            TZS {matchedCustomer.walletBalance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Ufunguo wa Bayometriki:</span>
                          <span className="text-[10px] font-mono text-neutral-300">{matchedCustomer.faceEmbeddingId}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          toast.success(`Taarifa fupi ya ${matchedCustomer.name} imechapishwa!`);
                          speak(`Taarifa ya salio la shilingi ${matchedCustomer.walletBalance.toLocaleString()} imechapishwa.`);
                        }}
                        className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4 text-cyan-400" />
                        <span>Chapisha Karatasi ya Salio (Print Slip)</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : searchState === 'unregistered' ? (
                /* Unregistered / Not Enrolled Customer Prompt Card */
                <div className="bg-[#0c1322] p-6 rounded-3xl border border-amber-500/40 shadow-xl space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <UserX className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {activeSubject.hasAccountButNoFace 
                        ? 'Akaunti Ipo, Lakini Hajaweka Uso Bado' 
                        : 'Mteja Hajajisajili Kwenye Mfumo'}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                      {activeSubject.hasAccountButNoFace
                        ? `Mteja huyu (${activeSubject.name}) ana akaunti halali lakini hakusajili uso wakati anajisajili. Ili aweze kuweka au kutoa pesa, lazima aweke uso wake sasa.`
                        : 'Mfumo wa PapoPay umeshindwa kupata sura hii. Ili aweze kuweka pesa taslimu au kutoa pesa, lazima asajiliwe kwanza na Wakala.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/20 text-left text-xs text-amber-200 space-y-1.5">
                    <p className="font-bold">Hatua za Kuweka Uso Kituoni:</p>
                    <p>1. Bonyeza kitufe cha &quot;{activeSubject.hasAccountButNoFace ? 'Weka Uso wa Mteja Sasa' : 'Sajili Mteja Mpya kwa Uso'}&quot; hapa chini.</p>
                    <p>2. {activeSubject.hasAccountButNoFace ? 'Taarifa za mteja zimejazwa kiotomatiki.' : 'Jaza jina kamili na simu ya mteja.'}</p>
                    <p>3. Piga picha ya uso wake mbele ya kamera.</p>
                    <p>4. Mfumo utamtambua mara moja na kufungua huduma zote za kuweka pesa!</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEnrollOpen(true)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{activeSubject.hasAccountButNoFace ? 'Weka Uso wa Mteja Sasa' : 'Sajili Mteja Mpya kwa Uso Hapa'}</span>
                  </button>
                </div>
              ) : (
                /* Searching DB or Initial Tracking Placeholder */
                <div className="bg-[#0c1322] p-8 rounded-3xl border border-white/10 shadow-xl flex flex-col items-center justify-center text-center space-y-4 min-h-[380px]">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 flex items-center justify-center animate-pulse">
                    <ScanFace className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Inasubiri Utambuzi wa Uso</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                      Mteja anapaswa kuangalia kamera ya Wakala. Mfumo utam-track na kumtafuta kwenye database kiotomatiki.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerFaceSearch(activeSubject)}
                    className="px-5 py-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-300 font-bold text-xs flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Anzisha Utambuzi wa Sasa</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTION LEDGER */}
        {portalMode === 'ledger' && (
          <div className="mt-6 bg-[#0c1322] rounded-3xl border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Kumbukumbu ya Miamala ya Wakala</h3>
                <p className="text-xs text-neutral-400">Miamala yote ya Cash-In na Cash-Out iliyoidhinishwa kwa uso</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                Jumla: {transactions.length} Miamala
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Ref Code</th>
                    <th className="py-3 px-3">Mteja</th>
                    <th className="py-3 px-3">Aina ya Muamala</th>
                    <th className="py-3 px-3 text-right">Kiasi</th>
                    <th className="py-3 px-3 text-right">Kamisheni</th>
                    <th className="py-3 px-3 text-right">Muda</th>
                    <th className="py-3 px-3 text-center">Hali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-cyan-300">{tx.id}</td>
                      <td className="py-3.5 px-3 font-sans font-bold text-white">{tx.customer}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type.includes('Kuweka') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-white">TZS {tx.amount.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-400">+TZS {tx.commission.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right text-neutral-400">{tx.date} {tx.time}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          ✓ Imekamilika
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* FLOAT TOP UP MODAL */}
      <AnimatePresence>
        {isFloatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-6 text-white space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Ongeza Float ya Wakala</h3>
                <button type="button" onClick={() => setIsFloatModalOpen(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">Kiasi cha Kuongeza (TZS):</label>
                <input
                  type="number"
                  value={floatTopUpAmount}
                  onChange={(e) => setFloatTopUpAmount(e.target.value)}
                  className="w-full bg-black/60 border border-cyan-500/30 px-4 py-3 rounded-2xl font-mono text-xl font-bold text-cyan-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[500000, 1000000, 2000000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFloatTopUpAmount(amt.toString())}
                    className="py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold"
                  >
                    {amt/1000000}M
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleTopUpFloat}
                className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase"
              >
                Thibitisha Kuongeza Float
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black">Risiti ya Wakala wa PapoPay</h3>
                <p className="text-[10px] font-mono text-emerald-300">{lastReceipt.id}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">{lastReceipt.type}</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  TZS {lastReceipt.amount.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-300 font-mono mt-0.5">Kamisheni: +TZS {lastReceipt.commission.toLocaleString()}</p>
              </div>

              <div className="space-y-1 text-xs font-mono text-neutral-300 border-t border-b border-white/10 py-2.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mteja:</span>
                  <span className="font-bold text-white">{lastReceipt.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kituo cha Wakala:</span>
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

              <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/receipt/${lastReceipt.id}`} size={80} />
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

      {/* FACE REGISTRATION MODAL FOR UNREGISTERED CUSTOMERS */}
      <FaceRegistrationModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        onSuccess={handleEnrollSuccess}
        initialName={activeSubject.hasAccountButNoFace ? activeSubject.name : "Mteja Mpya"}
        initialPhone={activeSubject.hasAccountButNoFace ? activeSubject.phone : "0755 123 456"}
      />
    </div>
  );
}
