import React, { useState, useEffect } from 'react';
import { 
  Wallet, QrCode, CreditCard, ArrowUpRight, ArrowDownLeft, 
  Send, Users, Receipt, Zap, ShieldCheck, History, Bus, 
  CheckCircle2, AlertCircle, Copy, Check, ChevronRight, 
  Phone, Sparkles, Lock, RefreshCw, Eye, EyeOff, Plus, 
  Search, ExternalLink, ArrowLeft, Smartphone, Radio, 
  GraduationCap, Bell, Download, Share2, Info, ChevronDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';

export type PapoPayTab = 'transit' | 'scan_pay' | 'student_card' | 'send_split' | 'bills' | 'history';

interface StudentCard {
  id: string;
  studentName: string;
  schoolName: string;
  cardNumber: string;
  balance: number;
  dailyLimit: number;
  status: 'active' | 'frozen';
  avatarColor: string;
  recentTrips: {
    id: string;
    route: string;
    busPlate: string;
    fare: number;
    time: string;
    date: string;
    status: 'completed';
  }[];
}

interface TransactionItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'debit' | 'credit';
  category: 'transit' | 'student' | 'bill' | 'transfer' | 'topup' | 'merchant';
  date: string;
  time: string;
  refCode: string;
  status: 'completed' | 'pending';
  meta?: any;
}

