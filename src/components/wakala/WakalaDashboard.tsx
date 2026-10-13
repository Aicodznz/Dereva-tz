import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Banknote, ArrowDownLeft, ArrowUpRight, ScanFace, 
  CheckCircle2, AlertCircle, X, ShieldCheck, RefreshCw, 
  Volume2, VolumeX, Sparkles, UserX, UserPlus, Receipt, 
  Printer, Share2, QrCode, Search, Smartphone, Shield, 
  Check, Clock, Coins, Plus, Trash2, ArrowRight, User, 
  LogOut, Wallet, Building2, Sliders, MapPin, Phone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, BiometricHudMode } from '../papopay/BiometricFaceCanvas';
import { FaceRegistrationModal } from '../papopay/FaceRegistrationModal';
import { toast } from 'sonner';

interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
}

const WAKALA_CLIENTS_DB: SimulatedCustomer[] = [
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

  // Active Wakala Operation Tab
  const [activeTab, setActiveTab] = useState<'cash_in' | 'cash_out' | 'ledger' | 'float_mgmt'>('cash_in');

  // Customer & Camera state
  const [customers, setCustomers] = useState<SimulatedCustomer[]>(WAKALA_CLIENTS_DB);
  const [selectedCustomer, setSelectedCustomer] = useState<SimulatedCustomer>(WAKALA_CLIENTS_DB[0]);
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(30000);

  // Biometric state
  const [verificationPhase, setVerificationPhase] = useState<'idle' | 'align' | 'verifying' | 'success' | 'unregistered'>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

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
    } catch {}
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    speak(`Karibu kwenye Kituo cha Wakala cha PapoPay, ${wakalaProfile.businessName}.`);
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

  // Execute Face Cash-In / Cash-Out
  const handleExecuteOperation = () => {
    if (isVerifying) return;

    const isDeposit = activeTab === 'cash_in';
    const amount = isDeposit ? depositAmount : withdrawAmount;

    if (amount <= 0) {
      toast.error('Weka kiasi sahihi cha pesa!');
      return;
    }

    if (!isDeposit && selectedCustomer.isRegistered && selectedCustomer.walletBalance < amount) {
      toast.error(`Salio la mteja halitoshi! (Salio: TZS ${selectedCustomer.walletBalance.toLocaleString()})`);
      speak("Salio la mteja halitoshi kwa kutoa kiasi hiki.");
      return;
    }

    setIsVerifying(true);
    setVerificationPhase('align');
    speak("Mteja anaombwa kuangalia kamera ya Wakala ili kuhakiki uso.");

    // Check if customer is unregistered
    if (selectedCustomer.isRegistered === false) {
      setTimeout(() => {
        setVerificationPhase('unregistered');
        setIsVerifying(false);
        speak("Samahani, uso wako haujasajiliwa kwenye PapoPay. Tafadhali sajili uso wako kwanza ili kuweka au kutoa pesa.");
        toast.error("Uso Haujasajiliwa! Mteja anapaswa kusajiliwa kwanza kituoni.", { icon: '⚠️' });
      }, 1500);
      return;
    }

    setTimeout(() => {
      setVerificationPhase('verifying');
      speak("Inathibitisha bayometriki ya uso na akaunti ya mteja...");

      setTimeout(() => {
        setVerificationPhase('success');
        setIsVerifying(false);
        playPaymentChime();
        triggerHapticTap();

        const commission = Math.round(amount * 0.012);
        setCommissionEarned(prev => prev + commission);

        if (isDeposit) {
          // Cash-In: Customer gets wallet funds, Agent gives float
          setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: c.walletBalance + amount } : c));
          setSelectedCustomer(prev => ({ ...prev, walletBalance: prev.walletBalance + amount }));
          setFloatBalance(prev => prev - amount + commission);

          speak(`Pesa shilingi ${amount.toLocaleString()} zimewekwa kikamilifu kwa ${selectedCustomer.name.split(' ')[0]}. Kamisheni yako ya Wakala ni shilingi ${commission.toLocaleString()}.`);
          toast.success(`TZS ${amount.toLocaleString()} Zimewekwa kwa Uso! Kamisheni: +TZS ${commission.toLocaleString()}`, { icon: '💰' });
        } else {
          // Cash-Out: Customer wallet deducted, Agent hands physical cash
          setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: c.walletBalance - amount } : c));
          setSelectedCustomer(prev => ({ ...prev, walletBalance: prev.walletBalance - amount }));
          setFloatBalance(prev => prev + amount + commission);

          speak(`Kutoa pesa kwa shilingi ${amount.toLocaleString()} kumethibitishwa. Mkabidhi mteja pesa taslimu.`);
          toast.success(`Kutoa Pesa Kumethibitishwa! Kamisheni: +TZS ${commission.toLocaleString()}`, { icon: '💵' });
        }

        const newTx = {
          id: `WAK-${isDeposit ? 'DEP' : 'WTH'}-${Math.floor(1000 + Math.random() * 9000)}`,
          customer: selectedCustomer.name,
          type: isDeposit ? 'Cash-In (Kuweka)' : 'Cash-Out (Kutoa)',
          amount,
          commission,
          time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
          date: 'Leo',
          status: 'completed'
        };

        setTransactions(prev => [newTx, ...prev]);

        setLastReceipt({
          ...newTx,
          customerPhone: selectedCustomer.phone,
          customerPhoto: selectedCustomer.avatar,
          wakalaId: wakalaProfile.wakalaId,
          businessName: wakalaProfile.businessName
        });

        setTimeout(() => setVerificationPhase('idle'), 3500);

      }, 1600);
    }, 1400);
  };

  // Float top up execution
  const handleTopUpFloat = () => {
    const amt = Number(floatTopUpAmount) || 0;
    if (amt <= 0) return;
    setFloatBalance(prev => prev + amt);
    setIsFloatModalOpen(false);
    toast.success(`Float ya TZS ${amt.toLocaleString()} imeongezwa kikamilifu kwenye kituo chako!`);
    speak(`Float ya shilingi milioni ${amt >= 1000000 ? (amt/1000000).toFixed(1) : (amt/1000)} imeongezwa.`);
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

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col">
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
              <p className="text-[11px] text-neutral-400 mt-0.5">Inapatikana kwa Kuweka (Cash-In)</p>
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
              <p className="text-[11px] text-emerald-300/80 mt-0.5">Kamisheni ya 1.2% ya Miamala</p>
            </div>
            <button
              type="button"
              onClick={handleWithdrawCommission}
              className="mt-2 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Toa Kamisheni kwenda Simuni</span>
            </button>
          </div>

          {/* Card 3: Cash-In Completed */}
          <div className="p-5 rounded-3xl bg-[#0e1424] border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-neutral-400">Kuweka Pesa (Cash-In)</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black font-mono text-white">
                {transactions.filter(t => t.type.includes('Kuweka')).length} Miamala
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Uthibitisho wa Uso Papo Hapo</p>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono font-bold">100% Salama (Anti-Spoofing)</span>
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
                {transactions.filter(t => t.type.includes('Kutoa')).length} Miamala
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Bila Kadi wala Simu Mkononi</p>
            </div>
            <span className="text-[11px] text-amber-400 font-mono font-bold">Smile-to-Withdraw Active</span>
          </div>
        </div>

        {/* OPERATION TABS (CASH-IN / CASH-OUT / LEDGER) */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_in');
              triggerHapticTap();
              speak("Terminal ya kuweka pesa kwa uso.");
            }}
            className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'cash_in'
                ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30'
                : 'bg-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>1. Kuweka Pesa (Face Cash-In)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_out');
              triggerHapticTap();
              speak("Terminal ya kutoa pesa kwa uso.");
            }}
            className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'cash_out'
                ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/30'
                : 'bg-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>2. Kutoa Pesa (Face Cash-Out)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ledger');
              triggerHapticTap();
            }}
            className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'ledger'
                ? 'bg-cyan-500 text-neutral-950 shadow-lg shadow-cyan-500/30'
                : 'bg-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>3. Kumbukumbu ya Miamala ({transactions.length})</span>
          </button>
        </div>

        {/* TAB CONTENT: TERMINAL (CASH-IN & CASH-OUT) */}
        {(activeTab === 'cash_in' || activeTab === 'cash_out') && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: LIVE BIOMETRIC CAMERA (7 COLS) */}
            <div className="lg:col-span-7 flex flex-col items-center space-y-4">
              <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden border-4 border-emerald-500/40 bg-black flex items-center justify-center shadow-2xl shadow-emerald-950/60">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />

                {/* Biometric Face Mesh HUD */}
                <BiometricFaceCanvas
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
                  faceConfidence={selectedCustomer.isRegistered ? 99.4 : 0}
                  lightingQuality={94}
                  distanceCm={42}
                />

                {/* Top Corner Badge */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md text-[10px] font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Wakala Face Terminal 3.0</span>
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
                      Mteja Hajajisajili Kwenye PapoPay ⚠️
                    </span>
                    <h3 className="text-xl font-black text-white">
                      USO HAUJASAJILIWA!
                    </h3>
                    <p className="text-amber-200 text-xs font-medium mt-1 max-w-xs">
                      Mteja huyu bado hajasajili bayometriki yake. Bofya kitufe cha chini kumsajili hapo hapo kituoni.
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsEnrollOpen(true)}
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
                      UTAMBUZI WA USO UMEKAMILIKA!
                    </h3>
                    <p className="text-emerald-300 text-xs font-bold mt-1">
                      {selectedCustomer.name} &bull; Biometric Verified 99.8%
                    </p>
                  </motion.div>
                )}

                {/* Bottom Customer Info inside Camera Viewport */}
                <div className="absolute bottom-3 inset-x-3 z-20 bg-black/85 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={selectedCustomer.avatar}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-emerald-400"
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
                    <span className="text-sm font-mono font-bold text-emerald-300">
                      TZS {selectedCustomer.walletBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Simulator Switcher */}
              <div className="w-full bg-[#0c1322] p-3.5 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 block">
                  Chagua Mteja wa Kujaribu Mbele ya Kamera ya Wakala:
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
                        speak(`Mteja: ${c.name.split(' ')[0]}`);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        selectedCustomer.id === c.id
                          ? c.isRegistered
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xs'
                            : 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-xs'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <img src={c.avatar} alt="Face" className="w-8 h-8 rounded-full object-cover shrink-0" />
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

            {/* RIGHT: CASH-IN / CASH-OUT OPERATION CARD (5 COLS) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              <div className="bg-[#0c1322] p-6 rounded-3xl border border-emerald-500/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      activeTab === 'cash_in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {activeTab === 'cash_in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        {activeTab === 'cash_in' ? 'Kuweka Pesa (Face Cash-In)' : 'Kutoa Pesa (Face Cash-Out)'}
                      </h3>
                      <p className="text-xs text-neutral-400">
                        {activeTab === 'cash_in' ? 'Mteja anatoa pesa taslimu' : 'Mteja anapokea pesa taslimu'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    activeTab === 'cash_in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {activeTab === 'cash_in' ? 'Deposit' : 'Withdraw'}
                  </span>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Kiasi cha Pesa (TZS):
                  </label>
                  <input
                    type="number"
                    value={activeTab === 'cash_in' ? depositAmount : withdrawAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      if (activeTab === 'cash_in') setDepositAmount(val);
                      else setWithdrawAmount(val);
                    }}
                    className={`w-full bg-black/60 border px-4 py-3.5 rounded-2xl text-2xl font-mono font-black focus:outline-none ${
                      activeTab === 'cash_in' ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400'
                    }`}
                  />
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[10000, 25000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        if (activeTab === 'cash_in') setDepositAmount(amt);
                        else setWithdrawAmount(amt);
                        triggerHapticTap();
                      }}
                      className="py-2 px-1 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 transition-colors"
                    >
                      {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                    </button>
                  ))}
                </div>

                {/* Summary Table */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Mteja:</span>
                    <span className="font-bold text-white">{selectedCustomer.name}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Kamisheni Yako ya Wakala (1.2%):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +TZS {Math.round((activeTab === 'cash_in' ? depositAmount : withdrawAmount) * 0.012).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400 pt-2 border-t border-white/10">
                    <span>Salio la Float Baada ya Muamala:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      TZS {(activeTab === 'cash_in' ? floatBalance - depositAmount : floatBalance + withdrawAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Trigger Button */}
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={handleExecuteOperation}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60 text-neutral-950 ${
                    activeTab === 'cash_in'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/25'
                  }`}
                >
                  {isVerifying ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ScanFace className="w-5 h-5" />
                  )}
                  <span>
                    {isVerifying
                      ? 'Inasoma Uso wa Mteja...'
                      : activeTab === 'cash_in'
                      ? `Thibitisha Kuweka TZS ${depositAmount.toLocaleString()} kwa Uso`
                      : `Thibitisha Kutoa TZS ${withdrawAmount.toLocaleString()} kwa Uso`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSACTION LEDGER */}
        {activeTab === 'ledger' && (
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

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toast.success("Risiti imetumwa kwa WhatsApp ya mteja!")}
                  className="py-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLastReceipt(null)}
                  className="py-2.5 rounded-xl bg-emerald-500 text-neutral-950 font-black text-xs uppercase"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOMER ENROLLMENT MODAL */}
      <FaceRegistrationModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        initialName="Mteja Mpya Kituoni"
        initialPhone="0769 000 111"
        onSuccess={(regData) => {
          const newCust = {
            id: `cust_${Date.now()}`,
            name: regData.name,
            phone: regData.phone,
            walletBalance: 0,
            faceEmbeddingId: regData.embeddingId,
            avatar: regData.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isRegistered: true
          };
          setCustomers(prev => [newCust, ...prev]);
          setSelectedCustomer(newCust);
          setVerificationPhase('idle');
          toast.success(`Uso wa ${regData.name} umesajiliwa kikamilifu kituoni!`);
          speak(`Uso wa ${regData.name.split(' ')[0]} umesajiliwa kikamilifu.`);
        }}
      />
    </div>
  );
}
