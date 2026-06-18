import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Utensils, 
  Bell, 
  Clock, 
  ChefHat, 
  CheckCircle2, 
  Volume2, 
  VolumeX,
  Calendar, 
  Sparkles, 
  AlertTriangle,
  Sun,
  Moon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Order } from '../types';

export default function PublicStatusDisplay() {
  const { vendorId } = useParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorName, setVendorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const [isNightMode, setIsNightMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  // Track announced orders to prevent repetitive voicing of old ready orders
  const announcedOrderIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  // High-fidelity synthesized Web Audio dual chime ("Ding!")
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Tone 1: Crystal-clear sine sweep
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5 principal note
      gain1.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 1.2);

      // Tone 2: Warm backing major third harmonizer for elite feedback
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5 chord note
      gain2.gain.setValueAtTime(0, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.35);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 1.35);
    } catch (err) {
      console.warn("Web Audio chime failed: ", err);
    }
  };

  // Swahili TTS Synthesis using native SpeechSynthesis Engine
  const speakSwahili = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech to prevent queuing lag
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Prioritize high-quality East African Swahili speaker if present
      const swVoice = voices.find(v => v.lang.startsWith('sw') || v.lang.toLowerCase().includes('swahili'));
      if (swVoice) {
        utterance.voice = swVoice;
      }
      utterance.rate = 0.88; // Comfortably measured rate for Swahili phonemes
      utterance.pitch = 1.02; // Warm, inviting pitch
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("SpeechSynthesis playback failed: ", err);
    }
  };
  
  // Rotating/Sliding announcements list in Swahili
  const announcements = [
    "Karibu PAPO HAPO Express! Tafadhali kagua namba yako ya oda wakati wa kukabidhiwa.",
    "Boresha maisha yako kwa kuweka oda na kulipa papo hapo ukitumia QR Kadi yetu ya meza!",
    "Chakula chako kikijaa kwenye upande wa machungwa 'READY', fika kaunta na risiti yako.",
    "Afya yako kipaumbele chetu! Chakula chote kinaandaliwa kwa uzingatiaji mkubwa wa usafi. Enjoy!",
    "Sasa unaweza kuagiza vinywaji baridi na vishawishi vya ziada bila kuondoka kwenye kiti chako."
  ];
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    // Listen for fullscreen change events to sync state icon
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    // Interlaced clock interval
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Announcement rotator interval
    const rotator = setInterval(() => {
      setAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(rotator);
    };
  }, [announcements.length]);

  useEffect(() => {
    if (!vendorId) return;

    // Fetch vendor info
    const fetchVendor = async () => {
      const vendorDoc = await getDoc(doc(db, 'vendors', vendorId));
      if (vendorDoc.exists()) {
        setVendorName(vendorDoc.data().businessName);
      }
    };
    fetchVendor();

    // Listen to active orders
    const q = query(
      collection(db, 'orders'),
      where('vendorId', '==', vendorId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const rawOrders = snapshot.docs.map(doc => {
          const data = doc.data();
          // Safe Conversion of createdAt timestamp/date for sorting in-memory
          let createdAtMs = 0;
          if (data.createdAt) {
            if (typeof data.createdAt.toMillis === 'function') {
              createdAtMs = data.createdAt.toMillis();
            } else if (data.createdAt.seconds) {
              createdAtMs = data.createdAt.seconds * 1000;
            } else {
              createdAtMs = new Date(data.createdAt).getTime();
            }
          }
          if (!createdAtMs || isNaN(createdAtMs)) {
            createdAtMs = Date.now();
          }

          return {
            id: doc.id,
            ...data,
            createdAtMs
          };
        }) as any[];

        // Filter active statuses in-memory and sort by createdAtMs descending
        // Ensure that pending orders are only shown if they are already paid or verified, which prevents dine-and-dash orders from cluttering the kitchen screen before checkout completion.
        const activeStatuses = ['pending', 'accepted', 'preparing', 'prepared'];
        const filteredAndSorted = rawOrders
          .filter(o => {
            const hasActiveStatus = activeStatuses.includes(o.status);
            if (!hasActiveStatus) return false;
            
            // If the order is pending, only show on TV if paid.
            // If status is accepted/preparing/prepared, it means the merchant has explicitly approved and started the order.
            if (o.status === 'pending') {
              return o.paymentStatus === 'paid';
            }
            return true;
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);

        setOrders(filteredAndSorted);
        setLoading(false);
      } catch (err: any) {
        console.error("Error parsing orders:", err);
        setLoading(false);
      }
    }, (error) => {
      console.warn("Restricted access or error listening to public orders display:", error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const readyOrders = orders.filter(o => o.status === 'prepared');
  const cookingOrders = orders.filter(o => ['pending', 'accepted', 'preparing'].includes(o.status));

  // Trigger audio announcements when orders transition to 'prepared'
  useEffect(() => {
    if (loading) return;
    const currentPrepared = orders.filter(o => o.status === 'prepared');
    
    if (isInitialMount.current) {
      // Record initial ready orders so we don't speak them all out immediately on page load
      currentPrepared.forEach(o => {
        if (o.id) announcedOrderIds.current.add(o.id);
      });
      isInitialMount.current = false;
      return;
    }

    // Capture newly prepared orders
    const newCount = currentPrepared.filter(o => o.id && !announcedOrderIds.current.has(o.id));
    if (newCount.length > 0) {
      newCount.forEach(o => {
        if (o.id) {
          announcedOrderIds.current.add(o.id);
          if (isAudioEnabled) {
            playChime();
            
            setTimeout(() => {
              const code = o.id?.slice(-4).toUpperCase() || '';
              // Convert to a spoken list of letters and digits for Swahili clarity
              const spokenChars = code.split('').map(char => {
                if (char === '0') return 'Sifuri';
                if (char === '1') return 'Moja';
                if (char === '2') return 'Mbili';
                if (char === '3') return 'Tatu';
                if (char === '4') return 'Nne';
                if (char === '5') return 'Tano';
                if (char === '6') return 'Sita';
                if (char === '7') return 'Saba';
                if (char === '8') return 'Nane';
                if (char === '9') return 'Tisa';
                return char;
              }).join(' ');

              const tableText = o.tableNumber ? ` wa meza namba ${o.tableNumber}` : '';
              const customerText = o.customerName ? ` ya ${o.customerName}` : '';
              const swahiliAlert = `Oda namba ${spokenChars}${customerText}${tableText} ipo tayari. Tafadhali karibu kaunta kuchukua chakula chako.`;
              speakSwahili(swahiliAlert);
            }, 800);
          }
        }
      });
    }
  }, [orders, loading, isAudioEnabled]);

  // Elegant Date formatting in Swahili/Universal format
  const formattedDate = time.toLocaleDateString('sw-TZ', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const formattedTime = time.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-black uppercase tracking-widest text-sm animate-pulse">Inapakia Mfumo Wa Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 p-6 font-sans flex flex-col justify-between overflow-hidden ${
      isNightMode ? 'bg-neutral-950 text-white' : 'bg-stone-150 text-stone-900'
    }`}>
      <div>
        {/* Header with ticking clock, date, and functional mode/fullscreen capsule panel */}
        <header className={`flex justify-between items-center mb-6 border-b pb-5 transition-colors duration-500 ${
          isNightMode ? 'border-white/10' : 'border-stone-250'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-950/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent)]" />
              <Utensils className="w-8 h-8 text-white relative z-10" />
            </div>
            <div>
              <h1 className={`text-4xl font-black italic uppercase tracking-tighter leading-none bg-gradient-to-r bg-clip-text text-transparent transition-all duration-500 ${
                isNightMode ? 'from-white via-white to-neutral-400' : 'from-stone-900 via-stone-800 to-stone-700'
              }`}>
                {vendorName || 'RESTAURANT KISINIA'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`${isNightMode ? 'text-orange-500' : 'text-orange-600'} font-extrabold uppercase tracking-[0.25em] text-[10px]`}>
                  TV ORDER STATUS PRESENTATION
                </span>
                <span className="w-1.5 h-1.5 bg-[#00E5A0] rounded-full animate-ping" />
                <span className="text-[#00E5A0] text-[9px] font-black uppercase tracking-widest">LIVE</span>
              </div>
            </div>
          </div>

          {/* Time, Date, and control panel buttons */}
          <div className="flex gap-4 items-center">
            {/* Elegant Calendar Element */}
            <div className={`px-5 py-3.5 rounded-2xl border flex items-center gap-3 transition-all duration-300 ${
              isNightMode 
                ? 'bg-neutral-900 border-white/5 shadow-inner' 
                : 'bg-white border-stone-200/80 shadow-md text-stone-850'
            }`}>
              <Calendar className="w-5 h-5 text-orange-500" />
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isNightMode ? 'text-neutral-500' : 'text-stone-400'}`}>LEO</span>
                <span className="text-xs font-black uppercase">{formattedDate}</span>
              </div>
            </div>

            {/* Live Ticking Clock */}
            <div className={`px-6 py-3.5 rounded-2xl border flex items-center gap-3 relative transition-all duration-300 ${
              isNightMode 
                ? 'bg-neutral-900 border-white/5 shadow-inner' 
                : 'bg-white border-stone-200/80 shadow-md text-stone-850'
            }`}>
              <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <Clock className="w-5 h-5 text-orange-500 animate-pulse" />
              <div className="flex flex-col items-start leading-none gap-0.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isNightMode ? 'text-neutral-500' : 'text-stone-400'}`}>SAWA SASA</span>
                <span className="text-xl font-mono font-black">{formattedTime}</span>
              </div>
            </div>

            {/* Action Buttons Capsule */}
            <div className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all duration-300 ${
              isNightMode 
                ? 'bg-neutral-900 border-white/5 shadow-inner' 
                : 'bg-white border-stone-200/80 shadow-md'
            }`}>
              {/* Audio Alerts Toggle */}
              <button
                onClick={() => {
                  const speakTest = !isAudioEnabled;
                  setIsAudioEnabled(speakTest);
                  if (speakTest) {
                    playChime();
                    setTimeout(() => {
                      speakSwahili("Sauti ya matangazo ime washwa kikamilifu!");
                    }, 800);
                  }
                }}
                title={isAudioEnabled ? "Zima Sauti" : "Washa Sauti ya Matangazo"}
                className={`px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                  isAudioEnabled 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
                    : 'bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500/20 animate-pulse'
                }`}
              >
                {isAudioEnabled ? (
                  <>
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <Volume2 className="w-4 h-4 text-emerald-500" />
                    <span className="hidden sm:inline text-emerald-500">SAUTI: IMEWASHWA</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-600 font-extrabold text-[10px]">WASHA KENGELI YA SAUTI</span>
                  </>
                )}
              </button>

              <div className={`h-6 w-[1.5px] ${isNightMode ? 'bg-white/10' : 'bg-stone-150'}`} />

              {/* Light/Night Mode Toggle */}
              <button
                onClick={() => setIsNightMode(!isNightMode)}
                title={isNightMode ? "Light Mode" : "Night Mode"}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
                  isNightMode 
                    ? 'text-neutral-400 hover:text-orange-400 hover:bg-neutral-800' 
                    : 'text-stone-600 hover:text-orange-600 hover:bg-stone-100'
                }`}
              >
                {isNightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className={`h-6 w-[1.5px] ${isNightMode ? 'bg-white/10' : 'bg-stone-150'}`} />

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
                  isNightMode 
                    ? 'text-neutral-400 hover:text-orange-400 hover:bg-neutral-805' 
                    : 'text-stone-600 hover:text-orange-600 hover:bg-stone-100'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Outer Split Columns Layout */}
        <div className="grid grid-cols-2 gap-8 h-[calc(100vh-210px)] min-h-[480px]">
          {/* Cooking Column Section */}
          <div className={`rounded-[2.5rem] border p-8 flex flex-col relative overflow-hidden transition-all duration-300 ${
            isNightMode ? 'bg-neutral-900/40 border-white/5' : 'bg-white border-stone-200 shadow-sm'
          }`}>
            {/* Faint Background Logo */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] select-none pointer-events-none">
              <ChefHat className="w-[28rem] h-[28rem] rotate-12" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-md">
                <ChefHat className="w-6 h-6 text-amber-500 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div className="flex flex-col leading-none gap-0.5">
                <h2 className="text-3xl font-black italic uppercase tracking-tight text-amber-500">INAPIKWA / COOKING</h2>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isNightMode ? 'text-neutral-500' : 'text-stone-400'}`}>
                  Oda zinazoandaliwa jikoni sasa
                </span>
              </div>
              <span className={`ml-auto border px-4 py-2 rounded-2xl text-lg font-mono font-black transition-all ${
                isNightMode ? 'bg-neutral-800 border-white/5 text-amber-500' : 'bg-amber-50 border-amber-200/50 text-amber-600'
              }`}>
                {cookingOrders.length}
              </span>
            </div>

            {/* List Screen Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {cookingOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, x: 120 }}
                      className={`p-5 rounded-[2rem] flex flex-col justify-between h-38 border transition-all shadow-md group ${
                        isNightMode 
                          ? 'bg-neutral-950/40 border-neutral-800/80 hover:border-amber-500/35' 
                          : 'bg-stone-50 border-stone-200/90 hover:border-amber-500/50 hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Oda Namba</span>
                          <span className={`text-3xl font-mono font-black italic group-hover:text-amber-500 transition-colors ${
                            isNightMode ? 'text-white' : 'text-stone-900'
                          }`}>
                            #{order.id?.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        {order.tableNumber ? (
                          <span className={`border px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                            isNightMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-amber-50 border-amber-200/65 text-amber-700'
                          }`}>
                            Meza {order.tableNumber}
                          </span>
                        ) : (
                          <span className={`border px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                            isNightMode ? 'bg-neutral-850 border-white/5 text-neutral-400' : 'bg-stone-200/85 border-stone-300 text-stone-600'
                          }`}>
                            Chukua
                          </span>
                        )}
                      </div>

                      <div className={`border-t pt-3 flex flex-col gap-1 ${
                        isNightMode ? 'border-neutral-850' : 'border-stone-200/70'
                      }`}>
                        <p className={`text-[11px] font-bold truncate ${isNightMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${
                              isNightMode ? 'text-neutral-550' : 'text-stone-400'
                            }`}>
                              Inasubiriwa Hivi Karibuni
                            </span>
                          </div>
                          {order.prepTime && (
                            <div className="flex items-center gap-1 text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10">
                              <Clock className="w-2.5 h-2.5" />
                              <span className="text-[8.5px] font-black font-mono italic">{order.prepTime} min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {cookingOrders.length === 0 && (
                <div className={`h-full min-h-[290px] flex flex-col items-center justify-center rounded-[2rem] border border-dashed p-10 ${
                  isNightMode 
                    ? 'opacity-40 bg-neutral-950/20 border-white/5' 
                    : 'bg-stone-50/50 border-stone-200/70'
                }`}>
                  <div className={`w-16 h-16 border rounded-3xl flex items-center justify-center mb-4 ${
                    isNightMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-stone-200'
                  }`}>
                    <ChefHat className={`w-8 h-8 ${isNightMode ? 'text-neutral-500' : 'text-stone-400'}`} />
                  </div>
                  <h3 className={`font-black text-sm uppercase tracking-widest ${isNightMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                    Hakuna Oda Zinazopikwa
                  </h3>
                  <p className={`text-[10px] font-bold max-w-xs text-center mt-1.5 ${isNightMode ? 'text-neutral-550' : 'text-stone-500'}`}>
                    Kwa sasa jiko lipo tayari kupokea oda mpya.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ready & Finished Dining Section Column */}
          <div className="bg-gradient-to-b from-orange-600 to-orange-700 rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden shadow-2xl shadow-orange-950/40 border border-orange-500/20">
            {/* Background Icon */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.06] select-none pointer-events-none">
              <Bell className="w-[28rem] h-[28rem] rotate-12" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-md">
                <CheckCircle2 className="w-6 h-6 text-white animate-bounce" />
              </div>
              <div className="flex flex-col leading-none gap-0.5 text-white">
                <h2 className="text-3xl font-black italic uppercase tracking-tight">ODA TAYARI / READY</h2>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80 decoration-white">Tafadhali fika kaunta kuchukua chakula</span>
              </div>
              <span className="ml-auto bg-white/20 border border-white/5 px-4 py-2 rounded-2xl text-lg font-mono font-black text-white">
                {readyOrders.length}
              </span>
            </div>

            {/* List Screen Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {readyOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, rotate: -2 }}
                      className="bg-white p-5 rounded-[2rem] flex flex-col justify-between h-38 shadow-xl relative overflow-hidden"
                    >
                      {/* Top ribbon layout decoration */}
                      <div className="absolute top-0 right-0 w-24 h-1 bg-gradient-to-r from-teal-400 to-emerald-500" />

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">ODA NUMBA</span>
                          <span className="text-4xl font-mono font-black text-black italic">
                            #{order.id?.slice(-4).toUpperCase()}
                          </span>
                        </div>
                        <div className="bg-orange-650 text-white px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse border border-orange-600">
                          {order.tableNumber ? `MEZA ${order.tableNumber}` : "CHUKUA"}
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 pt-3 mt-1 flex flex-col gap-1.5">
                        {order.customerName && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-450">MTEJA:</span>
                            <span className="text-neutral-900 font-black text-sm uppercase italic tracking-tighter truncate max-w-[130px]">
                              {order.customerName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-emerald-600 font-extrabold uppercase text-[8.5px] tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            Tayari kwa Kukabidhiwa
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {readyOrders.length === 0 && (
                <div className="h-full min-h-[290px] flex flex-col items-center justify-center opacity-60 bg-black/10 rounded-[2rem] border border-dashed border-white/20 p-10">
                  <div className="w-16 h-16 bg-white/10 border border-white/25 rounded-3xl flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-white">Subiri Kwanza</h3>
                  <p className="text-[10px] text-orange-200 font-bold max-w-xs text-center mt-1.5">Oda yako inapokuwa tayari itaonekana hapa ikiambatana na kengele.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Sliding Announcement Bar Footer */}
      <footer className="mt-6 select-none relative z-20">
        <div className={`relative h-14 overflow-hidden flex items-center px-6 rounded-2xl border transition-all duration-300 ${
          isNightMode 
            ? 'bg-neutral-900 border-white/5' 
            : 'bg-white border-stone-200 shadow-sm'
        }`}>
          {/* Static Title Box Badge */}
          <div className={`px-4 py-1.5 rounded-xl flex items-center gap-2 mr-6 shrink-0 shadow-xs border ${
            isNightMode 
              ? 'bg-orange-600/10 border-orange-600/30 text-orange-500' 
              : 'bg-orange-50 border-orange-200/40 text-orange-600'
          }`}>
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest">Matangazo / Info</span>
          </div>

          {/* AnimatePresence Fading Slider for Swahili notices */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={announcementIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className={`absolute text-xs font-semibold flex items-center gap-2 pl-2 ${
                  isNightMode ? 'text-neutral-300' : 'text-stone-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0 select-none" />
                <span className="truncate pr-4">{announcements[announcementIndex]}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Indicator Dots */}
          <div className="flex gap-1.5 items-center shrink-0 ml-4">
            {announcements.map((_, idx) => (
              <div 
                key={`dot-adv-${idx}`}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  idx === announcementIndex 
                    ? 'bg-orange-500 w-3' 
                    : isNightMode ? 'bg-neutral-800' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isNightMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isNightMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'};
        }
      `}} />
    </div>
  );
}
