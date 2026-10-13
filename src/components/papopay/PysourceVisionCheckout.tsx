import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scan, ShoppingBag, ShoppingCart, CheckCircle2, AlertCircle, X, 
  Camera, RefreshCw, Zap, Sparkles, Plus, Trash2, Receipt, 
  Volume2, VolumeX, ShieldCheck, Activity, Check, QrCode, 
  Eye, Sliders, Cpu, ArrowRight, CornerDownRight, Package,
  UserX, UserPlus
} from 'lucide-react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { toast } from 'sonner';

export interface GroceryItem {
  id: string;
  name: string;
  category: 'vinywaji' | 'mkate_nafaka' | 'maziwa' | 'matunda' | 'usafi';
  price: number;
  confidence: number;
  classTag: string;
  color: string;
  image: string;
  // Bounding box simulated relative coordinates (percentage 0-100)
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  weight?: string;
}

// Preset store items available for YOLO detection
export const STORE_PRESET_ITEMS: GroceryItem[] = [
  {
    id: 'item_asas_milk',
    name: 'Maziwa ya Asas Fresh (500ml)',
    category: 'maziwa',
    price: 2500,
    confidence: 98.4,
    classTag: 'asas_fresh_milk_500ml',
    color: '#06b6d4', // Cyan
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=200&auto=format&fit=crop&q=80',
    box: { x: 12, y: 15, width: 22, height: 35 },
    weight: '500 ml'
  },
  {
    id: 'item_bakhresa_bread',
    name: 'Mkate wa Bakhresa Super Loaf',
    category: 'mkate_nafaka',
    price: 1800,
    confidence: 97.2,
    classTag: 'bakhresa_super_loaf',
    color: '#f59e0b', // Amber
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=80',
    box: { x: 38, y: 10, width: 26, height: 38 },
    weight: '800 g'
  },
  {
    id: 'item_coca_cola',
    name: 'Coca-Cola Baridi (350ml Glass)',
    category: 'vinywaji',
    price: 1200,
    confidence: 99.1,
    classTag: 'coca_cola_bottle_350ml',
    color: '#ef4444', // Red
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&auto=format&fit=crop&q=80',
    box: { x: 68, y: 18, width: 20, height: 32 },
    weight: '350 ml'
  },
  {
    id: 'item_unga_sembe',
    name: 'Unga wa Sembe Taifa (2kg)',
    category: 'mkate_nafaka',
    price: 4500,
    confidence: 96.8,
    classTag: 'taifa_sembe_flour_2kg',
    color: '#10b981', // Emerald
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=80',
    box: { x: 15, y: 55, width: 25, height: 36 },
    weight: '2.0 kg'
  },
  {
    id: 'item_kilimanjaro_coffee',
    name: 'Kahawa ya Kilimanjaro Arabica (250g)',
    category: 'vinywaji',
    price: 6500,
    confidence: 98.7,
    classTag: 'kili_coffee_arabica',
    color: '#8b5cf6', // Purple
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=200&auto=format&fit=crop&q=80',
    box: { x: 44, y: 52, width: 22, height: 34 },
    weight: '250 g'
  },
  {
    id: 'item_uhai_water',
    name: 'Maji ya Uhai Safi (1.5 Litre)',
    category: 'vinywaji',
    price: 1000,
    confidence: 99.3,
    classTag: 'uhai_pure_water_1.5L',
    color: '#3b82f6', // Blue
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=200&auto=format&fit=crop&q=80',
    box: { x: 70, y: 54, width: 20, height: 38 },
    weight: '1.5 L'
  },
  {
    id: 'item_fresh_apples',
    name: 'Matunda - Maapulo Fresh (Pack ya 4)',
    category: 'matunda',
    price: 3500,
    confidence: 95.5,
    classTag: 'fresh_red_apples_4pack',
    color: '#ec4899', // Pink
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=200&auto=format&fit=crop&q=80',
    box: { x: 40, y: 32, width: 24, height: 30 },
    weight: '600 g'
  },
  {
    id: 'item_omo_soap',
    name: 'Sabuni ya Omo Multi-Active (500g)',
    category: 'usafi',
    price: 3200,
    confidence: 97.9,
    classTag: 'omo_washing_powder_500g',
    color: '#0284c7', // Sky Blue
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=200&auto=format&fit=crop&q=80',
    box: { x: 18, y: 35, width: 22, height: 32 },
    weight: '500 g'
  }
];

