import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Utensils, Building2, ScanFace, CheckCircle2, 
  AlertCircle, X, ShieldCheck, RefreshCw, Volume2, 
  VolumeX, Sparkles, UserX, UserPlus, Receipt, Printer, 
  Share2, QrCode, Search, Smartphone, Shield, Check, 
  Clock, Coins, Plus, Trash2, ArrowRight, User, LogOut, 
  CreditCard, MapPin, Tag, ShoppingBag, Sliders, ChevronDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, BiometricHudMode } from '../papopay/BiometricFaceCanvas';
import { FaceRegistrationModal } from '../papopay/FaceRegistrationModal';
import { toast } from 'sonner';

export type MerchantCategory = 'duka' | 'mgahawa' | 'hotel' | 'other';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  category: MerchantCategory;
}

const DEFAULT_CATALOG: ProductItem[] = [
  // Duka items
  { id: 'd1', name: 'Unga wa Ngano (2kg)', price: 4500, icon: '🌾', category: 'duka' },
  { id: 'd2', name: 'Sukari Nyeupe (1kg)', price: 3200, icon: '🧂', category: 'duka' },
  { id: 'd3', name: 'Mafuta ya Alizeti (1L)', price: 7800, icon: '🌻', category: 'duka' },
  { id: 'd4', name: 'Mchele wa Mbeya (1kg)', price: 3500, icon: '🍚', category: 'duka' },
  { id: 'd5', name: 'Maji ya Uhai (1.5L)', price: 1500, icon: '💧', category: 'duka' },
  { id: 'd6', name: 'Sabuni ya Omo (500g)', price: 2800, icon: '🧼', category: 'duka' },
  // Mgahawa items
  { id: 'm1', name: 'Kuku Choma Nusu + Chips', price: 14000, icon: '🍗', category: 'mgahawa' },
  { id: 'm2', name: 'Samaki wa Kupaka & Ugali', price: 18500, icon: '🐟', category: 'mgahawa' },
  { id: 'm3', name: 'Mishkaki ya Ng’ombe (Mishikaki 5)', price: 7500, icon: '🍢', category: 'mgahawa' },
  { id: 'm4', name: 'Chips Mayai (Zege Maalum)', price: 4500, icon: '🍳', category: 'mgahawa' },
  { id: 'm5', name: 'Juisi Fresh ya Embe & Nanasi', price: 3500, icon: '🍹', category: 'mgahawa' },
  { id: 'm6', name: 'Kahawa Kubwa ya Tangawizi', price: 2500, icon: '☕', category: 'mgahawa' },
  // Hotel items
  { id: 'h1', name: 'Chumba Standard (Usiku 1)', price: 65000, icon: '🛏️', category: 'hotel' },
  { id: 'h2', name: 'Chumba cha Deluxe Suite (Usiku 1)', price: 120000, icon: '🏨', category: 'hotel' },
  { id: 'h3', name: 'Buffet ya Asubuhi (Breakfast)', price: 25000, icon: '🥐', category: 'hotel' },
  { id: 'h4', name: 'Huduma ya Kufuliwa Nguo (Laundry)', price: 15000, icon: '🧺', category: 'hotel' },
  { id: 'h5', name: 'Taxi Cab / Uwanja wa Ndege', price: 35000, icon: '🚖', category: 'hotel' },
  { id: 'h6', name: 'Kinywaji cha Welcome Cocktail', price: 12000, icon: '🍸', category: 'hotel' }
];

interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
}

