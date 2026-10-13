import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck, 
  Camera, RefreshCw, Zap, Sparkles, Smile, Eye, UserCheck, 
  Store, Bus, Utensils, Receipt, Printer, ArrowRight, 
  Volume2, VolumeX, ShieldAlert, Activity, Check, QrCode
} from 'lucide-react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { toast } from 'sonner';

interface PapoPayKioskTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceDeduct?: (amount: number, description: string) => void;
}

type KioskMode = 'transit_gate' | 'restaurant_counter' | 'retail_checkout';

interface SimulatedCustomer {
  id: string;
  name: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  category: string;
}

const CUSTOMERS_DB: SimulatedCustomer[] = [
  {
    id: 'cust_01',
    name: 'Baraka Juma Mkuki',
    walletBalance: 240000,
    faceEmbeddingId: 'EMB-TZ-8841-BJM',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    category: 'Mteja Binafsi'
  },
  {
    id: 'cust_02',
    name: 'Amina Saidi Salum',
    walletBalance: 85500,
    faceEmbeddingId: 'EMB-TZ-1092-ASS',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    category: 'Abiria BRT / Mwanafunzi'
  },
  {
    id: 'cust_03',
    name: 'Emanuel Peter Mollel',
    walletBalance: 610000,
    faceEmbeddingId: 'EMB-TZ-5531-EPM',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    category: 'Mfanyabiashara'
  }
];