interface PysourceVisionCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance?: number;
  onPaymentSuccess?: (amount: number, receiptDesc: string) => void;
}

export const PysourceVisionCheckout: React.FC<PysourceVisionCheckoutProps> = ({
  isOpen,
  onClose,
  userBalance = 240000,
  onPaymentSuccess
}) => {
  // Current items placed on the counter table
  const [activeItems, setActiveItems] = useState<GroceryItem[]>([
    STORE_PRESET_ITEMS[0], // Asas Milk
    STORE_PRESET_ITEMS[1], // Bakhresa Bread
    STORE_PRESET_ITEMS[2]  // Coca Cola
  ]);

  // Pysource Computer Vision State
  const [modelType, setModelType] = useState<'yolov11_edge' | 'yolov8_segment' | 'yolov11_accurate'>('yolov11_edge');
  const [fps, setFps] = useState(30);
  const [inferenceTimeMs, setInferenceTimeMs] = useState(16.4);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [showMasks, setShowMasks] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Checkout & Payment State
  const [paymentMethod, setPaymentMethod] = useState<'face' | 'nfc' | 'wallet'>('face');
  const [isUserFaceRegistered, setIsUserFaceRegistered] = useState(true);
  const [isFaceRegisterOpen, setIsFaceRegisterOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [receipt, setLastReceipt] = useState<{
    id: string;
    itemsCount: number;
    subtotal: number;
    vat: number;
    total: number;
    time: string;
    method: string;
    yoloAccuracy: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Calculate Subtotals & Totals
  const subtotal = activeItems.reduce((acc, it) => acc + it.price, 0);
  const vatAmount = Math.round(subtotal * 0.18); // 18% VAT in Tanzania
  const grandTotal = subtotal + vatAmount;

  // Swahili TTS helper
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

  // Camera Management
  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Using simulation fallback", err);
      setUseRealCamera(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && useRealCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, useRealCamera]);

  // Real-time jitter simulator for FPS and inference time (Pysource edge metrics)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setFps(Math.floor(29 + Math.random() * 3));
      setInferenceTimeMs(+(15.2 + Math.random() * 2.5).toFixed(1));
    }, 1500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Item Table Manipulation
  const handleAddItemToCounter = (item: GroceryItem) => {
    if (activeItems.some(i => i.id === item.id)) {
      toast.info(`${item.name} tayari ipo kwenye kaunta.`);
      return;
    }
    setActiveItems(prev => [...prev, item]);
    triggerHapticTap();
    speak(`Kitu kimetambuliwa: ${item.name.split(' ')[0]}`);
    toast.success(`YOLO Imetambua: ${item.name} (TZS ${item.price.toLocaleString()})`, {
      icon: '🛒'
    });
  };

  const handleRemoveItemFromCounter = (itemId: string) => {
    const item = activeItems.find(i => i.id === itemId);
    setActiveItems(prev => prev.filter(i => i.id !== itemId));
    triggerHapticTap();
    if (item) {
      toast.info(`Kitu kimeondolewa mezani: ${item.name}`);
    }
  };

  const handleClearTable = () => {
    setActiveItems([]);
    triggerHapticTap();
    toast.info("Meza ya kaunta imesafishwa.");
  };

  const handleLoadFullBasket = () => {
    setActiveItems(STORE_PRESET_ITEMS.slice(0, 5));
    triggerHapticTap();
    speak("Vitu vitano vimetambuliwa mezani.");
    toast.success("Kikapu cha vitu 5 kimewekwa mezani!");
  };

  // Execute Instant One-Click Payment
  const handleProcessCheckout = () => {
    if (activeItems.length === 0) {
      toast.error("Weka vitu kwenye meza ya kaunta ili kulipa!");
      return;
    }

    if (userBalance < grandTotal) {
      toast.error("Salio la mkoba wako halitoshi!");
      return;
    }

    // Check if customer using Face Pay is unregistered
    if (paymentMethod === 'face' && !isUserFaceRegistered) {
      speak("Samahani, uso wako haujasajiliwa kwenye PapoPay. Tafadhali jisajili uso wako kwanza ili kukamilisha malipo haya.");
      toast.error("Uso Haujasajiliwa! Tafadhali sajili uso wako kwenye PapoPay kwanza ili kulipa.", {
        icon: '⚠️'
      });
      setIsFaceRegisterOpen(true);
      return;
    }

    setIsProcessingPayment(true);
    speak("Inathibitisha vitu na kukamilisha malipo ya PapoPay");

    setTimeout(() => {
      playPaymentChime();
      triggerHapticTap();

      const txId = `PAPO-YOLO-${Math.floor(100000 + Math.random() * 900000)}`;
      const newReceipt = {
        id: txId,
        itemsCount: activeItems.length,
        subtotal,
        vat: vatAmount,
        total: grandTotal,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        method: paymentMethod === 'face' ? 'PapoPay Face Recognition' : paymentMethod === 'nfc' ? 'PapoPay NFC Tap' : 'PapoPay Wallet',
        yoloAccuracy: 98.6
      };

      setLastReceipt(newReceipt);
      setIsProcessingPayment(false);

      if (onPaymentSuccess) {
        onPaymentSuccess(grandTotal, `Smart Kaunta: Vitu ${activeItems.length} (YOLO Checkout)`);
      }

      speak(`Malipo ya shilingi elfu ${Math.round(grandTotal / 1000)} yamekamilika. Asante na karibu tena.`);
      toast.success(`Malipo ya TZS ${grandTotal.toLocaleString()} Yamethibitishwa! Risiti Imetolewa.`, {
        icon: '🧾'
      });
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2800] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-5xl max-h-[94vh] overflow-y-auto bg-[#0a0f1d] border border-cyan-500/40 rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-cyan-950/80 flex flex-col text-white"
        >
          {/* Header Bar */}
          <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#0b1324] via-[#0e1830] to-[#121f3d]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Scan className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Smart Shopping Cart &amp; Kaunta ya Vitu
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider">
                    Pysource YOLO Vision
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Utambuzi wa papo hapo wa bidhaa zote mezani bila barcode (Instant Multi-Item Detection &amp; Auto Bill)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                title={soundEnabled ? 'Zima Sauti' : 'Washa Sauti'}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader: Pysource Edge Performance HUD */}
          <div className="px-5 sm:px-6 py-2.5 bg-black/50 border-b border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-neutral-300 gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-bold">MODEL: {modelType.toUpperCase()}</span>
              </div>
              <span className="text-emerald-400 font-bold">FPS: {fps}</span>
              <span className="text-cyan-400 font-bold">INFERENCE: {inferenceTimeMs}ms</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-neutral-400">VITU MEZANI:</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold font-mono">
                {activeItems.length} Detected
              </span>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT: Pysource Tabletop Vision Canvas (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              {/* Vision Surface Viewport */}
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-[#05070e] border-2 border-cyan-500/40 shadow-inner flex items-center justify-center select-none">
                
                {/* Background Grid Table Texture */}
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #06b6d4 1px, transparent 0)`,
                    backgroundSize: '24px 24px'
                  }}
                />

                {/* Counter Belt Outline */}
                <div className="absolute inset-4 rounded-2xl border border-dashed border-cyan-500/30 pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] tracking-widest font-mono text-cyan-400/30 uppercase">
                    ENEO LA KAUNTA / CONVEYOR TRAY CHECKOUT ZONE
                  </span>
                </div>

                {/* Real Web Camera or Studio Tabletop Simulation */}
                {useRealCamera ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}

                {/* Active Items on Table (with Pysource YOLO Bounding Boxes & Centroids) */}
                {activeItems.length === 0 ? (
                  <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                      <Package className="w-8 h-8 opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-neutral-300">
                        Kaunta Haina Vitu kwa Sasa
                      </p>
                      <p className="text-xs text-neutral-500 max-w-xs">
                        Bofya vitu vilivyo hapa chini au chagua "Weka Kikapu Kamili" ili kuona jinsi YOLO inavyovitambua mara moja!
                      </p>
                    </div>
                  </div>
                ) : (
                  activeItems.map((item, idx) => {
                    const isPassedThreshold = item.confidence >= confidenceThreshold;
                    return (
                      <div
                        key={item.id}
                        className="absolute transition-all duration-300"
                        style={{
                          left: `${item.box.x}%`,
                          top: `${item.box.y}%`,
                          width: `${item.box.width}%`,
                          height: `${item.box.height}%`
                        }}
                      >
                        {/* Realistic Item Card inside Bounding Box */}
                        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black/60 backdrop-blur-sm border-2 shadow-2xl flex flex-col justify-between group"
                             style={{ borderColor: item.color }}>
                          
                          {/* Top YOLO Annotation Tag (Pysource Style) */}
                          <div 
                            className="px-1.5 py-0.5 text-[9px] font-mono font-black flex items-center justify-between text-neutral-950 uppercase"
                            style={{ backgroundColor: item.color }}
                          >
                            <span className="truncate">#{idx + 1} {item.classTag}</span>
                            <span>{item.confidence.toFixed(1)}%</span>
                          </div>

                          {/* Item Thumbnail */}
                          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-1">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="max-h-full max-w-full object-contain rounded-lg drop-shadow-md"
                            />

                            {/* Centroid Crosshair Marker (Pysource style) */}
                            {showCentroids && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3 h-3 rounded-full border border-white bg-red-500/80 shadow-md animate-ping" />
                                <div className="w-1.5 h-1.5 rounded-full bg-white absolute" />
                              </div>
                            )}

                            {/* Delete button on hover / touch */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItemFromCounter(item.id);
                              }}
                              className="absolute top-1 right-1 p-1 rounded-lg bg-black/80 hover:bg-red-600 text-white transition-colors"
                              title="Ondoa kitu mezani"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Bottom Price Pill */}
                          <div className="p-1 px-1.5 bg-black/85 flex items-center justify-between text-[10px] font-bold">
                            <span className="text-white truncate max-w-[70px]">{item.name.split(' ')[0]}</span>
                            <span className="text-emerald-400 font-mono">TZS {item.price.toLocaleString()}</span>
                          </div>

                          {/* Corner Reticles */}
                          <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-white pointer-events-none" />
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-white pointer-events-none" />
                          <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-white pointer-events-none" />
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-white pointer-events-none" />
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Laser Scanning Line Animation */}
                <motion.div
                  animate={{ y: [-150, 260, -150] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] pointer-events-none"
                />

                {/* Top Overlay Stats */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                    CAM-VIEW: TOP-DOWN TRAY #01
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>YOLO LIVE SCANNER: ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* Vision Mode & Camera Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUseRealCamera(!useRealCamera)}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors ${
                      useRealCamera 
                        ? 'bg-cyan-500 text-neutral-950 font-black' 
                        : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{useRealCamera ? 'Tumia Kaunta ya Video' : 'Washa Kamera ya Simu'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCentroids(!showCentroids)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                      showCentroids ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'bg-white/5 text-neutral-400'
                    }`}
                  >
                    Centroids &bull; {showCentroids ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadFullBasket}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-1 shadow-md shadow-emerald-700/20"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Weka Kikapu Kamili</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearTable}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-300 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Futa Meza</span>
                  </button>
                </div>
              </div>

              {/* Shelf / Products to Add to Counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Vitu vya Dukani (Bofya kuweka mezani):</span>
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Bofya kitu chochote kuingiza kwenye scan
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STORE_PRESET_ITEMS.map((item) => {
                    const isAlreadyOnCounter = activeItems.some(i => i.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (isAlreadyOnCounter) {
                            handleRemoveItemFromCounter(item.id);
                          } else {
                            handleAddItemToCounter(item);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isAlreadyOnCounter
                            ? 'bg-cyan-500/20 border-cyan-400/80 text-white shadow-md shadow-cyan-900/30'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-8 h-8 rounded-lg object-cover bg-neutral-900 shrink-0" 
                          />
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-emerald-400 font-mono font-bold">
                              TZS {item.price.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                          <span className="text-neutral-400">{item.weight}</span>
                          <span className={`font-bold ${isAlreadyOnCounter ? 'text-cyan-300' : 'text-neutral-500'}`}>
                            {isAlreadyOnCounter ? '✓ Mezani' : '+ Weka'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* RIGHT: Real-time Smart Bill & Payment Options (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              {/* Smart Receipt / Cart Container */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-[#111a33] to-[#0c1324] border border-cyan-500/30 space-y-4 shadow-xl">
                
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Bili ya Papo Hapo (Auto Smart Bill)
                      </h3>
                      <p className="text-[10px] text-neutral-400">
                        Haitaji kuchanganua barcode &bull; Pysource Vision
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    {activeItems.length} BIDHAA
                  </span>
                </div>

                {/* Detected Items List */}
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500">
                      Bado hakuna bidhaa zilizotambuliwa mezani.
                    </div>
                  ) : (
                    activeItems.map((item, idx) => (
                      <div 
                        key={item.id}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              Conf: {item.confidence.toFixed(1)}% &bull; {item.weight}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="font-mono font-black text-cyan-300">
                            TZS {item.price.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromCounter(item.id)}
                            className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Subtotals & Taxes */}
                <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Jumla Ndogo (Subtotal):</span>
                    <span className="font-mono text-white">TZS {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Kodi ya Ongezeko la Thamani (VAT 18%):</span>
                    <span className="font-mono text-neutral-300">TZS {vatAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
                    <span className="text-sm font-black text-white">JUMLA KUU:</span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      TZS {grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Chagua Njia ya Malipo ya PapoPay:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'face' as const, label: 'Lipa kwa Uso', desc: 'Face Pay' },
                      { id: 'nfc' as const, label: 'Lipa kwa NFC', desc: 'Tap & Pay' },
                      { id: 'wallet' as const, label: 'PapoPay Wallet', desc: 'Salio la Mkoba' }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-2.5 rounded-2xl text-center border transition-all ${
                          paymentMethod === m.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-900/40'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 text-neutral-400'
                        }`}
                      >
                        <p className="text-xs font-black text-white">{m.label}</p>
                        <p className="text-[9px] text-cyan-300">{m.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Face ID Registration Status & Quick Tester */}
                  {paymentMethod === 'face' && (
                    <div className="flex items-center justify-between text-[11px] p-2.5 rounded-2xl bg-white/5 border border-white/10 mt-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isUserFaceRegistered ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className={isUserFaceRegistered ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                          {isUserFaceRegistered ? "Uso: Umesajiliwa" : "Uso: Haujasajiliwa"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = !isUserFaceRegistered;
                            setIsUserFaceRegistered(newStatus);
                            if (!newStatus) {
                              toast.warning("Hali imewekwa kuwa: Mtu Asiyesajiliwa! Ukibofya Lipa Sasa utaambiwa ujisajili.");
                            } else {
                              toast.success("Hali imewekwa kuwa: Uso Umesajiliwa.");
                            }
                          }}
                          className="text-[10px] text-cyan-300 underline font-mono hover:text-white"
                        >
                          {isUserFaceRegistered ? "Jaribu Asiyesajiliwa" : "Weka Aliyesajiliwa"}
                        </button>
                        {!isUserFaceRegistered && (
                          <button
                            type="button"
                            onClick={() => setIsFaceRegisterOpen(true)}
                            className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px]"
                          >
                            Sajili Sasa
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Action Button */}
                <button
                  type="button"
                  disabled={activeItems.length === 0 || isProcessingPayment}
                  onClick={handleProcessCheckout}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-teal-500/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isProcessingPayment ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Inachakata Malipo ya Kaunta...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>
                        Lipa Sasa (TZS {grandTotal.toLocaleString()})
                      </span>
                    </>
                  )}
                </button>

                {/* Wallet Balance Info */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span>Salio Lako la PapoPay:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    TZS {userBalance.toLocaleString()}
                  </span>
                </div>

              </div>

              {/* Instant Digital Receipt Display */}
              {receipt && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-black text-white">
                        Risiti ya Kidijitali ya Kaunta
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {receipt.id}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/60 border border-white/5 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-neutral-400">
                      <span>Muda:</span>
                      <span className="text-white">{receipt.time}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Njia:</span>
                      <span className="text-cyan-300">{receipt.method}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Jumla Imelipwa:</span>
                      <span className="text-emerald-400 font-black text-sm">
                        TZS {receipt.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>YOLO Detection:</span>
                      <span className="text-emerald-300">100% Pass (No Barcode Required)</span>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>

          </div>

          {/* Footer Bar */}
          <div className="p-4 px-6 bg-black/70 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Teknolojia ya Pysource (Sergio Canu) &bull; YOLO Instance Object Detection &amp; Zero-Barcode Checkout</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-400">
              Station ID: TZ-DAR-SMART-CHECKOUT-09
            </span>
          </div>

        </motion.div>

        {/* Live Face Registration Modal for Smart Counter */}
        <FaceRegistrationModal
          isOpen={isFaceRegisterOpen}
          onClose={() => setIsFaceRegisterOpen(false)}
          initialName="Mteja wa Duka"
          onSuccess={(regData) => {
            setIsUserFaceRegistered(true);
            speak(`Hongera ${regData.name.split(' ')[0]}! Uso wako umesajiliwa. Sasa unaweza kukamilisha malipo yako ya kaunta.`);
            toast.success(`Uso wa ${regData.name} umesajiliwa! Unaweza kulipa sasa kwa uso.`);
          }}
        />
      </div>
    </AnimatePresence>
  );
};