const POS_CLIENTS_DB: SimulatedCustomer[] = [
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

export default function MerchantPOSDashboard() {
  const navigate = useNavigate();

  // Load merchant profile from storage
  const [merchantProfile, setMerchantProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('papopay_current_merchant');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      posTerminalId: 'PAPO-POS-DUKA-412',
      merchantStoreName: 'Duka la Rejareja & Supermarket - Mikocheni',
      businessName: 'Duka la Rejareja & Supermarket - Mikocheni',
      merchantCategory: 'duka' as MerchantCategory,
      ownerName: 'Zawadi Bakari Said',
      phone: '0713 401 200',
      location: 'Dar es Salaam, Mikocheni B',
      settlementAccount: 'CRDB Bank A/C: 0150 *** 990',
      todaySales: 485000,
      todayCustomers: 28,
      role: 'merchant_pos'
    };
  });

  const [activeCategory, setActiveCategory] = useState<MerchantCategory>(merchantProfile.merchantCategory || 'duka');
  const [todaySales, setTodaySales] = useState<number>(merchantProfile.todaySales || 485000);
  const [todayCustomers, setTodayCustomers] = useState<number>(merchantProfile.todayCustomers || 28);

  // Cart state
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number; qty: number; icon: string }[]>([
    { ...DEFAULT_CATALOG[0], qty: 1 },
    { ...DEFAULT_CATALOG[2], qty: 1 }
  ]);

  // Catalog state
  const [catalog, setCatalog] = useState<ProductItem[]>(DEFAULT_CATALOG);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductIcon, setNewProductIcon] = useState('📦');

  // Customer & Camera state
  const [customers, setCustomers] = useState<SimulatedCustomer[]>(POS_CLIENTS_DB);
  const [selectedCustomer, setSelectedCustomer] = useState<SimulatedCustomer>(POS_CLIENTS_DB[0]);

  // Biometric verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationPhase, setVerificationPhase] = useState<'idle' | 'align' | 'verifying' | 'success' | 'unregistered'>('idle');
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

  // Settlement & Receipt modals
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);

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
    speak(`Karibu kwenye Kaunta ya POS ya ${merchantProfile.merchantStoreName}. Mfumo wa malipo ya uso upo tayari.`);
    return () => stopCamera();
  }, []);

  // Sync to local storage
  useEffect(() => {
    try {
      const updated = {
        ...merchantProfile,
        todaySales,
        todayCustomers,
        merchantCategory: activeCategory
      };
      localStorage.setItem('papopay_current_merchant', JSON.stringify(updated));
    } catch {}
  }, [todaySales, todayCustomers, activeCategory]);

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Cart operations
  const handleAddToCart = (product: ProductItem) => {
    triggerHapticTap();
    setCartItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`Imeongezwa: ${product.name}`);
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

  const handleClearCart = () => {
    setCartItems([]);
    triggerHapticTap();
    toast.info("Bili ya kaunta imesafishwa.");
  };

  // Add custom product to catalog
  const handleAddCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductPrice) return;
    const price = Number(newProductPrice) || 0;
    const newItem: ProductItem = {
      id: `prod_${Date.now()}`,
      name: newProductName.trim(),
      price,
      icon: newProductIcon || '📦',
      category: activeCategory
    };
    setCatalog(prev => [newItem, ...prev]);
    handleAddToCart(newItem);
    setNewProductName('');
    setNewProductPrice('');
    toast.success(`Bidhaa mpya "${newItem.name}" imeongezwa kwenye katalogi!`);
  };

  // Execute Face Checkout
  const handleExecuteFaceCheckout = () => {
    if (isVerifying) return;
    if (cartItems.length === 0) {
      toast.error("Weka bidhaa kwenye bili kwanza!");
      return;
    }

    setIsVerifying(true);
    setVerificationPhase('align');
    speak("Mteja anaombwa kutabasamu mbele ya kamera ili kulipa bili.");

    // Check if customer is unregistered
    if (selectedCustomer.isRegistered === false) {
      setTimeout(() => {
        setVerificationPhase('unregistered');
        setIsVerifying(false);
        speak("Samahani, uso wako haujasajiliwa kwenye PapoPay. Tafadhali sajili uso wako ili uweze kulipa.");
        toast.error("Uso Haujasajiliwa! Mteja bado hajasajili Face ID.", { icon: '⚠️' });
      }, 1500);
      return;
    }

    setTimeout(() => {
      setVerificationPhase('verifying');
      speak("Inathibitisha uso na kukamilisha malipo ya kaunta...");

      setTimeout(() => {
        setVerificationPhase('success');
        setIsVerifying(false);
        playPaymentChime();
        triggerHapticTap();

        // Update sales metrics
        setTodaySales(prev => prev + cartTotal);
        setTodayCustomers(prev => prev + 1);

        // Deduct customer simulated wallet
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, walletBalance: Math.max(0, c.walletBalance - cartTotal) } : c));
        setSelectedCustomer(prev => ({ ...prev, walletBalance: Math.max(0, prev.walletBalance - cartTotal) }));

        speak(`Malipo ya shilingi ${cartTotal.toLocaleString()} yamethibitishwa kwa uso wa ${selectedCustomer.name.split(' ')[0]}. Risiti ya TRA imetolewa. Asante na karibu tena.`);
        toast.success(`Malipo ya TZS ${cartTotal.toLocaleString()} Yamethibitishwa!`, { icon: '✨' });

        const receipt = {
          txId: `POS-SALE-${Math.floor(100000 + Math.random() * 900000)}`,
          customerName: selectedCustomer.name,
          customerPhone: selectedCustomer.phone,
          customerPhoto: selectedCustomer.avatar,
          storeName: merchantProfile.merchantStoreName,
          posTerminalId: merchantProfile.posTerminalId,
          items: [...cartItems],
          amount: cartTotal,
          time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
          date: 'Leo'
        };

        setLastReceipt(receipt);
        setCartItems([]);

        setTimeout(() => setVerificationPhase('idle'), 3500);

      }, 1600);
    }, 1400);
  };

  const filteredCatalog = catalog.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#060a12] text-white flex flex-col">
      {/* TOP POS HEADER */}
      <header className="border-b border-white/10 bg-[#0a1120] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ScanFace className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  PapoPay Merchant POS
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/30">
                  {merchantProfile.posTerminalId}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Kaunta Ipo Tayari
                </span>
              </div>
              <p className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>{merchantProfile.merchantStoreName}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-neutral-500"><MapPin className="w-3 h-3" /> {merchantProfile.location}</span>
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
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <Link
              to="/wakala/dashboard"
              className="hidden sm:flex px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-emerald-400 items-center gap-1.5 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Portal ya Wakala</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('papopay_current_merchant');
                toast.info("Umetoka kwenye Merchant POS.");
                navigate('/merchant/login');
              }}
              className="p-2.5 sm:px-3.5 sm:py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Ondoka kwenye POS"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Toka POS</span>
            </button>
          </div>
        </div>
      </header>

      {/* METRICS & SETTLEMENT BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Sales */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#09152a] to-[#07101f] border border-cyan-500/30 shadow-lg flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-neutral-400">Mauzo ya Leo (Face POS)</span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
                TZS {todaySales.toLocaleString()}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Yamelipwa kwa Tabasamu (Smile-to-Pay)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettlementModalOpen(true)}
              className="mt-1 py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Toa kwenda Benki / M-Pesa</span>
            </button>
          </div>

          {/* Card 2: Customers Served */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222] border border-white/10 shadow-lg flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-neutral-400">Wateja Waliohudumiwa</span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                {todayCustomers} Wateja
              </div>
              <p className="text-[11px] text-emerald-400 mt-0.5 font-bold">Wastani: Sekunde 2 kwa Bili</p>
            </div>
            <span className="text-[11px] text-neutral-400 font-mono">Bila Foleni Kaunta</span>
          </div>

          {/* Card 3: Average Bill */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222] border border-white/10 shadow-lg flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-neutral-400">Wastani wa Bili (Ticket Size)</span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                TZS {todayCustomers > 0 ? Math.round(todaySales / todayCustomers).toLocaleString() : '0'}
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Kwa kila ununuzi wa mteja</p>
            </div>
            <span className="text-[11px] text-cyan-400 font-mono font-bold">BOT &amp; TRA EFD Verified</span>
          </div>

          {/* Card 4: Business Category Switcher */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#091222] border border-white/10 shadow-lg flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-neutral-400">Aina ya Kaunta Yako</span>
            <div className="grid grid-cols-3 gap-1.5 my-2">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('duka');
                  triggerHapticTap();
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  activeCategory === 'duka' ? 'bg-cyan-500 text-neutral-950 font-black shadow-md' : 'bg-white/5 text-neutral-400'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Duka</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('mgahawa');
                  triggerHapticTap();
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  activeCategory === 'mgahawa' ? 'bg-cyan-500 text-neutral-950 font-black shadow-md' : 'bg-white/5 text-neutral-400'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Mgahawa</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('hotel');
                  triggerHapticTap();
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  activeCategory === 'hotel' ? 'bg-cyan-500 text-neutral-950 font-black shadow-md' : 'bg-white/5 text-neutral-400'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Hotel</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">Katalogi inabadilika kiotomatiki</p>
          </div>
        </div>

        {/* MAIN POS VIEW: CAMERA SCANNER (LEFT) & BILLING CART (RIGHT) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: CUSTOMER CAMERA SCANNER & SIMULATOR (6 COLS) */}
          <div className="lg:col-span-6 flex flex-col items-center space-y-4">
            <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden border-4 border-cyan-500/40 bg-black flex items-center justify-center shadow-2xl shadow-cyan-950/60">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />

              {/* 3D Face Biometric Canvas */}
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
                faceConfidence={selectedCustomer.isRegistered ? 99.2 : 0}
                lightingQuality={94}
                distanceCm={42}
              />

              {/* Top Corner AI Tag */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Customer Face Scanner &bull; Smile-to-Pay</span>
                </span>
              </div>

              {/* HUD Mode Switcher */}
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
                    Uso Haujasajiliwa Kwenye PapoPay ⚠️
                  </span>
                  <h3 className="text-xl font-black text-white">
                    MTEJA HAJAJISAJILI!
                  </h3>
                  <p className="text-amber-200 text-xs font-medium mt-1 max-w-xs">
                    Mteja anaweza kujisajili kwa sekunde 30 tu ili kuanza kulipa kwa uso popote.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsEnrollOpen(true)}
                    className="mt-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Sajili Mteja Mpya Hapa (Face ID)</span>
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
                    BILI IMELIPWA KIKAMILIFU!
                  </h3>
                  <p className="text-emerald-300 text-xs font-bold mt-1">
                    {selectedCustomer.name} &bull; TZS {cartTotal.toLocaleString()}
                  </p>
                </motion.div>
              )}

              {/* Bottom Customer Info inside Camera Viewport */}
              <div className="absolute bottom-3 inset-x-3 z-20 bg-black/85 backdrop-blur-md p-3 rounded-2xl border border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={selectedCustomer.avatar}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-cyan-400"
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
                  <span className="text-sm font-mono font-bold text-cyan-300">
                    TZS {selectedCustomer.walletBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Switcher Simulator for testing */}
            <div className="w-full bg-[#0a1120] p-3.5 rounded-2xl border border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-neutral-400 block">
                Simulate Mteja Mbele ya Kaunta:
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

          {/* RIGHT: POS BILLING & CATALOG (6 COLS) */}
          <div className="lg:col-span-6 flex flex-col space-y-4">
            {/* Quick Catalog Items */}
            <div className="bg-[#0a1120] p-4 sm:p-5 rounded-3xl border border-cyan-500/30 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">
                  Katalogi ya Haraka ({activeCategory.toUpperCase()}):
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">Bofya kuongeza</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredCatalog.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left flex items-center gap-2 transition-all active:scale-95"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-white truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-cyan-300">TZS {item.price.toLocaleString()}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Add Custom Product Input */}
              <form onSubmit={handleAddCustomProduct} className="pt-2 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  placeholder="Kitu Maalum..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 px-3 py-2 rounded-xl text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="Bei"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-24 bg-black/50 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono text-cyan-300"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ongeza</span>
                </button>
              </form>
            </div>

            {/* Active Bill Cart */}
            <div className="bg-[#0a1120] p-4 sm:p-5 rounded-3xl border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Bili ya Sasa Kaunta ({cartItems.length} Vitu)</span>
                </div>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Safisha Bili</span>
                  </button>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {cartItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 italic">
                    Bili haina vitu. Chagua bidhaa kutoka kwenye katalogi hapo juu.
                  </div>
                ) : (
                  cartItems.map(item => (
                    <div key={item.id} className="p-2.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[180px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-cyan-300 font-bold">TZS {(item.price * item.qty).toLocaleString()}</span>
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

              {/* Grand Total */}
              <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-neutral-400 block">Jumla ya Kulipwa</span>
                  <span className="text-[10px] text-emerald-400 font-mono">VAT (18%) Imejumuishwa</span>
                </div>
                <span className="text-2xl font-black font-mono text-cyan-300">
                  TZS {cartTotal.toLocaleString()}
                </span>
              </div>

              {/* Smile to Pay Checkout Button */}
              <button
                type="button"
                disabled={isVerifying || cartItems.length === 0}
                onClick={handleExecuteFaceCheckout}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
              >
                {isVerifying ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <ScanFace className="w-5 h-5" />
                )}
                <span>
                  {isVerifying
                    ? 'Inasoma Uso na Kuthibitisha Malipo...'
                    : `Lipa Bili TZS ${cartTotal.toLocaleString()} kwa Tabasamu`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SETTLEMENT MODAL */}
      <AnimatePresence>
        {isSettlementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0b1222] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-6 text-white space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Toa Mauzo kwenda Benki / M-Pesa</h3>
                <button type="button" onClick={() => setIsSettlementModalOpen(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/50 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Salio Linaloweza Kutolewa</span>
                <div className="text-2xl font-black font-mono text-cyan-300">
                  TZS {todaySales.toLocaleString()}
                </div>
                <p className="text-[10px] text-neutral-400">{merchantProfile.settlementAccount}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTodaySales(0);
                  setIsSettlementModalOpen(false);
                  toast.success("Pesa zimehamishwa kikamilifu kwenye akaunti yako ya biashara!");
                  speak("Pesa za mauzo zimehamishwa kikamilifu.");
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase"
              >
                Hamisha Pesa Zote Sasa (Instant Settlement)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIGITAL RECEIPT MODAL */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0b1222] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black">Stakabadhi ya Malipo ya Uso</h3>
                <p className="text-[10px] font-mono text-cyan-300">{lastReceipt.txId}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/60 border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">{lastReceipt.storeName}</span>
                <span className="text-2xl font-black font-mono text-cyan-300">
                  TZS {lastReceipt.amount.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-400 font-mono mt-0.5">Uso Umethibitishwa: 99.4% Match</p>
              </div>

              <div className="space-y-1 text-xs font-mono text-neutral-300 border-t border-b border-white/10 py-2.5 max-h-32 overflow-y-auto">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mteja:</span>
                  <span className="font-bold text-white">{lastReceipt.customerName}</span>
                </div>
                {lastReceipt.items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between text-neutral-400">
                    <span>{it.qty}x {it.name}</span>
                    <span>TZS {(it.price * it.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/pos/receipt/${lastReceipt.txId}`} size={80} />
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
                  className="py-2.5 rounded-xl bg-cyan-500 text-neutral-950 font-black text-xs uppercase"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ON-THE-SPOT ENROLLMENT MODAL */}
      <FaceRegistrationModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        initialName="Mteja Mpya Kaunta"
        initialPhone="0769 000 111"
        onSuccess={(regData) => {
          const newCust = {
            id: `cust_${Date.now()}`,
            name: regData.name,
            phone: regData.phone,
            walletBalance: 250000,
            faceEmbeddingId: regData.embeddingId,
            avatar: regData.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isRegistered: true
          };
          setCustomers(prev => [newCust, ...prev]);
          setSelectedCustomer(newCust);
          setVerificationPhase('idle');
          toast.success(`Uso wa ${regData.name} umesajiliwa kikamilifu! Sasa anaweza kulipa bili kwa uso.`);
          speak(`Uso wa ${regData.name.split(' ')[0]} umesajiliwa kikamilifu kwenye kaunta.`);
        }}
      />
    </div>
  );
}