export const PapoPayKioskTerminal: React.FC<PapoPayKioskTerminalProps> = ({
  isOpen,
  onClose,
  onBalanceDeduct
}) => {
  const [kioskMode, setKioskMode] = useState<KioskMode>('transit_gate');
  const [selectedCustomer, setSelectedCustomer] = useState<SimulatedCustomer>(CUSTOMERS_DB[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fps, setFps] = useState(30);
  const [recentTransactions, setRecentTransactions] = useState<Array<{
    id: string;
    customer: string;
    item: string;
    amount: number;
    time: string;
    mode: KioskMode;
  }>>([
    {
      id: 'TX-KIO-901',
      customer: 'Amina Saidi',
      item: 'Nauli ya BRT Express (Kimara - Posta)',
      amount: 650,
      time: '16:22',
      mode: 'transit_gate'
    },
    {
      id: 'TX-KIO-900',
      customer: 'Emanuel Mollel',
      item: 'Kahawa Espresso + Croissant',
      amount: 8500,
      time: '16:15',
      mode: 'restaurant_counter'
    }
  ]);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // Pysource YOLO Vision Items for Retail Self-Checkout Mode
  const [retailItems, setRetailItems] = useState<Array<{ id: string; name: string; price: number; conf: number }>>([
    { id: 'it_1', name: 'Maziwa Asas Fresh 500ml', price: 2500, conf: 98.4 },
    { id: 'it_2', name: 'Mkate Bakhresa Super Loaf', price: 1800, conf: 97.2 },
    { id: 'it_3', name: 'Coca-Cola Baridi 350ml', price: 1200, conf: 99.1 },
    { id: 'it_4', name: 'Kahawa Kilimanjaro 250g', price: 6500, conf: 98.7 }
  ]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Price presets based on Mode
  const getModeFare = (mode: KioskMode) => {
    switch (mode) {
      case 'transit_gate': return 650;
      case 'restaurant_counter': return 14500;
      case 'retail_checkout': return retailItems.reduce((acc, i) => acc + i.price, 0);
    }
  };

  const getModeTitle = (mode: KioskMode) => {
    switch (mode) {
      case 'transit_gate': return 'Lango la BRT & Metro (Turnstile Gate 02)';
      case 'restaurant_counter': return 'Kaunta ya Chakula & Kahawa (Papo Hapo Cafe)';
      case 'retail_checkout': return 'Self-Checkout Kiosk (Duka / Supermarket)';
    }
  };

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
      console.warn("Kiosk camera using simulation fallback", err);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      const interval = setInterval(() => {
        setFps(Math.floor(29 + Math.random() * 3));
      }, 2000);
      return () => clearInterval(interval);
    } else {
      stopCamera();
      setIsGateOpen(false);
      setIsScanning(false);
    }
    return () => stopCamera();
  }, [isOpen]);

  // Execute Real-Time Face Recognition & Payment
  const triggerFaceRecognitionPass = () => {
    if (isScanning) return;
    setIsScanning(true);
    setIsGateOpen(false);

    speak("Inasoma uso na kuthibitisha");

    setTimeout(() => {
      // Step 2: Recognized!
      const fare = getModeFare(kioskMode);
      playPaymentChime();
      triggerHapticTap();

      const newTxId = `PAPO-KIO-${Math.floor(100000 + Math.random() * 900000)}`;
      const receipt = {
        id: newTxId,
        txId: newTxId,
        customer: selectedCustomer.name,
        amount: fare,
        item: getModeTitle(kioskMode),
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        faceConfidence: 99.4,
        mode: kioskMode
      };

      setLastReceipt(receipt);
      setRecentTransactions(prev => [receipt, ...prev.slice(0, 4)]);

      if (onBalanceDeduct) {
        onBalanceDeduct(fare, `${getModeTitle(kioskMode)} via Face Kiosk`);
      }

      if (kioskMode === 'transit_gate') {
        setIsGateOpen(true);
        speak(`Lango limefunguliwa. Karibu ${selectedCustomer.name.split(' ')[0]}`);
        toast.success(`BRT Gate 02 Limefunguliwa! TZS ${fare} zimekatwa.`, { icon: '🟢' });
      } else {
        speak(`Malipo ya shilingi elfu ${Math.round(fare / 1000)} yamekamilika.`);
        toast.success(`Malipo ya TZS ${fare.toLocaleString()} yamethibitishwa kwa uso!`, { icon: '✨' });
      }

      setIsScanning(false);

      // Auto close gate after 4 seconds
      if (kioskMode === 'transit_gate') {
        setTimeout(() => {
          setIsGateOpen(false);
        }, 4000);
      }

    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2600] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#0a0f1d] border border-cyan-500/40 rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-cyan-950/80 flex flex-col text-white"
        >
          {/* Kiosk Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#0d1527] to-[#121c33]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <ScanFace className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    PapoPay Express Terminal
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase tracking-wider">
                    Murtaza AI Kiosk
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Terminal ya Kaunta &amp; Mageti ya Usafiri (Cashier-less Face Recognition Checkout)
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
                {soundEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5" />}
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

          {/* Mode Selector Tabs */}
          <div className="px-5 sm:px-6 pt-4 flex flex-wrap gap-2">
            {[
              { id: 'transit_gate' as KioskMode, icon: Bus, label: 'Lango la BRT & Treni (Gate)' },
              { id: 'restaurant_counter' as KioskMode, icon: Utensils, label: 'Kaunta ya Mgahawa (Food)' },
              { id: 'retail_checkout' as KioskMode, icon: Store, label: 'Self-Checkout (Duka)' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = kioskMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setKioskMode(tab.id);
                    setIsGateOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all ${
                    isActive 
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/50' 
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Grid: Left is Camera HUD, Right is Transaction / Profile Details */}
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: Live Terminal Camera Viewport (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-black border-2 border-cyan-500/40 shadow-inner flex items-center justify-center">
                {/* Camera Feed */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />

                {/* HUD Top Bar */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-cyan-400 bg-black/60 px-3 py-1.5 rounded-2xl backdrop-blur-md border border-cyan-500/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-white font-bold">TERMINAL-CAM #01</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>FPS: {fps}</span>
                    <span>LIVENESS: 99.8%</span>
                  </div>
                </div>

                {/* Murtaza Face Detection Box Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-64 border-2 border-dashed border-cyan-400/70 rounded-3xl flex flex-col justify-between p-2 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-cyan-400" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-cyan-400" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-cyan-400" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-cyan-400" />

                    {/* Laser Scanner line */}
                    {isScanning && (
                      <motion.div
                        animate={{ y: [0, 210, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                        className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_15px_#22d3ee]"
                      />
                    )}

                    {/* Customer Tag Box below the face (Murtaza cvzone pattern) */}
                    <div className="mt-auto bg-black/80 backdrop-blur-md p-2 rounded-xl border border-cyan-500/40 text-left pointer-events-auto">
                      <div className="flex items-center gap-2">
                        <img 
                          src={selectedCustomer.avatar} 
                          alt="Face" 
                          className="w-8 h-8 rounded-full object-cover border border-cyan-400"
                        />
                        <div className="leading-tight">
                          <p className="text-xs font-black text-white truncate max-w-[140px]">
                            {selectedCustomer.name}
                          </p>
                          <p className="text-[10px] text-cyan-300 font-mono">
                            Match: 99.4% &bull; Live
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gate Opened Green Flash Overlay (If transit mode) */}
                {isGateOpen && kioskMode === 'transit_gate' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-emerald-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6"
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-[0_0_40px_#10b981] animate-bounce">
                      <Check className="w-10 h-10 stroke-[3]" />
                    </div>
                    <h3 className="text-2xl font-black text-white">
                      LANGO LIME FUNGULIWA!
                    </h3>
                    <p className="text-emerald-300 font-bold text-sm mt-1">
                      Pita salama &bull; Nauli TZS {getModeFare('transit_gate')} imelipwa
                    </p>
                    <span className="mt-4 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-400/40">
                      TURNSTILE GATE 02: OPEN 🟢
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Action Trigger Button */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={triggerFaceRecognitionPass}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-cyan-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Inachanganua Alama za Uso (Murtaza AI)...</span>
                    </>
                  ) : (
                    <>
                      <ScanFace className="w-5 h-5" />
                      <span>
                        {kioskMode === 'transit_gate' ? 'Soma Uso & Fungua Geti (Pass)' : `Thibitisha Malipo ya TZS ${getModeFare(kioskMode).toLocaleString()}`}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Simulated Customer Switcher (To test multi-face identification) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Chagua Mteja Mfano (Jaribu Nyuso Tofauti):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {CUSTOMERS_DB.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className={`p-2 rounded-xl flex items-center gap-2 text-left transition-all ${
                        selectedCustomer.id === c.id 
                          ? 'bg-cyan-500/20 border border-cyan-400 text-white' 
                          : 'bg-black/30 hover:bg-black/50 border border-white/5 text-neutral-400'
                      }`}
                    >
                      <img src={c.avatar} alt={c.name} className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{c.name.split(' ')[0]}</p>
                        <p className="text-[9px] text-cyan-300 font-mono">TZS {c.walletBalance.toLocaleString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Transaction Info, Digital Receipt & Live Logs (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              {/* Active Bill / Gate Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-b from-[#111a33] to-[#0d1428] border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-cyan-300 tracking-wider">
                    Bili ya Sasa (Active Terminal Bill)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-mono font-bold">
                    READY
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-neutral-200">
                    {getModeTitle(kioskMode)}
                  </h4>
                  <div className="text-3xl font-black font-mono text-cyan-400 mt-1">
                    TZS {getModeFare(kioskMode).toLocaleString()}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Mteja aliyetambuliwa:</span>
                    <span className="font-bold text-white">{selectedCustomer.name}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Salio la Mkoba:</span>
                    <span className="font-mono text-emerald-400 font-bold">TZS {selectedCustomer.walletBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Face ID Vector:</span>
                    <span className="font-mono text-cyan-300">{selectedCustomer.faceEmbeddingId}</span>
                  </div>
                </div>

                {/* If Retail Checkout: Show YOLO Detected Items Breakdown */}
                {kioskMode === 'retail_checkout' && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Vitu Vilivyotambuliwa Mezani (YOLO):
                      </span>
                      <span className="font-mono text-emerald-400">{retailItems.length} items</span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {retailItems.map((it, idx) => (
                        <div key={it.id} className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-white truncate text-[11px]">#{idx + 1} {it.name}</p>
                            <p className="text-[9px] text-cyan-400/80 font-mono">Conf: {it.conf}% &bull; No Barcode</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-emerald-400 text-xs">TZS {it.price.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => setRetailItems(prev => prev.filter(x => x.id !== it.id))}
                              className="text-neutral-500 hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newId = `it_${Date.now()}`;
                          setRetailItems(prev => [...prev, { id: newId, name: 'Unga wa Sembe Taifa 2kg', price: 4500, conf: 96.8 }]);
                          toast.success('YOLO Imetambua Unga wa Sembe Mezani (+ TZS 4,500)');
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-[10px] font-bold border border-cyan-500/20"
                      >
                        + Weka Kitu Mezani
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRetailItems([
                            { id: 'it_1', name: 'Maziwa Asas Fresh 500ml', price: 2500, conf: 98.4 },
                            { id: 'it_2', name: 'Mkate Bakhresa Super Loaf', price: 1800, conf: 97.2 },
                            { id: 'it_3', name: 'Coca-Cola Baridi 350ml', price: 1200, conf: 99.1 }
                          ]);
                          toast.info('Meza imewekwa upya');
                        }}
                        className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-[10px] font-bold"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Digital E-Receipt Showcase */}
              {lastReceipt && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-3xl bg-white/5 border border-emerald-500/40 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-black text-white">
                        Risiti ya Kidijitali ya Uso
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {lastReceipt.txId}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Muda:</span>
                      <span className="text-neutral-200">{lastReceipt.time}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Kiasi:</span>
                      <span className="font-black text-emerald-400">TZS {lastReceipt.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Anti-Spoofing:</span>
                      <span className="text-cyan-300 font-mono">Genuine Live Human (99.4%)</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Live Terminal Log */}
              <div className="p-4 rounded-3xl bg-[#090d18] border border-white/10 space-y-2.5 flex-1">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Miamala ya Hivi Karibuni Terminal</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">Live Sync</span>
                </div>

                <div className="space-y-2">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">{tx.customer}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{tx.item}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-cyan-400 font-mono">TZS {tx.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-neutral-500">{tx.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* Terminal Footer */}
          <div className="p-4 px-6 bg-black/60 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Inaendeshwa na Teknolojia ya Murtaza's Workshop &bull; OpenCV &amp; MediaPipe Face Mesh</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-400">
              Terminal ID: TZ-DAR-KIOSK-048
            </span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
