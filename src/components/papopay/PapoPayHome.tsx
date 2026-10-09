import React, { useState, useEffect } from 'react';
import { 
  Wallet, QrCode, CreditCard, ArrowUpRight, ArrowDownLeft, 
  Send, Users, Receipt, Zap, ShieldCheck, History, Bus, 
  CheckCircle2, AlertCircle, Copy, Check, ChevronRight, 
  Phone, Sparkles, Lock, RefreshCw, Eye, EyeOff, Plus, 
  Search, ExternalLink, ArrowLeft, Smartphone, Radio, 
  GraduationCap, Bell, Download, Share2, Info, ChevronDown,
  Utensils, Store, Banknote, ShoppingBag, Scissors, Pill, Building2, 
  Flame, MapPin, Coffee, LayoutGrid, Calendar, ArrowLeftRight, 
  Layers, TrendingUp, Gift, Tag, Link2, MessageSquare, Trophy, 
  UserCheck, X, FileText, Globe, Clock, Shield, Sliders
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';

export type PapoPayNavSection = 
  | 'overview' 
  | 'add_withdraw' 
  | 'p2p' 
  | 'virtual_cards' 
  | 'subscriptions' 
  | 'wallet_earn' 
  | 'transfer_exchange' 
  | 'remittance' 
  | 'make_payment' 
  | 'vouchers' 
  | 'gift_cards' 
  | 'mobile_recharge' 
  | 'payment_links' 
  | 'history' 
  | 'support';

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
  category: 'transit' | 'student' | 'bill' | 'transfer' | 'topup' | 'merchant' | 'restaurant' | 'withdraw' | 'deposit' | 'service';
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

  // Navigation state
  const initialSection = (searchParams.get('tab') as PapoPayNavSection) || 'overview';
  const [activeSection, setActiveSection] = useState<PapoPayNavSection>(initialSection);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    add_withdraw: false,
    p2p: false,
    virtual_cards: false,
    subscriptions: false,
    wallet_earn: false,
    transfer_exchange: false,
    remittance: false,
  });

  // Currency toggle (TZS / USD)
  const [currency, setCurrency] = useState<'TZS' | 'USD'>('TZS');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Balance state synced with localStorage & profile
  const [balanceTZS, setBalanceTZS] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('papopay_wallet_balance');
      if (saved) return Number(saved);
      if (profile?.walletBalance !== undefined) return profile.walletBalance;
    } catch {}
    return 3450000;
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
  const [isKycBannerVisible, setIsKycBannerVisible] = useState(true);

  // Sync to storage
  useEffect(() => {
    try {
      localStorage.setItem('papopay_wallet_balance', balanceTZS.toString());
      localStorage.setItem('papopay_coins_balance', coinsBalance.toString());
    } catch {}
  }, [balanceTZS, coinsBalance]);

  // Modals state
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionItem | null>(null);
  const [isRegisterStudentModalOpen, setIsRegisterStudentModalOpen] = useState(false);

  // Top Up form state
  const [topUpAmount, setTopUpAmount] = useState('25000');
  const [topUpMethod, setTopUpMethod] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | 'card'>('mpesa');
  const [topUpPhone, setTopUpPhone] = useState(profile?.phoneNumber || '0754 123 456');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // NFC Interactive state
  const [nfcSubCategory, setNfcSubCategory] = useState<'restaurant' | 'services' | 'transit'>('restaurant');
  const [isNfcPayingRestaurant, setIsNfcPayingRestaurant] = useState(false);
  const [isNfcWithdrawing, setIsNfcWithdrawing] = useState(false);
  const [isNfcDepositing, setIsNfcDepositing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('50000');
  const [withdrawPhone, setWithdrawPhone] = useState(profile?.phoneNumber || '0754 123 456');
  const [selectedAgent, setSelectedAgent] = useState('Wakala Mussa Telecomm (Kariakoo Sokoni)');

  // Transfer & P2P State
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('10000');
  const [transferNote, setTransferNote] = useState('Gawana Nauli ya Daladala');
  const [isTransferring, setIsTransferring] = useState(false);

  // Split Fare Calculator state
  const [splitTotal, setSplitTotal] = useState('12000');
  const [splitPeople, setSplitPeople] = useState('4');

  // LUKU & Recharge State
  const [lukuMeter, setLukuMeter] = useState('14285930219');
  const [lukuAmount, setLukuAmount] = useState('20000');
  const [generatedLukuToken, setGeneratedLukuToken] = useState<string | null>(null);
  const [isBuyingLuku, setIsBuyingLuku] = useState(false);

  // Virtual Card State
  const [isCardFrozen, setIsCardFrozen] = useState(false);
  const [showCardCvv, setShowCardCvv] = useState(false);
  const [cardDailyLimit, setCardDailyLimit] = useState(500000);

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
        title: 'Cash-in received from Farid Uttara Cash Point',
        subtitle: 'AGENT CASH IN • COMPLETED',
        amount: 250000,
        type: 'credit',
        category: 'topup',
        date: '09 Okt 2026',
        time: '12:28 PM',
        refCode: 'TRX: TXNDYRGLCVE7DZY',
        status: 'completed',
        meta: { agent: 'Farid Uttara Cash Point', channel: 'Agent POS' }
      },
      {
        id: 'tx_102',
        title: 'Cash-in received from Farid Uttara Cash Point',
        subtitle: 'AGENT CASH IN • COMPLETED',
        amount: 5000,
        type: 'credit',
        category: 'topup',
        date: '09 Okt 2026',
        time: '11:17 AM',
        refCode: 'TRX: TXNZK4P5ES9CMYO',
        status: 'completed',
        meta: { agent: 'Farid Uttara Cash Point', channel: 'Agent POS' }
      },
      {
        id: 'tx_103',
        title: 'Exchanging money from USD Wallet to TZS',
        subtitle: 'EXCHANGE MONEY • COMPLETED',
        amount: 195000,
        type: 'credit',
        category: 'transfer',
        date: '09 Okt 2026',
        time: '10:45 AM',
        refCode: 'TRX: TXNKL89OP124876',
        status: 'completed'
      },
      {
        id: 'tx_104',
        title: 'Malipo ya Mgahawa (Ocean View Cafe - Meza No. 4)',
        subtitle: 'NFC TABLE TAP • COMPLETED',
        amount: 25500,
        type: 'debit',
        category: 'restaurant',
        date: '09 Okt 2026',
        time: '01:15 PM',
        refCode: 'TRX: PAPO-REST-884210',
        status: 'completed'
      },
      {
        id: 'tx_105',
        title: 'Nauli ya Daladala (Kivukoni ➔ Mwenge)',
        subtitle: 'T 482 DFP • NFC TAP NAULI',
        amount: 600,
        type: 'debit',
        category: 'transit',
        date: '09 Okt 2026',
        time: '08:20 AM',
        refCode: 'TRX: PAPO-BUS-110293',
        status: 'completed'
      },
      {
        id: 'tx_106',
        title: 'LUKU Umeme Token (Mita: 14285930219)',
        subtitle: 'TOKEN: 9021-4821-5519-0021-9981',
        amount: 30000,
        type: 'debit',
        category: 'bill',
        date: '08 Okt 2026',
        time: '06:14 PM',
        refCode: 'TRX: PAPO-LUKU-554129',
        status: 'completed'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('papopay_transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  // Currency Converter helper
  const formatAmount = (amtTZS: number) => {
    if (currency === 'USD') {
      const inUSD = (amtTZS / 2600).toFixed(2);
      return `$${Number(inUSD).toLocaleString()}`;
    }
    return `TZS ${amtTZS.toLocaleString()}`;
  };

  // Top Up Handler
  const handleExecuteTopUp = () => {
    const val = Number(topUpAmount);
    if (!val || val <= 0) {
      toast.error('Tafadhali ingiza kiasi sahihi.');
      return;
    }
    setIsProcessingTopUp(true);

    setTimeout(() => {
      setBalanceTZS(prev => prev + val);
      const earnedCoins = Math.floor(val / 1000) * 5;
      setCoinsBalance(prev => prev + earnedCoins);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Cash-in received from ${topUpMethod.toUpperCase()}`,
        subtitle: `AGENT CASH IN • COMPLETED (${topUpPhone})`,
        amount: val,
        type: 'credit',
        category: 'topup',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: TXN${Math.floor(100000000 + Math.random() * 900000000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsProcessingTopUp(false);
      setIsTopUpModalOpen(false);
      toast.success(`🎉 TZS ${val.toLocaleString()} zimewekwa kwenye pochi yako ya PapoPay!`);
    }, 1200);
  };

  // Restaurant NFC Table Tap Handler
  const handleNfcRestaurantPay = (restaurantName: string, tableNumber: string, itemsDesc: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error(`Salio lako halitoshi (Una TZS ${balanceTZS.toLocaleString()}).`);
      setIsTopUpModalOpen(true);
      return;
    }

    setIsNfcPayingRestaurant(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amount);
      const earnedCoins = Math.floor(amount / 1000) * 8;
      setCoinsBalance(prev => prev + earnedCoins);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Malipo ya Mgahawa (${restaurantName})`,
        subtitle: `${tableNumber} • ${itemsDesc}`,
        amount: amount,
        type: 'debit',
        category: 'restaurant',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: PAPO-REST-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsNfcPayingRestaurant(false);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(`🍽️ Bili ya ${tableNumber} (TZS ${amount.toLocaleString()}) imelipwa kikamilifu! Waiter na jikoni wamepata taarifa.`);
    }, 1200);
  };

  // Wakala Withdraw Handler
  const handleNfcWithdrawCash = (agentName: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error(`Salio lako halitoshi kutoa TZS ${amount.toLocaleString()}.`);
      return;
    }

    setIsNfcWithdrawing(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amount);
      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Toa Pesa kwa Wakala (NFC POS)`,
        subtitle: `${agentName} • Fedha Taslimu Mkononi`,
        amount: amount,
        type: 'debit',
        category: 'withdraw',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: PAPO-WDR-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsNfcWithdrawing(false);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(`💵 TZS ${amount.toLocaleString()} zimetolewa kwa ufanisi! Wakala amekukabidhi fedha taslimu.`);
    }, 1200);
  };

  // Transfer Money Handler
  const handleExecuteTransfer = () => {
    const amt = Number(transferAmount);
    if (!amt || amt <= 0) {
      toast.error('Tafadhali weka kiasi sahihi.');
      return;
    }
    if (!transferRecipient.trim()) {
      toast.error('Tafadhali weka namba ya simu au PapoPay ID ya mpokeaji.');
      return;
    }
    if (balanceTZS < amt) {
      toast.error('Salio lako halitoshi kufanya muamala huu.');
      return;
    }

    setIsTransferring(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amt);
      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Tuma Pesa kwa ${transferRecipient}`,
        subtitle: `PAPO-TO-PAPO (0% ADA) • ${transferNote}`,
        amount: amt,
        type: 'debit',
        category: 'transfer',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: PAPO-TRF-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsTransferring(false);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(`✅ TZS ${amt.toLocaleString()} zimetumwa kwa ${transferRecipient} bila makato!`);
      setTransferRecipient('');
    }, 1100);
  };

  // LUKU Purchase Handler
  const handleBuyLuku = () => {
    const amt = Number(lukuAmount);
    if (!amt || amt < 2000) {
      toast.error('Kiwango cha chini cha LUKU ni TZS 2,000.');
      return;
    }
    if (balanceTZS < amt) {
      toast.error('Salio lako halitoshi kununua LUKU.');
      return;
    }

    setIsBuyingLuku(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amt);
      const token = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      setGeneratedLukuToken(token);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `LUKU Umeme (Mita: ${lukuMeter})`,
        subtitle: `TOKEN: ${token} • Units: ${(amt / 350).toFixed(1)} kWh`,
        amount: amt,
        type: 'debit',
        category: 'bill',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: LUKU-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsBuyingLuku(false);
      toast.success('⚡ Token ya LUKU imezalishwa kikamilifu!');
    }, 1200);
  };

  // Student Card Balance Top up
  const handleStudentCardTopUp = (cardId: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error('Salio lako halitoshi kujaza kadi ya mwanafunzi.');
      return;
    }
    setBalanceTZS(prev => prev - amount);
    setStudentCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, balance: c.balance + amount };
      }
      return c;
    }));
    toast.success(`💳 Kadi ya mwanafunzi imeongezewa TZS ${amount.toLocaleString()}!`);
  };

  // User display metadata
  const userDisplayName = profile?.displayName || profile?.fullName || user?.email?.split('@')[0] || 'Ayesha';
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();

  // Filtered transactions for search
  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q) || t.refCode.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f8f9fd] dark:bg-[#0b0f19] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* ========================================================================= */}
      {/* DESKTOP TOP BAR (WEB VIEW HEADER BAR) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111625]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 px-4 lg:px-8 py-3 transition-colors">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          
          {/* Left: Back Link & PapoPay Brand Badge */}
          <div className="flex items-center gap-3 xl:gap-5 min-w-0">
            <button
              onClick={() => navigate('/services')}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 shrink-0 transition-all"
              title="Rudi kwenye Super Services Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Rudi Hub</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#1f4fe4] to-[#3b66f5] text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-neutral-900 dark:text-white">PapoPay</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                    BOT 🇹🇿
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-medium hidden sm:inline">
                  Super Fintech &amp; NFC Tap Ecosystem
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live FX & Market Ticker (Desktop Web View Exclusive) */}
          <div className="hidden xl:flex items-center gap-4 px-4 py-1.5 rounded-full bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-mono font-medium">
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">USD/TZS:</span>
              <span className="text-emerald-600 font-bold">2,610.50</span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <span className="font-bold">KES/TZS:</span>
              <span className="text-blue-600 font-bold">20.25</span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <Bus className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-amber-600">Daladala &amp; BRT NFC:</span>
              <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.2 rounded text-[10px] font-bold">0% ADA</span>
            </div>
          </div>

          {/* Right: Quick Action Ribbon & User Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Currency Toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl text-xs font-mono font-bold">
              <button
                onClick={() => setCurrency('TZS')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currency === 'TZS'
                    ? 'bg-white dark:bg-neutral-900 text-[#3b66f5] shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                TZS
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-neutral-900 text-[#3b66f5] shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                USD
              </button>
            </div>

            {/* Quick Deposit Button */}
            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#3b66f5] hover:bg-[#2f55e0] text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Weka Salio</span>
            </button>

            {/* User Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3b66f5] to-[#703bf5] text-white font-black text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-61px)]">
        
        {/* ========================================================================= */}
        {/* LEFT SIDEBAR (STICKY ON WEB VIEW) */}
        {/* ========================================================================= */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-white dark:bg-[#111625] border-r border-neutral-200/80 dark:border-neutral-800/80 p-4 xl:p-5 flex flex-col justify-between space-y-6 lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] lg:overflow-y-auto">
          
          <div className="space-y-5">
            
            {/* 1. TOP FLOATING BLUE GRADIENT WALLET CARD */}
            <div className="rounded-3xl bg-gradient-to-br from-[#2f65f6] via-[#1f4fe4] to-[#1239c8] text-white p-5 shadow-[0_12px_28px_-6px_rgba(31,79,228,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-3.5">
                {/* Top Badge + Currency Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{currency === 'TZS' ? 'TZS Personal Wallet' : 'USD Personal Wallet'}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrency(currency === 'TZS' ? 'USD' : 'TZS')}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs transition-colors"
                      title="Badili Sarafu"
                    >
                      ⇄
                    </button>
                  </div>
                </div>

                {/* Wallet ID with Copy Icon */}
                <div className="flex items-center gap-1.5 text-xs text-blue-100 font-mono">
                  <span className="opacity-80">Wallet ID:</span>
                  <span className="font-bold">118504625</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('118504625');
                      toast.success('Wallet ID 118504625 imenakiliwa!');
                    }}
                    className="p-1 hover:text-white transition-colors"
                    title="Copy ID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Available Balance + Eye Toggle + Holographic Chip */}
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 block">
                      AVAILABLE BALANCE
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl xl:text-3xl font-black font-mono tracking-tight">
                        {showBalance 
                          ? (currency === 'TZS' ? `TZS ${(balanceTZS).toLocaleString()}` : `$${(balanceTZS / 2600).toFixed(2)}`)
                          : '••••••••'}
                      </span>
                      <button 
                        onClick={() => setShowBalance(!showBalance)}
                        className="p-1 hover:text-white transition-colors opacity-90"
                      >
                        {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Holographic Card Chip Graphic */}
                  <div className="w-8 h-6 rounded-md bg-white/25 border border-white/40 flex items-center justify-center">
                    <div className="w-5 h-3.5 border border-white/40 rounded-sm" />
                  </div>
                </div>

                {/* Two Action Buttons: Deposit & Make Payment */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsTopUpModalOpen(true)}
                    className="py-2 px-3 rounded-xl bg-white text-[#1f4fe4] hover:bg-blue-50 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Deposit</span>
                  </button>

                  <button
                    onClick={() => setActiveSection('make_payment')}
                    className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 backdrop-blur-md active:scale-95 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-300" />
                    <span>NFC Tap</span>
                  </button>
                </div>

              </div>
            </div>

            {/* 2. ACCORDION NAVIGATION ITEMS */}
            <nav className="space-y-1 text-sm font-semibold">
              
              {/* Dashboard Overview */}
              <button
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'overview'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Dashboard Overview</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Add & Withdraw Funds */}
              <button
                onClick={() => setActiveSection('add_withdraw')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'add_withdraw'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Banknote className="w-4 h-4" />
                  <span>Add &amp; Withdraw Funds</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Make Payment (NFC Tap & Nauli) */}
              <button
                onClick={() => setActiveSection('make_payment')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'make_payment'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-emerald-500" />
                  <span>NFC Tap &amp; Mgahawani</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  TAP
                </span>
              </button>

              {/* My Virtual Cards & Student NFC */}
              <button
                onClick={() => setActiveSection('virtual_cards')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'virtual_cards'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4" />
                  <span>Virtual Cards &amp; Student</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Transfer & Exchange */}
              <button
                onClick={() => setActiveSection('transfer_exchange')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'transfer_exchange'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-4 h-4" />
                  <span>Transfer &amp; Gawana Nauli</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Mobile Recharge (LUKU & Vocha) */}
              <button
                onClick={() => setActiveSection('mobile_recharge')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'mobile_recharge'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4" />
                  <span>LUKU &amp; Mobile Recharge</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* P2P Marketplace */}
              <button
                onClick={() => setActiveSection('p2p')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'p2p'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>P2P Marketplace</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Transaction History */}
              <button
                onClick={() => setActiveSection('history')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'history'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4" />
                  <span>Transaction History</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>
            </nav>

          </div>

          {/* 3. BOTTOM REFERRAL CARD */}
          <div className="p-4 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  REFERRAL BOOST
                </span>
                <h5 className="text-xs font-black text-neutral-900 dark:text-white mt-1">
                  Alika marafiki ujipatie TZS 2,500
                </h5>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Kila rafiki akilipa nauli ya kwanza kwa PapoPay unazawadiwa.
                </p>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText('https://papo.tz/invite/' + (user?.uid || 'user'));
                  toast.success('Kiunganishi cha mwaliko kimenakiliwa!');
                }}
                className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

        </aside>

        {/* ========================================================================= */}
        {/* MAIN DASHBOARD CONTENT AREA */}
        {/* ========================================================================= */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          
          {/* TOP USER GREETING & SEARCH BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3b66f5] to-[#703bf5] text-white font-black text-base flex items-center justify-center shadow-md">
                {userInitials}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
                  HABARI YA LEO
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                  Karibu, {userDisplayName}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {activeSection === 'overview' && "Tazama muhtasari wa akaunti na miamala yako ya leo."}
                  {activeSection === 'add_withdraw' && "Weka au toa fedha kwa mawakala wa Papo na mitandao ya simu."}
                  {activeSection === 'make_payment' && "Lipa bila chenji mgahawani, kwenye daladala na madukani kwa NFC Tap."}
                  {activeSection === 'virtual_cards' && "Simamia kadi yako ya mtandaoni na Kadi za NFC za Wanafunzi."}
                  {activeSection === 'transfer_exchange' && "Tuma pesa papo kwa papo bila makato au gawana bili na marafiki."}
                  {activeSection === 'mobile_recharge' && "Nunua LUKU, vifurushi vya simu na lipia ankara za serikali."}
                  {activeSection === 'p2p' && "Soko la P2P la kubadilishana sarafu kwa ulinzi wa BOT."}
                  {activeSection === 'history' && "Kumbukumbu na stakabadhi za EFD za miamala yako yote."}
                </p>
              </div>
            </div>

            {/* Desktop Search Bar & Fast Nav Buttons */}
            <div className="flex items-center gap-2.5">
              <div className="relative min-w-[220px] sm:min-w-[280px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tafuta muamala au huduma..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-[#3b66f5]"
                />
              </div>

              <button
                onClick={() => setActiveSection('history')}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#111625] hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
              >
                <Receipt className="w-4 h-4 text-[#3b66f5]" />
                <span className="hidden sm:inline">Stakabadhi</span>
              </button>
            </div>

          </div>

          {/* IDENTITY VERIFIED / BOT COMPLIANT ALERT */}
          {isKycBannerVisible && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111625] border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                    Uthibitisho wa NIDA &amp; BOT Umekamilika
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    Akaunti yako imethibitishwa na inaruhusiwa kufanya miamala ya hadi TZS 10,000,000 kwa siku.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Imethibitishwa</span>
                </span>

                <button
                  onClick={() => setIsKycBannerVisible(false)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW (WEB VIEW DASHBOARD COCKPIT) */}
          {/* ========================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              
              {/* EIGHT STAT CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                
                {/* Card 1: Deposit */}
                <div 
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(14102000)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Deposit (Weka Salio)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-[#3b66f5] flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 2: Withdraw */}
                <div 
                  onClick={() => setActiveSection('add_withdraw')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shadow-xs">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(7956000)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Withdraw (Toa Pesa)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-rose-500 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 3: Send Money */}
                <div 
                  onClick={() => setActiveSection('transfer_exchange')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] flex items-center justify-center shadow-xs">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(14021530)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Tuma Pesa (0% Ada)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-[#3b66f5] flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4: Make Payment (NFC Tap) */}
                <div 
                  onClick={() => setActiveSection('make_payment')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        NFC Tap &amp; Pay
                      </h3>
                      <span className="text-xs text-emerald-600 font-semibold">Mgahawa &amp; Daladala</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 5: Exchange Money */}
                <div 
                  onClick={() => setActiveSection('transfer_exchange')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shadow-xs">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(12155120)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Sarafu &amp; Exchange</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 6: Kadi ya Mwanafunzi */}
                <div 
                  onClick={() => setActiveSection('virtual_cards')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shadow-xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        2 Kadi Wanafunzi
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Student NFC Transit</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-teal-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 7: Reward Coins */}
                <div 
                  onClick={() => toast.success(`Una pointi ${coinsBalance} za zawadi za PapoPay!`)}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shadow-xs">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {coinsBalance} Coins
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Papo CashBack Rewards</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-amber-500 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 8: LUKU & Bili */}
                <div 
                  onClick={() => setActiveSection('mobile_recharge')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shadow-xs">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        LUKU &amp; Bili
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Umeme, Maji, Vocha</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

              </div>

              {/* ANALYTICS CHARTS & SPARKLINE CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Deposits Chart Card */}
                <div className="p-5 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <Download className="w-4 h-4" />
                        <span className="text-sm font-black text-neutral-900 dark:text-white">Deposits</span>
                      </div>
                      <span className="text-xs text-neutral-400">Siku 7 zilizopita</span>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-600">
                      TZS 255,000
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-28 w-full flex items-end justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2 relative">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                      </div>
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 100">
                        <path
                          d="M 10 80 Q 150 20 300 60 T 690 10"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-bold text-neutral-400 mt-2">
                      <span>Jpili</span>
                      <span>Jtatu</span>
                      <span>Jnne</span>
                      <span>Ttano</span>
                      <span>Alh</span>
                      <span>Iju</span>
                      <span>Jmosi</span>
                    </div>
                  </div>
                </div>

                {/* Withdrawals Chart Card */}
                <div className="p-5 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-rose-500">
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="text-sm font-black text-neutral-900 dark:text-white">Matumizi &amp; Nauli</span>
                      </div>
                      <span className="text-xs text-neutral-400">Siku 7 zilizopita</span>
                    </div>
                    <span className="text-lg font-black font-mono text-rose-500">
                      TZS 56,100
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-28 w-full flex items-end justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2 relative">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                      </div>
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 100">
                        <path
                          d="M 10 90 Q 200 40 400 80 T 690 30"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="3"
                        />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-bold text-neutral-400 mt-2">
                      <span>Jpili</span>
                      <span>Jtatu</span>
                      <span>Jnne</span>
                      <span>Ttano</span>
                      <span>Alh</span>
                      <span>Iju</span>
                      <span>Jmosi</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* QUICK NFC TAP HIGHLIGHT ON WEB VIEW */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-neutral-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2 z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>NFC Tap &amp; Pay Tanzania 🇹🇿</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                    Lipa Bili ya Mgahawa au Nauli ya Daladala kwa Kugusa Simu
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300">
                    Huna haja ya kubeba fedha taslimu au kusubiri chenji. Gusa simu yako au kadi ya PapoPay kwenye meza ya mgahawa au kwa konda kulipa papo hapo.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 z-10">
                  <button
                    onClick={() => {
                      setActiveSection('make_payment');
                      setNfcSubCategory('restaurant');
                    }}
                    className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Utensils className="w-4 h-4" />
                    <span>Mgahawani (Mezani)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection('make_payment');
                      setNfcSubCategory('transit');
                    }}
                    className="px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs uppercase tracking-wider backdrop-blur-md flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Bus className="w-4 h-4" />
                    <span>Nauli ya Daladala</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ADD & WITHDRAW FUNDS (WEB VIEW COMPLETE SUITE) */}
          {/* ========================================================================= */}
          {activeSection === 'add_withdraw' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Weka Salio (Deposit) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Weka Salio (Deposit Funds)
                    </h3>
                    <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, Halopesa, Visa</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                      Chagua Mtandao / Njia ya Malipo
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'mpesa', name: 'M-Pesa', color: 'border-red-500 text-red-600' },
                        { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500 text-blue-600' },
                        { id: 'airtel', name: 'Airtel Money', color: 'border-red-600 text-red-600' },
                        { id: 'halopesa', name: 'HaloPesa', color: 'border-orange-500 text-orange-600' },
                        { id: 'card', name: 'Kadi ya Benki', color: 'border-indigo-500 text-indigo-600' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setTopUpMethod(m.id as any)}
                          className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all ${
                            topUpMethod === m.id
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-[#3b66f5] text-[#3b66f5] shadow-xs'
                              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                      Kiasi cha Kuweka (TZS)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {['10000', '25000', '50000', '100000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopUpAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                            topUpAmount === amt
                              ? 'bg-[#3b66f5] text-white border-[#3b66f5]'
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
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold focus:outline-none focus:border-[#3b66f5]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Namba ya Simu ya Malipo
                    </label>
                    <input
                      type="tel"
                      value={topUpPhone}
                      onChange={(e) => setTopUpPhone(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                    />
                  </div>

                  <button
                    disabled={isProcessingTopUp}
                    onClick={handleExecuteTopUp}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isProcessingTopUp ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>Weka TZS {Number(topUpAmount || 0).toLocaleString()} Kwenye PapoPay</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Toa Pesa kwa Wakala (Withdrawal via NFC or Code) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Toa Fedha kwa Wakala (NFC POS / Wakala Code)
                    </h3>
                    <p className="text-xs text-neutral-500">Toa pesa taslimu papo hapo kwa wakala yeyote aliye karibu</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                      Mawakala wa PapoPay Walio Karibu (Dar es Salaam)
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {[
                        { name: 'Wakala Mussa Telecomm (Kariakoo Sokoni)', dist: '120m', status: 'Inapatikana' },
                        { name: 'Papo Agent Mary (Posta Mpya Mnara)', dist: '250m', status: 'Inapatikana' },
                        { name: 'Kivukoni Ferry Point Wakala', dist: '400m', status: 'Inapatikana' },
                        { name: 'Mwenge Stendi Papo Hub', dist: '1.2km', status: 'Inapatikana' },
                        { name: 'Ubungo Simu 2000 Wakala', dist: '2.5km', status: 'Inapatikana' }
                      ].map((ag) => (
                        <div
                          key={ag.name}
                          onClick={() => setSelectedAgent(ag.name)}
                          className={`p-3 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            selectedAgent === ag.name
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-[#3b66f5] font-bold text-neutral-900 dark:text-white'
                              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span>{ag.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-blue-600">{ag.dist}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Kiasi cha Kutoa (TZS)
                    </label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Ada ya kutoa kwa wakala wa PapoPay ni 0.2% pekee (Nusu ya makato ya kawaida ya mawakala wa mitandao).</span>
                  </div>

                  <button
                    disabled={isNfcWithdrawing}
                    onClick={() => handleNfcWithdrawCash(selectedAgent, Number(withdrawAmount || 0))}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isNfcWithdrawing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Radio className="w-5 h-5" />
                    )}
                    <span>Gusisha Simu / Toa TZS {Number(withdrawAmount || 0).toLocaleString()}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MAKE PAYMENT (NFC TAP IN RESTAURANTS, DALADALA & SHOPS) */}
          {/* ========================================================================= */}
          {activeSection === 'make_payment' && (
            <div className="space-y-6">
              
              {/* Category Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                    <span>NFC Tap &amp; Pay Ecosystem 🇹🇿</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Chagua aina ya huduma kisha gusisha simu au kadi mezani au kwa konda
                  </p>
                </div>

                <div className="flex gap-2">
                  {[
                    { id: 'restaurant', label: '🍽️ Migahawani & Cafe' },
                    { id: 'transit', label: '🚌 Daladala & BRT' },
                    { id: 'services', label: '🛍️ Maduka & Saluni' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNfcSubCategory(cat.id as any)}
                      className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                        nfcSubCategory === cat.id
                          ? 'bg-[#3b66f5] text-white shadow-md'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. RESTAURANT TABLE TAP */}
              {nfcSubCategory === 'restaurant' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left: Table Bill Overview */}
                  <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-md">
                          MEZA NO. 04 • TERRACE VIEW
                        </span>
                        <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2">
                          Papo Hapo Ocean View Grill &amp; Cafe
                        </h3>
                        <p className="text-xs text-neutral-500">Kivukoni Front, Dar es Salaam • Waiter: Kelvin M.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-400 block">Jumla ya Bili</span>
                        <span className="text-2xl font-black font-mono text-emerald-600">TZS 25,500</span>
                      </div>
                    </div>

                    {/* Order items breakdown */}
                    <div className="border border-neutral-200/80 dark:border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Samaki wa Kupaka Mzima</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Changu wa nazi, kachumbari pembeni</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 18,000</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Chips Kavu Kubwa</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Pamoja na pilipili manga</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 4,000</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Juisi Safi ya Embe Baridi</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Fresh blended juice</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 3,500</span>
                      </div>
                    </div>

                    {/* NFC Tap Action Box */}
                    <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <Radio className="w-4 h-4 animate-ping" />
                        <span>Kiguso cha NFC Mezani Kipo Tayari!</span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Gusa simu yako au kadi ya PapoPay kwenye stika ya NFC ya Meza No. 04. Mfumo utakusanya bili, kuwajulisha jikoni kuwa umelipa, na kukupatia Stakabadhi ya EFD ya TRA papo hapo.
                      </p>
                      <button
                        disabled={isNfcPayingRestaurant}
                        onClick={() => handleNfcRestaurantPay('Papo Hapo Ocean View Grill', 'Meza No. 04', 'Samaki wa Kupaka + Chips + Juice', 25500)}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        {isNfcPayingRestaurant ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Radio className="w-5 h-5" />
                        )}
                        <span>Gusisha Mezani (Lipa TZS 25,500 Sasa)</span>
                      </button>
                    </div>
                  </div>

                  {/* Right: Split Table Bill & QR Code */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5 text-center flex flex-col justify-between">
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                        Skani QR ya Meza No. 04
                      </h4>
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 inline-block mx-auto border border-neutral-200 dark:border-neutral-700">
                        <QRCodeSVG value="https://papo.tz/restaurant/table/04?bill=25500" size={140} />
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Kama huna NFC, skani QR hii kwa kamera au app yoyote ya benki.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">
                        Mko wengi mezani? Gawana bili:
                      </span>
                      <button
                        onClick={() => {
                          setActiveSection('transfer_exchange');
                          setSplitTotal('25500');
                        }}
                        className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] font-black text-xs uppercase hover:bg-blue-100 transition-colors"
                      >
                        Gawana Bili ya Meza (Split)
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* 2. TRANSIT DALADALA & BRT TAP */}
              {nfcSubCategory === 'transit' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Daladala Kivukoni ➔ Mwenge */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-neutral-900 dark:text-white">
                          Daladala T 482 DFP
                        </h4>
                        <p className="text-xs text-neutral-500">Ruti: Kivukoni ➔ Morocco ➔ Mwenge</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-600 dark:text-neutral-300">Nauli ya Mtu Mzima:</span>
                        <span className="font-mono text-neutral-900 dark:text-white font-black">TZS 600</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>Nauli ya Mwanafunzi (Smart NFC):</span>
                        <span className="font-mono font-black">TZS 200 (50% Off)</span>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-400">
                        <span>Konda: Juma Omari</span>
                        <span>POS ID: DALA-POS-902</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNfcRestaurantPay('Daladala T 482 DFP', 'Kiti No. 12', 'Kivukoni - Mwenge', 600)}
                      className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Gusisha kwa Konda (Lipa Nauli TZS 600)</span>
                    </button>
                  </div>

                  {/* BRT Mwendokasi Kimara ➔ Kivukoni */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-neutral-900 dark:text-white">
                          BRT Mwendokasi Express
                        </h4>
                        <p className="text-xs text-neutral-500">Kituo: Kimara Terminal ➔ Kivukoni</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-600 dark:text-neutral-300">Nauli ya BRT:</span>
                        <span className="font-mono text-neutral-900 dark:text-white font-black">TZS 750</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>PapoPay Turnstile Tap:</span>
                        <span className="font-mono font-black">Mlango unafunguka papo hapo</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNfcRestaurantPay('BRT Mwendokasi', 'Turnstile Gate 3', 'Kimara - Kivukoni', 750)}
                      className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Gusisha Kwenye Geti (Lipa TZS 750)</span>
                    </button>
                  </div>

                </div>
              )}

              {/* 3. SHOPS & SALONS */}
              {nfcSubCategory === 'services' && (
                <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
                  <h4 className="text-base font-black text-neutral-900 dark:text-white">
                    Maduka, Saluni na Vinyozi Vinavyotumia PapoPay NFC
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'Kipepeo Beauty Saloon', loc: 'Sinza Mori', price: 15000, desc: 'Kusuka na Kusafisha Kucha' },
                      { name: 'Executive Kinyozi & Spa', loc: 'Mikocheni', price: 7000, desc: 'Kunyoa & Steaming' },
                      { name: 'Afya Bora Pharmacy', loc: 'Kariakoo', price: 12000, desc: 'Dawa na Huduma ya Kwanza' }
                    ].map((s) => (
                      <div key={s.name} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-neutral-200 dark:border-neutral-700">
                        <h5 className="text-sm font-black text-neutral-900 dark:text-white">{s.name}</h5>
                        <p className="text-[11px] text-neutral-400">{s.desc} • {s.loc}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-mono font-black text-emerald-600">TZS {s.price.toLocaleString()}</span>
                          <button
                            onClick={() => handleNfcRestaurantPay(s.name, 'Kaunta', s.desc, s.price)}
                            className="px-3 py-1.5 rounded-xl bg-[#3b66f5] text-white text-xs font-bold"
                          >
                            Lipa kwa NFC
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: VIRTUAL CARDS & STUDENT SMART CARDS */}
          {/* ========================================================================= */}
          {activeSection === 'virtual_cards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Virtual Mastercard Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-6">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                    PapoPay Virtual Mastercard 💳
                  </h3>
                  <p className="text-xs text-neutral-500">Kadi ya mtandaoni kwa ajili ya manunuzi, Netflix, Spotify &amp; Ads</p>
                </div>

                {/* 3D-effect Mastercard Graphic */}
                <div className={`p-6 rounded-3xl text-white shadow-2xl relative overflow-hidden transition-all ${
                  isCardFrozen 
                    ? 'bg-gradient-to-tr from-neutral-700 to-neutral-800 grayscale'
                    : 'bg-gradient-to-tr from-neutral-900 via-indigo-950 to-blue-900'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs font-black tracking-widest text-blue-300 uppercase">PAPOPAY PLATINUM</span>
                    <span className="text-sm font-black italic">mastercard</span>
                  </div>

                  <div className="w-10 h-8 rounded-lg bg-amber-400/80 border border-amber-300 mb-6 flex items-center justify-center">
                    <div className="w-6 h-5 border border-amber-600 rounded-xs opacity-75" />
                  </div>

                  <div className="space-y-4">
                    <div className="text-xl sm:text-2xl font-mono tracking-widest font-black">
                      5399 •••• •••• 9104
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">Card Holder</span>
                        <span className="font-bold">{userDisplayName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">Expires</span>
                        <span className="font-bold">10/29</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">CVV</span>
                        <span className="font-bold">{showCardCvv ? '812' : '•••'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowCardCvv(!showCardCvv)}
                    className="py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-2"
                  >
                    {showCardCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{showCardCvv ? 'Ficha CVV' : 'Onyesha CVV'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsCardFrozen(!isCardFrozen);
                      toast.success(isCardFrozen ? 'Kadi imefunguliwa!' : 'Kadi imegandishwa kwa usalama!');
                    }}
                    className={`py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 ${
                      isCardFrozen
                        ? 'bg-rose-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isCardFrozen ? 'Fungua Kadi' : 'Gandisha Kadi'}</span>
                  </button>
                </div>
              </div>

              {/* Student NFC Cards */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Kadi za NFC za Wanafunzi 🎓
                    </h3>
                    <p className="text-xs text-neutral-500">Watoto wanasafiri salama kwa TZS 200 bila chenji</p>
                  </div>
                  <button
                    onClick={() => toast.info('Kipengele cha kuongeza mwanafunzi kimefunguka')}
                    className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {studentCards.map((card) => (
                    <div key={card.id} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${card.avatarColor} text-white font-black text-sm flex items-center justify-center`}>
                            {card.studentName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-neutral-900 dark:text-white">{card.studentName}</h4>
                            <p className="text-[11px] text-neutral-400">{card.schoolName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-black text-emerald-600 block">TZS {card.balance.toLocaleString()}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{card.cardNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-700 text-xs">
                        <span className="text-neutral-500">Kikomo kwa siku: TZS {card.dailyLimit}</span>
                        <button
                          onClick={() => handleStudentCardTopUp(card.id, 5000)}
                          className="px-3 py-1 rounded-xl bg-[#3b66f5] text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                        >
                          + Weka TZS 5,000
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: TRANSFER & SPLIT FARE */}
          {/* ========================================================================= */}
          {activeSection === 'transfer_exchange' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Tuma Pesa (0% Ada) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center font-bold">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Tuma Pesa Papo kwa Papo (0% Makato)
                    </h3>
                    <p className="text-xs text-neutral-500">Tuma kwenda namba yoyote ya simu au PapoPay Wallet ID</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Mpokeaji (Simu au Wallet ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Mfano: 0754 000 111 au 118504625"
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Kiasi (TZS)
                    </label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Ujumbe / Sababu
                    </label>
                    <input
                      type="text"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  <button
                    disabled={isTransferring}
                    onClick={handleExecuteTransfer}
                    className="w-full py-4 rounded-2xl bg-[#3b66f5] hover:bg-[#2f55e0] text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isTransferring ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>Tuma TZS {Number(transferAmount || 0).toLocaleString()} (0% Ada)</span>
                  </button>
                </div>
              </div>

              {/* Gawana Nauli (Split Fare Calculator) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Gawana Nauli &amp; Bili ya Mgahawa (Split Bill)
                    </h3>
                    <p className="text-xs text-neutral-500">Mlipie pamoja bili ya meza, daladala au taxi kirahisi</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Jumla ya Bili (TZS)
                    </label>
                    <input
                      type="number"
                      value={splitTotal}
                      onChange={(e) => setSplitTotal(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Idadi ya Watu
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={splitPeople}
                      onChange={(e) => setSplitPeople(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-center space-y-1">
                    <span className="text-xs text-neutral-500 uppercase font-bold">Kila mtu analipa:</span>
                    <div className="text-3xl font-black font-mono text-[#3b66f5]">
                      TZS {Math.ceil(Number(splitTotal || 0) / Math.max(1, Number(splitPeople || 1))).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const perPerson = Math.ceil(Number(splitTotal || 0) / Math.max(1, Number(splitPeople || 1)));
                      const text = `Habari! Naomba unilipe sehemu yako ya TZS ${perPerson.toLocaleString()} kupitia PapoPay (Wallet ID: 118504625)`;
                      navigator.clipboard.writeText(text);
                      toast.success('Ujumbe wa mgawanyo umenakiliwa! Unaweza kuutuma WhatsApp.');
                    }}
                    className="w-full py-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Nakili Ujumbe wa WhatsApp kwa Wenzako</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: LUKU & MOBILE RECHARGE */}
          {/* ========================================================================= */}
          {activeSection === 'mobile_recharge' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LUKU Umeme Purchase */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      LUKU Umeme TANESCO
                    </h3>
                    <p className="text-xs text-neutral-500">Pata token papo hapo bila kuchelewa</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Namba ya Mita ya LUKU
                    </label>
                    <input
                      type="text"
                      value={lukuMeter}
                      onChange={(e) => setLukuMeter(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Kiasi (TZS)
                    </label>
                    <input
                      type="number"
                      value={lukuAmount}
                      onChange={(e) => setLukuAmount(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  {generatedLukuToken && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">TOKEN YAKO YA LUKU:</span>
                      <div className="text-xl font-black font-mono tracking-wider text-emerald-900 dark:text-emerald-100 select-all">
                        {generatedLukuToken}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLukuToken);
                          toast.success('Token ya LUKU imenakiliwa!');
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        Nakili Token
                      </button>
                    </div>
                  )}

                  <button
                    disabled={isBuyingLuku}
                    onClick={handleBuyLuku}
                    className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isBuyingLuku ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    <span>Nunua LUKU TZS {Number(lukuAmount || 0).toLocaleString()}</span>
                  </button>
                </div>
              </div>

              {/* Vocha & Data Bundles */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center font-bold">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Vocha &amp; Vifurushi vya Simu
                    </h3>
                    <p className="text-xs text-neutral-500">Vodacom, Tigo, Airtel, Halotel</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['Vodacom', 'Tigo', 'Airtel', 'Halotel'].map((net) => (
                    <button
                      key={net}
                      onClick={() => toast.success(`Mtandao wa ${net} umechaguliwa`)}
                      className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-left hover:border-[#3b66f5] transition-all"
                    >
                      <h5 className="font-black text-sm text-neutral-900 dark:text-white">{net}</h5>
                      <span className="text-[11px] text-neutral-400">Pata 5% Cashback</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: P2P MARKETPLACE */}
          {/* ========================================================================= */}
          {activeSection === 'p2p' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                    Soko la P2P la Kubadilishana Sarafu (Escrow Protection)
                  </h3>
                  <p className="text-xs text-neutral-500">Nunua au uza TZS / USD kwa wafanyabiashara waliothibitishwa</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                  0% Maker Fee
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'JumaKariakoo_FX', rating: '99.8%', trades: 1420, price: '2,610 TZS', limits: '50,000 - 5,000,000 TZS', methods: 'M-Pesa, NMB' },
                  { name: 'AminaExchange_TZ', rating: '100%', trades: 890, price: '2,608 TZS', limits: '20,000 - 2,000,000 TZS', methods: 'Tigo Pesa, CRDB' },
                  { name: 'MangiTrader24', rating: '99.4%', trades: 2150, price: '2,612 TZS', limits: '100,000 - 10,000,000 TZS', methods: 'M-Pesa, Airtel' }
                ].map((trader) => (
                  <div key={trader.name} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-neutral-900 dark:text-white">{trader.name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">✓ Verified</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">Ufanisi: {trader.rating} • Miamala: {trader.trades} • Njia: {trader.methods}</p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-right">
                        <span className="text-xs text-neutral-400 block">Kiwango</span>
                        <span className="text-base font-black font-mono text-emerald-600">{trader.price}</span>
                      </div>
                      <button
                        onClick={() => toast.success(`Agizo la biashara na ${trader.name} limefunguliwa!`)}
                        className="px-5 py-2.5 rounded-xl bg-[#3b66f5] hover:bg-blue-600 text-white font-bold text-xs"
                      >
                        Nunua USD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: TRANSACTION HISTORY & DIGITAL RECEIPTS */}
          {/* ========================================================================= */}
          {(activeSection === 'history' || activeSection === 'overview') && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Kumbukumbu za Miamala (Transaction Ledger)
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Bofya muamala wowote kutazama au kupakua Stakabadhi ya EFD ya TRA.
                  </p>
                </div>

                {activeSection === 'overview' && (
                  <button 
                    onClick={() => setActiveSection('history')}
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold text-[#3b66f5] flex items-center gap-1 transition-colors"
                  >
                    <span>Ona Yote</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setSelectedReceipt(tx);
                      setIsReceiptModalOpen(true);
                    }}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 px-2 rounded-2xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        tx.type === 'credit'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                      }`}>
                        {tx.type === 'credit' ? <Download className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {tx.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                            {tx.subtitle.includes('COMPLETED') ? 'MALIPO' : 'NFC TAP'}
                          </span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            IMETHIBITISHWA
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm sm:text-base font-black font-mono block ${
                        tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                      }`}>
                        {tx.type === 'credit' ? '+' : '-'}{formatAmount(tx.amount)}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                        {tx.refCode} • {tx.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TOP-UP / DEPOSIT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isTopUpModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Weka Salio PapoPay
                    </h3>
                    <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, Halopesa</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1.5">
                  Chagua Kiasi cha Kuweka (TZS)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['10000', '25000', '50000', '100000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        topUpAmount === amt
                          ? 'bg-[#3b66f5] text-white border-[#3b66f5]'
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
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-[#3b66f5]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                  Namba ya Simu ya Malipo
                </label>
                <input 
                  type="tel"
                  value={topUpPhone}
                  onChange={(e) => setTopUpPhone(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <button
                disabled={isProcessingTopUp}
                onClick={handleExecuteTopUp}
                className="w-full py-3.5 rounded-2xl bg-[#3b66f5] hover:bg-[#2f55e0] text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
              >
                {isProcessingTopUp ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>Weka TZS {Number(topUpAmount || 0).toLocaleString()} Sasa</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: DIGITAL RECEIPT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isReceiptModalOpen && selectedReceipt && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  Stakabadhi ya Malipo
                </h3>
                <p className="text-[11px] font-mono text-neutral-400">
                  {selectedReceipt.refCode}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Kiasi Kilicholipwa</span>
                <span className="text-2xl font-black font-mono text-neutral-900 dark:text-white">
                  {formatAmount(selectedReceipt.amount)}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">
                  ✓ Imethibitishwa na PapoPay &amp; BOT Compliance
                </span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/verify/${selectedReceipt.refCode}`} size={90} />
                <span className="text-[9px] text-neutral-400 font-mono mt-1">Skani Kuhakiki Uhalali wa EFD</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    toast.success('Risiti imetumwa kwenye WhatsApp yako!');
                  }}
                  className="py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-neutral-200"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="py-2.5 rounded-xl bg-[#3b66f5] text-white font-black text-xs uppercase hover:bg-blue-600"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