export default function PapoPayHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const { language } = useLanguage();

  // Tab management
  const initialTab = (searchParams.get('tab') as PapoPayTab) || 'transit';
  const [activeTab, setActiveTab] = useState<PapoPayTab>(initialTab);

  // Balance state synced with localStorage & profile
  const [balance, setBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('papopay_wallet_balance');
      if (saved) return Number(saved);
      if (profile?.walletBalance !== undefined) return profile.walletBalance;
    } catch {}
    return 34500;
  });

  const [coinsBalance, setCoinsBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('papopay_coins_balance');
      if (saved) return Number(saved);
      if (profile?.points !== undefined) return profile.points;
    } catch {}
    return 240;
  });

  const [showBalance, setShowBalance] = useState(true);

  // Sync to storage
  useEffect(() => {
    try {
      localStorage.setItem('papopay_wallet_balance', balance.toString());
      localStorage.setItem('papopay_coins_balance', coinsBalance.toString());
    } catch {}
  }, [balance, coinsBalance]);

  // Modals state
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionItem | null>(null);
  const [isRegisterStudentModalOpen, setIsRegisterStudentModalOpen] = useState(false);
  const [isOfflineUssdModalOpen, setIsOfflineUssdModalOpen] = useState(false);

  // Top Up form state
  const [topUpAmount, setTopUpAmount] = useState('10000');
  const [topUpMethod, setTopUpMethod] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | 'card'>('mpesa');
  const [topUpPhone, setTopUpPhone] = useState(profile?.phoneNumber || '0754 123 456');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // Tap & Go NFC Simulator
  const [isNfcSimulating, setIsNfcSimulating] = useState(false);
  const [nfcSuccess, setNfcSuccess] = useState(false);

  // Student Smart Cards State
  const [studentCards, setStudentCards] = useState<StudentCard[]>(() => {
    try {
      const saved = localStorage.getItem('papopay_student_cards');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'std_01',
        studentName: 'Baraka Juma Mkuki',
        schoolName: 'Shule ya Sekondari Azania (Form 3)',
        cardNumber: 'TZ-STD-99042',
        balance: 4200,
        dailyLimit: 800,
        status: 'active',
        avatarColor: 'from-blue-600 to-indigo-700',
        recentTrips: [
          {
            id: 'trip_1',
            route: 'Mbagala Rangi Tatu ➔ Posta Mpya',
            busPlate: 'T 342 DFP (Daladala)',
            fare: 200,
            time: 'Leo, Saa 07:15 Asubuhi',
            date: '09 Okt 2026',
            status: 'completed'
          },
          {
            id: 'trip_2',
            route: 'Posta Mpya ➔ Mbagala Rangi Tatu',
            busPlate: 'T 512 EBB (Daladala)',
            fare: 200,
            time: 'Jana, Saa 04:30 Jioni',
            date: '08 Okt 2026',
            status: 'completed'
          }
        ]
      },
      {
        id: 'std_02',
        studentName: 'Fatma Ally Rashid',
        schoolName: 'Shule ya Msingi Bunge (Dar)',
        cardNumber: 'TZ-STD-77819',
        balance: 2600,
        dailyLimit: 600,
        status: 'active',
        avatarColor: 'from-pink-600 to-rose-700',
        recentTrips: [
          {
            id: 'trip_3',
            route: 'Kariakoo Gerezani ➔ Buguruni Rozana',
            busPlate: 'T 119 CSG (Daladala)',
            fare: 200,
            time: 'Leo, Saa 06:50 Asubuhi',
            date: '09 Okt 2026',
            status: 'completed'
          }
        ]
      }
    ];
  });

  // Save student cards to storage
  useEffect(() => {
    try {
      localStorage.setItem('papopay_student_cards', JSON.stringify(studentCards));
    } catch {}
  }, [studentCards]);

  // Transactions State
  const [transactions, setTransactions] = useState<TransactionItem[]>(() => {
    try {
      const saved = localStorage.getItem('papopay_transactions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'tx_101',
        title: 'Nauli ya Daladala: T 482 DFP',
        subtitle: 'Kivukoni ➔ Mwenge Kituoni (Konda ID: KD-92)',
        amount: 600,
        type: 'debit',
        category: 'transit',
        date: 'Leo',
        time: '12:35 Jioni',
        refCode: 'PAPO-TR-884210',
        status: 'completed',
        meta: { route: 'Kivukoni - Mwenge', plate: 'T 482 DFP', passengerType: 'Mtu Mzima' }
      },
      {
        id: 'tx_102',
        title: 'Kadi ya Mwanafunzi: Baraka Juma',
        subtitle: 'Mbagala ➔ Posta (Nauli ya Mwanafunzi TZS 200)',
        amount: 200,
        type: 'debit',
        category: 'student',
        date: 'Leo',
        time: '07:15 Asubuhi',
        refCode: 'PAPO-STD-99014',
        status: 'completed',
        meta: { student: 'Baraka Juma Mkuki', school: 'Azania High', plate: 'T 342 DFP' }
      },
      {
        id: 'tx_103',
        title: 'Weka Salio (M-Pesa Deposit)',
        subtitle: 'Muamala kutoka Vodacom M-Pesa 0754***456',
        amount: 25000,
        type: 'credit',
        category: 'topup',
        date: 'Jana',
        time: '09:20 Usiku',
        refCode: 'PAPO-DEP-77312',
        status: 'completed',
        meta: { method: 'Vodacom M-Pesa', channel: 'Mobile Money Gateway' }
      },
      {
        id: 'tx_104',
        title: 'Tokeni ya LUKU (TANESCO)',
        subtitle: 'Mita: 1428-9902-114 (Unit 24.5 kWh)',
        amount: 10000,
        type: 'debit',
        category: 'bill',
        date: '07 Okt',
        time: '03:14 Alasiri',
        refCode: 'PAPO-LUKU-55219',
        status: 'completed',
        meta: { meter: '1428-9902-114', token: '4829-1029-4471-8890' }
      },
      {
        id: 'tx_105',
        title: 'Lipa Namba ya Muuzaji (Kariakoo)',
        subtitle: 'Duka la Viatu na Nguo (Lipa Namba: 882910)',
        amount: 14500,
        type: 'debit',
        category: 'merchant',
        date: '06 Okt',
        time: '01:45 Jioni',
        refCode: 'PAPO-MER-31290',
        status: 'completed',
        meta: { merchant: 'Kariakoo Smart Shoes', till: '882910' }
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('papopay_transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  // Handle Top-Up Execution
  const handleExecuteTopUp = () => {
    const val = Number(topUpAmount);
    if (!val || val <= 0) {
      toast.error('Tafadhali ingiza kiasi sahihi cha fedha.');
      return;
    }
    setIsProcessingTopUp(true);

    setTimeout(() => {
      setBalance(prev => prev + val);
      // Give cashback rewards
      const earnedCoins = Math.floor(val / 1000) * 5;
      setCoinsBalance(prev => prev + earnedCoins);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Weka Salio (${topUpMethod.toUpperCase()})`,
        subtitle: `Imepokelewa kutoka namba ${topUpPhone}`,
        amount: val,
        type: 'credit',
        category: 'topup',
        date: 'Sasa Hivi',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `PAPO-TOP-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed',
        meta: { method: topUpMethod, phone: topUpPhone }
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsProcessingTopUp(false);
      setIsTopUpModalOpen(false);
      toast.success(`🎉 TZS ${val.toLocaleString()} zimewekwa kwenye PapoPay yako kikamilifu! Pamoja na sarafu +${earnedCoins} za zawadi.`);
    }, 1500);
  };

  // Handle Instant Transit Fare Payment
  const handlePayDaladalaFare = (route: string, busPlate: string, fareAmount: number, isStudent = false) => {
    if (balance < fareAmount) {
      toast.error(`Salio lako halitoshi (Una TZS ${balance.toLocaleString()}). Tafadhali weka salio kwanza!`);
      setIsTopUpModalOpen(true);
      return;
    }

    setBalance(prev => prev - fareAmount);
    const newTx: TransactionItem = {
      id: `tx_${Date.now()}`,
      title: isStudent ? `Nauli ya Mwanafunzi (${busPlate})` : `Nauli ya Daladala: ${busPlate}`,
      subtitle: `${route} • Malipo ya PapoPay QR / NFC`,
      amount: fareAmount,
      type: 'debit',
      category: isStudent ? 'student' : 'transit',
      date: 'Sasa Hivi',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      refCode: `PAPO-FARE-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'completed',
      meta: { route, busPlate, fare: fareAmount, isStudent }
    };

    setTransactions(prev => [newTx, ...prev]);
    setSelectedReceipt(newTx);
    setIsReceiptModalOpen(true);
    toast.success(`✅ Nauli ya TZS ${fareAmount.toLocaleString()} imelipwa kwa ${busPlate}! Risiti ya kielektroniki imeandaliwa.`);
  };

  // NFC Tap & Go Simulation
  const handleTriggerNfcTap = () => {
    setIsNfcSimulating(true);
    setNfcSuccess(false);

    setTimeout(() => {
      setIsNfcSimulating(false);
      setNfcSuccess(true);
      handlePayDaladalaFare('Mbagala ➔ Posta (NFC Tap & Go)', 'T 412 DFP (Daladala)', 600, false);
      setTimeout(() => setNfcSuccess(false), 3000);
    }, 1800);
  };

  // Top Up Student Card
  const handleTopUpStudentCard = (cardId: string, amount: number) => {
    if (balance < amount) {
      toast.error('Salio la pochi yako kuu halitoshi kuongeza kadi hii.');
      setIsTopUpModalOpen(true);
      return;
    }

    setBalance(prev => prev - amount);
    setStudentCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, balance: c.balance + amount };
      }
      return c;
    }));

    const card = studentCards.find(c => c.id === cardId);
    const newTx: TransactionItem = {
      id: `tx_${Date.now()}`,
      title: `Ongeza Salio Kadi ya Mwanafunzi`,
      subtitle: `${card?.studentName || 'Mwanafunzi'} (${card?.cardNumber})`,
      amount: amount,
      type: 'debit',
      category: 'student',
      date: 'Sasa Hivi',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      refCode: `PAPO-STDTOP-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'completed'
    };
    setTransactions(prev => [newTx, ...prev]);

    toast.success(`🎉 TZS ${amount.toLocaleString()} zimewekwa kwenye kadi ya ${card?.studentName}! Safari takribani ${Math.floor(amount / 200)} zimehifadhiwa.`);
  };

  // Toggle freeze on student card
  const handleToggleFreezeCard = (cardId: string) => {
    setStudentCards(prev => prev.map(c => {
      if (c.id === cardId) {
        const nextStatus = c.status === 'active' ? 'frozen' : 'active';
        toast.info(nextStatus === 'frozen' 
          ? `Kadi ya ${c.studentName} imesimamishwa (Frozen). Hakuna nauli itakatwa mpaka uifungue.`
          : `Kadi ya ${c.studentName} imefunguliwa na iko tayari kulipia nauli tena.`
        );
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-100/70 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pb-32 font-sans select-none">
      
      {/* 1. TOP FINTECH APP BAR */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-950 text-white pt-3 pb-6 px-4 shadow-xl border-b border-emerald-600/30">
        <div className="max-w-3xl mx-auto">
          
          <div className="flex items-center justify-between gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Rudi</span>
            </button>

            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-black tracking-widest uppercase text-emerald-300">
                PAPOPAY 🇹🇿 HAKUNA MAKATO
              </span>
            </div>

            <button
              onClick={() => setIsOfflineUssdModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 px-2.5 py-1.5 rounded-full border border-amber-400/30 transition-all"
              title="Bila Bando / USSD"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bila Bando (*150*88#)</span>
              <span className="sm:hidden">USSD</span>
            </button>
          </div>

          {/* 2. PAPOPAY WALLET CARD (Hero Element) */}
          <div className="mt-4 rounded-3xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 border border-emerald-500/30 p-4 sm:p-6 shadow-2xl relative overflow-hidden text-white">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Card Header & Security Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      PapoPay Super Wallet
                    </h2>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      ID: {profile?.phoneNumber ? `TZ-${profile.phoneNumber.slice(-4)}` : 'TZ-8849-01'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold text-neutral-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>BOT Regulated</span>
                  </div>
                  <button 
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 transition-colors"
                    title={showBalance ? 'Ficha Salio' : 'Onyesha Salio'}
                  >
                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Balances Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Salio Linalopatikana (Available Balance)
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                      {showBalance ? `TZS ${balance.toLocaleString()}` : '••••••••'}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">TSH</span>
                  </div>
                  <p className="text-[11px] text-emerald-300/80 font-medium mt-0.5">
                    Tayari kwa Nauli, Daladala, BRT & Malipo ya Madukani
                  </p>
                </div>

                <div className="sm:border-l sm:border-white/10 sm:pl-4 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Sarafu za Zawadi (Papo Coins)
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                      {showBalance ? coinsBalance : '•••'}
                    </span>
                    <span className="text-[11px] font-bold text-amber-200/70">
                      ≈ TZS {(coinsBalance * 10).toLocaleString()} discount
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Pata pointi 5 kwa kila TZS 1,000 unazolipia nauli!
                  </span>
                </div>
              </div>

              {/* Fast Action Buttons Grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white group shadow-md"
                >
                  <Plus className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight">Weka Salio</span>
                </button>

                <button
                  onClick={() => setActiveTab('transit')}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-white group border border-white/5"
                >
                  <Bus className="w-5 h-5 mb-1 text-sky-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight">Lipa Nauli</span>
                </button>

                <button
                  onClick={() => setActiveTab('scan_pay')}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-white group border border-white/5"
                >
                  <QrCode className="w-5 h-5 mb-1 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight">Scan QR</span>
                </button>

                <button
                  onClick={() => setActiveTab('student_card')}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-white group border border-white/5"
                >
                  <GraduationCap className="w-5 h-5 mb-1 text-pink-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tight">Mwanafunzi</span>
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* 3. NAVIGATION PILL TABS */}
      <div className="max-w-3xl mx-auto px-4 -mt-3 relative z-20">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200/80 dark:border-neutral-800 p-1.5 flex gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'transit', label: 'Lipa Nauli & Daladala 🚌', icon: Bus },
            { id: 'student_card', label: 'Kadi ya Mwanafunzi 🎓', icon: GraduationCap },
            { id: 'scan_pay', label: 'Scan & Lipa Namba 📲', icon: QrCode },
            { id: 'send_split', label: 'Tuma & Gawana 🤝', icon: Send },
            { id: 'bills', label: 'LUKU & Bili ⚡', icon: Zap },
            { id: 'history', label: 'Miamala 📜', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as PapoPayTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA PER TAB */}
      <div className="max-w-3xl mx-auto px-4 mt-5 space-y-4">

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: TRANSIT & DALADALA PAY (TAP & GO, DALADALA QR, LIVE BUSES) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'transit' && (
          <div className="space-y-4">
            
            {/* NFC Tap & Go Smart Card Simulator Banner */}
            <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white p-5 border border-indigo-500/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-400/30">
                      NFC TAP & GO • HAKUNA CHENJI
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    Gusisha Kulipia Nauli (Tap & Pay)
                  </h3>
                  <p className="text-xs text-neutral-300 max-w-md leading-relaxed">
                    Ukiwa ndani ya Daladala au BRT Mwendokasi, gusisha simu yako au kadi ya PapoPay kwenye kifaa cha konda. Nauli inakatwa sekunde 0.5 bila intaneti!
                  </p>
                </div>

                <button
                  onClick={handleTriggerNfcTap}
                  disabled={isNfcSimulating}
                  className={`w-full sm:w-auto px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all ${
                    nfcSuccess
                      ? 'bg-emerald-500 text-white'
                      : isNfcSimulating
                      ? 'bg-indigo-400 text-white cursor-wait animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 active:scale-95'
                  }`}
                >
                  {nfcSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Imelipwa TZS 600!</span>
                    </>
                  ) : isNfcSimulating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Inasoma NFC POS...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      <span>Jaribu Tap & Go Sasa</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Daladala Fare Payment Cards (Real Dar es Salaam Routes) */}
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-neutral-900 dark:text-white flex items-center gap-2">
                    <Bus className="w-4 h-4 text-emerald-600" />
                    <span>Lipa Nauli ya Daladala Uliyomo</span>
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Chagua daladala au ingiza namba ya usajili ya gari kulipa konda moja kwa moja
                  </p>
                </div>
                <button
                  onClick={() => navigate('/daladala')}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <span>Tazama Ramani ya Daladala</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Daladala Options List */}
              <div className="space-y-2.5">
                {[
                  {
                    plate: 'T 482 DFP',
                    route: 'Kivukoni ➔ Mwenge Kituoni',
                    conductor: 'Konda: Juma Omari',
                    fare: 600,
                    badge: 'RUTI POPULARI',
                    color: 'from-blue-500 to-indigo-600'
                  },
                  {
                    plate: 'T 912 DKT',
                    route: 'Mbagala Rangi Tatu ➔ Kariakoo Gerezani',
                    conductor: 'Konda: Selemani Kiduku',
                    fare: 700,
                    badge: 'FAST PASS',
                    color: 'from-emerald-500 to-teal-700'
                  },
                  {
                    plate: 'T 234 CCB',
                    route: 'Kimara Mwisho ➔ Posta Mpya (BRT Mwendokasi)',
                    conductor: 'Lango la Geti la Smart Card',
                    fare: 800,
                    badge: 'MWENDOKASI',
                    color: 'from-orange-500 to-amber-600'
                  },
                  {
                    plate: 'T 771 EGX',
                    route: 'Ubungo Simu 2000 ➔ Tegeta Nyuki',
                    conductor: 'Konda: Hamisi Ally',
                    fare: 600,
                    badge: 'STAND BY',
                    color: 'from-purple-500 to-pink-600'
                  }
                ].map((bus, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bus.color} text-white flex items-center justify-center font-black text-xs shadow-md shrink-0`}>
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                            {bus.plate}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            {bus.badge}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                          {bus.route}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {bus.conductor}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 uppercase font-bold block">Nauli</span>
                        <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                          TZS {bus.fare}
                        </span>
                      </div>

                      <button
                        onClick={() => handlePayDaladalaFare(bus.route, bus.plate, bus.fare, false)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
                      >
                        Lipa Sasa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Why PapoPay Transit Works in Tanzania */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-200">
                  Hakuna Kero ya Chenji
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Epuka ugomvi wa "Konda hana sarafu" au kutelekezwa kituo kisicho chako.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-200">
                  Risiti ya TRA & LATRA
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Kila nauli inatengeneza stakabadhi halali ya kielektroniki yenye namba ya basi.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-200">
                  Papo CashBack & Rewards
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Pata sarafu na punguzo la nauli unapolipa kwa PapoPay kila siku.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: KADI YA MWANAFUNZI (STUDENT TRANSIT CARD MANAGEMENT) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'student_card' && (
          <div className="space-y-4">
            
            {/* Header info */}
            <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-pink-800 text-white rounded-3xl p-5 shadow-xl space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-6 h-6 text-pink-200" />
                  <span className="text-xs font-black tracking-widest uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                    KADI YA SMART YA MWANAFUNZI 🇹🇿
                  </span>
                </div>
                <span className="text-xs font-bold text-pink-200">Nauli: TZS 200 tu</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black">
                Ulinzi na Usafiri Salama wa Watoto na Wanafunzi
              </h3>
              <p className="text-xs text-pink-100 max-w-xl leading-relaxed">
                Wanafunzi hawahitaji kubeba simu janja wala noti zinazoweza kupotea. Wape kadi ya NFC (au wristband). Mzazi anajua kituo alichopanda, daladala aliyopanda, na kupokea SMS papo hapo!
              </p>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setIsRegisterStudentModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white text-pink-700 hover:bg-pink-50 font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sajili Kadi Mpya ya Mwanafunzi</span>
                </button>
              </div>
            </div>

            {/* List of Registered Student Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Kadi Zilizounganishwa na Akaunti Yako ({studentCards.length})
              </h4>

              {studentCards.map((card) => (
                <div 
                  key={card.id}
                  className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4"
                >
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${card.avatarColor} text-white flex items-center justify-center font-black text-base shadow-md`}>
                        {card.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-neutral-900 dark:text-white">
                            {card.studentName}
                          </h4>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            card.status === 'active' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          }`}>
                            {card.status === 'active' ? 'INAFANYA KAZI' : 'IMESIMAMISHWA'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                          {card.schoolName}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-400">
                          Kadi No: {card.cardNumber}
                        </p>
                      </div>
                    </div>

                    {/* Freeze toggle */}
                    <button
                      onClick={() => handleToggleFreezeCard(card.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                        card.status === 'active'
                          ? 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {card.status === 'active' ? 'Fungia Kadi ❄️' : 'Fungua Kadi 🔓'}
                    </button>
                  </div>

                  {/* Card Balance & Top Up */}
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                        Salio la Kadi (Inatosha safari {Math.floor(card.balance / 200)})
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black font-mono text-neutral-900 dark:text-white">
                          TZS {card.balance.toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          (Kikomo: TZS {card.dailyLimit}/siku)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {[1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => handleTopUpStudentCard(card.id, amt)}
                          className="px-2.5 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 hover:bg-pink-100 border border-pink-200/60 dark:border-pink-900/40 text-xs font-black transition-all"
                        >
                          +{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent Trips Manifest for Parent Oversight */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-2">
                      Safari za Hivi Karibuni (Arifa za Mzazi)
                    </span>
                    <div className="space-y-1.5">
                      {card.recentTrips.map(trip => (
                        <div 
                          key={trip.id}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <Bus className="w-3.5 h-3.5 text-pink-600" />
                            <div>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200 block">
                                {trip.route}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {trip.busPlate} • {trip.time}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            -TZS {trip.fare}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SCAN QR & LIPA NAMBA (MERCHANT, DALADALA QR, GENERATOR) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'scan_pay' && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* QR Code ya Kupokea Malipo (My Personal PapoPay QR) */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  QR YAKO YA PAPOPAY 📲
                </span>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Onyesha Konda au Mfanyabiashara Ascani
                </h3>
                <p className="text-xs text-neutral-500 max-w-xs">
                  Hakuna haja ya kutoa fedha taslimu. Konda atascan hii QR na nauli ya TZS 600 itakatwa papo hapo.
                </p>

                {/* QR Code Graphic using qrcode.react */}
                <div className="p-4 bg-white rounded-2xl shadow-md border-2 border-emerald-500/30 flex items-center justify-center">
                  <QRCodeSVG 
                    value={`papopay:pay?uid=${user?.uid || 'user_tz_01'}&phone=${profile?.phoneNumber || '0754123456'}&name=${profile?.displayName || 'Mteja'}`} 
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`PAPOPAY-${profile?.phoneNumber || '0754123456'}`);
                      toast.success('PapoPay ID imenakiliwa!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Nakili Namba Yangu</span>
                  </button>
                </div>
              </div>

              {/* Lipa kwa Lipa Namba ya PapoPay (Merchant / Till Number) */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                  LIPA KWA TILL / LIPA NAMBA
                </span>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Ingiza Lipa Namba ya PapoPay
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Lipia madukani Kariakoo, Mlimani City, supermarket, genge au mgahawa bila makato ya mtandao.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Lipa Namba ya Muuzaji (Digits 5 - 6)
                    </label>
                    <input 
                      type="number"
                      placeholder="Mfano: 882910"
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Kiasi cha Kulipa (TZS)
                    </label>
                    <input 
                      type="number"
                      placeholder="Mfano: 5000"
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      toast.success('Malipo yamefanikiwa kwa Lipa Namba ya PapoPay!');
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Thibitisha & Lipa Bila Makato
                  </button>
                </div>

                {/* Popular Lipa Namba Merchants in Tanzania */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1.5">
                    Wafanyabiashara Maarufu
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Kariakoo Mall (882910)', 'Papo Hapo Mart (99140)', 'Mwenge Pharmacy (44120)'].map(m => (
                      <span key={m} className="text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md text-neutral-600 dark:text-neutral-400">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: TUMA PESA & GAWANA NAULI (P2P & SPLIT FARE) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'send_split' && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Gawana Nauli (Split Fare with Friends) */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Gawana Nauli (Split Ride Fare)
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Mmekodi taksi au bodaboda pamoja? Gawana gharama kwa mbofyo mmoja.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">Jumla ya Nauli:</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">TZS 12,000</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">Watu mnaogawana:</span>
                    <span className="font-bold text-neutral-900 dark:text-white">Watu 3 (Wewe + Marafiki 2)</span>
                  </div>
                  <div className="border-t border-indigo-200/60 dark:border-indigo-900/60 pt-2 flex justify-between items-center text-xs">
                    <span className="font-black text-neutral-800 dark:text-neutral-200">Kila Mtu Atalipa:</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">TZS 4,000</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    toast.success('Ombi la malipo limetumwa kwa marafiki zako via PapoPay & SMS!');
                  }}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Tuma Ombi la Gawana Nauli
                </button>
              </div>

              {/* Tuma Pesa Papo kwa Papo (0% Fee Transfer) */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Tuma Fedha Papo kwa Papo
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Tuma bure kwenda namba yoyote ya simu au PapoPay ID bila makato ya tozo.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Namba ya Simu ya Mpokeaji
                    </label>
                    <input 
                      type="tel"
                      placeholder="0754 xxx xxx"
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Kiasi (TZS)
                    </label>
                    <input 
                      type="number"
                      placeholder="5000"
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      toast.success('Fedha zimetumwa kikamilifu!');
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Tuma Fedha Papo Hapo
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: LUKU, BILLS & UTILITIES */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span>Lipa Bili za Nyumbani & Serikali (GePG)</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Pokea token ya umeme LUKU sekunde 2 baada ya kulipa, au lipa maji DAWASCO na faini za trafiki.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'luku', name: 'LUKU (TANESCO)', icon: Zap, color: 'from-amber-500 to-orange-600' },
                  { id: 'dawasco', name: 'Maji (DAWASCO)', icon: Receipt, color: 'from-blue-500 to-cyan-600' },
                  { id: 'police', name: 'Faini za Polisi (TMS)', icon: ShieldCheck, color: 'from-red-500 to-rose-700' },
                  { id: 'dstv', name: 'Azam TV / DSTV', icon: Smartphone, color: 'from-purple-500 to-indigo-600' }
                ].map((bill) => {
                  const Icon = bill.icon;
                  return (
                    <button
                      key={bill.id}
                      onClick={() => {
                        toast.info(`Huduma ya ${bill.name} iko tayari! Ingiza namba ya kumbukumbu.`);
                      }}
                      className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex flex-col items-center text-center group transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bill.color} text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {bill.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* LUKU Fast Meter Form */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Nunua Tokeni ya LUKU Papo Hapo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="number"
                    placeholder="Namba ya Mita (e.g. 14289902114)"
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-mono font-bold"
                  />
                  <input 
                    type="number"
                    placeholder="Kiasi cha Shilingi (min 2,000)"
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <button
                  onClick={() => {
                    toast.success('Tokeni ya LUKU imetengenezwa na kutumwa kwa SMS: 4829-1029-4471-8890');
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all"
                >
                  Nunua Umeme Sasa
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: TRANSACTION HISTORY & E-RECEIPTS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" />
                    <span>Taarifa ya Miamala & Risiti za Kidijitali</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Bofya muamala wowote ili kufungua risiti rasmi ya kielektroniki
                  </p>
                </div>
                <span className="text-xs font-bold font-mono text-neutral-400">
                  {transactions.length} Miamala
                </span>
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setSelectedReceipt(tx);
                      setIsReceiptModalOpen(true);
                    }}
                    className="py-3 px-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        tx.type === 'credit'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : tx.category === 'transit'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : tx.category === 'student'
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}>
                        {tx.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
                          {tx.title}
                        </h4>
                        <p className="text-[11px] text-neutral-500 truncate max-w-[200px] sm:max-w-xs">
                          {tx.subtitle}
                        </p>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {tx.date} • {tx.time}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm sm:text-base font-black font-mono block ${
                        tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                      }`}>
                        {tx.type === 'credit' ? '+' : '-'}TZS {tx.amount.toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-end gap-0.5">
                        <Check className="w-3 h-3" />
                        <span>Imekamilika</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: WEKA SALIO (TOP-UP WALLET MODAL) */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isTopUpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Weka Salio Kwenye PapoPay
                    </h3>
                    <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, Halopesa au Kadi</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Amount Quick Choices */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                  Chagua Kiasi cha Kuweka
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['2000', '5000', '10000', '25000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        topUpAmount === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {Number(amt).toLocaleString()}
                    </button>
                  ))}
                </div>
                <input 
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="Kiasi kingine cha fedha..."
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Payment Methods */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                  Njia ya Malipo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'mpesa', name: 'Vodacom M-Pesa', color: 'border-red-500' },
                    { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500' },
                    { id: 'airtel', name: 'Airtel Money', color: 'border-red-600' },
                    { id: 'halopesa', name: 'HaloPesa', color: 'border-orange-500' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTopUpMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        topUpMethod === m.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-800 dark:text-emerald-300'
                          : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone number input */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Namba ya Simu ya Malipo
                </label>
                <input 
                  type="tel"
                  value={topUpPhone}
                  onChange={(e) => setTopUpPhone(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                disabled={isProcessingTopUp}
                onClick={handleExecuteTopUp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isProcessingTopUp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Inasubiri USSD Push kwenye Simu...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Weka TZS {Number(topUpAmount || 0).toLocaleString()} Sasa</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: DIGITAL RECEIPT & VERIFICATION QR MODAL */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isReceiptModalOpen && selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              {/* Receipt Header */}
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  Stakabadhi ya Malipo
                </h3>
                <p className="text-[11px] font-mono text-neutral-400">
                  {selectedReceipt.refCode}
                </p>
              </div>

              {/* Amount Display */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Kiasi Kilicholipwa</span>
                <span className="text-2xl font-black font-mono text-neutral-900 dark:text-white">
                  TZS {selectedReceipt.amount.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">
                  ✓ Malipo Yamethibitishwa na PapoPay & LATRA
                </span>
              </div>

              {/* Receipt Details Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Muda & Tarehe:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedReceipt.date}, {selectedReceipt.time}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Huduma:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">{selectedReceipt.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Maelezo:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate max-w-[180px]">{selectedReceipt.subtitle}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Njia ya Malipo:</span>
                  <span className="font-bold text-emerald-600">PapoPay Instant Wallet</span>
                </div>
              </div>

              {/* QR Code for verification */}
              <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/verify/${selectedReceipt.refCode}`} size={90} />
                <span className="text-[9px] text-neutral-400 font-mono mt-1">Skani Kuhakiki Uhalali</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    toast.success('Risiti imetumwa kwenye WhatsApp yako!');
                  }}
                  className="py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-neutral-200"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase hover:bg-emerald-500"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: SAJILI KADI MPYA YA MWANAFUNZI */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isRegisterStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/40 text-pink-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Sajili Kadi ya Mwanafunzi
                    </h3>
                    <p className="text-xs text-neutral-500">Unganisha kadi ya kielektroniki kwa mtoto wako</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRegisterStudentModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Jina Kamili la Mwanafunzi
                  </label>
                  <input 
                    type="text"
                    placeholder="Mfano: Faraja Godfrey"
                    id="new_std_name"
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Jina la Shule & Darasa
                  </label>
                  <input 
                    type="text"
                    placeholder="Mfano: Jangwani Sekondari (Form 2)"
                    id="new_std_school"
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Namba ya Kadi / NFC Chip (Iliyo nyuma ya kadi)
                  </label>
                  <input 
                    type="text"
                    placeholder="Mfano: TZ-STD-88102"
                    id="new_std_card"
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Kikomo cha Matumizi kwa Siku (TZS)
                  </label>
                  <input 
                    type="number"
                    defaultValue="600"
                    id="new_std_limit"
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  const nameEl = document.getElementById('new_std_name') as HTMLInputElement;
                  const schoolEl = document.getElementById('new_std_school') as HTMLInputElement;
                  const cardEl = document.getElementById('new_std_card') as HTMLInputElement;

                  const name = nameEl?.value || 'Mwanafunzi Mpya';
                  const school = schoolEl?.value || 'Shule ya Msingi';
                  const cardNum = cardEl?.value || `TZ-STD-${Math.floor(10000 + Math.random() * 90000)}`;

                  const newCard: StudentCard = {
                    id: `std_${Date.now()}`,
                    studentName: name,
                    schoolName: school,
                    cardNumber: cardNum,
                    balance: 2000,
                    dailyLimit: 600,
                    status: 'active',
                    avatarColor: 'from-purple-600 to-indigo-700',
                    recentTrips: []
                  };

                  setStudentCards(prev => [...prev, newCard]);
                  setIsRegisterStudentModalOpen(false);
                  toast.success(`🎉 Kadi ya ${name} imesajiliwa kikamilifu na kupewa bonasi ya safari 10 (TZS 2,000)!`);
                }}
                className="w-full py-3 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all"
              >
                Hifadhi & Washa Kadi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: OFFLINE USSD & BILA BANDO GUIDE */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isOfflineUssdModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    PapoPay Bila Bando
                  </h3>
                </div>
                <button
                  onClick={() => setIsOfflineUssdModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">
                  USSD CODE RAHISI KWA SIMU ZOTE
                </span>
                <p className="text-2xl font-black font-mono text-neutral-900 dark:text-white">
                  *150*88#
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Piga namba hii kutoka mtandao wowote (Vodacom, Tigo, Airtel, Halotel) kulipia nauli ya daladala au kuweka salio hata kama huna intaneti au unatumia simu ya tochi!
                </p>
              </div>

              <button
                onClick={() => setIsOfflineUssdModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs uppercase tracking-wider"
              >
                Nimeelewa
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
