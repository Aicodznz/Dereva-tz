import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, query, where, onSnapshot, getDocs, limit, orderBy, 
  updateDoc, doc, writeBatch, addDoc, serverTimestamp, setDoc, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, CheckCircle2, Settings, ChevronRight, ShoppingBag, Tag, Star,
  AlertCircle, Info, Car, Utensils, ShoppingCart, Pill, Package, Bus, Key,
  Hotel, Scissors, CreditCard, MessageSquare, Megaphone, Shield, Navigation,
  Volume2, VolumeX, Upload, Play, Sparkles, Plus, X, User, Users, Check, Flame, AlertTriangle,
  Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { playSyntheticNormal, playSyntheticImportant, playSyntheticCritical } from '../utils/soundAlert';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string; // e.g. 'order', 'promotion', 'system', 'review'
  role?: 'customer' | 'vendor' | 'rider' | 'admin' | 'all';
  category: string; // e.g. 'Transport', 'Food', 'Payments', etc.
  importance: 'critical' | 'important' | 'normal' | 'silent';
  isRead: boolean;
  createdAt: any;
  actionUrl?: string;
  soundUrl?: string;
}

interface SoundSettings {
  critical: string;
  important: string;
  normal: string;
}

const DEFAULT_SOUNDS: SoundSettings = {
  critical: 'https://assets.mixkit.co/active_storage/sfx/911/911-720.wav', // Emergency siren
  important: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-720.wav', // Chime/ping
  normal: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-720.wav', // Pop chime
};

const CATEGORIES = [
  { id: 'all', label: 'Zote', icon: Bell, color: 'text-neutral-500 bg-neutral-100' },
  { id: 'Transport', label: '🚖 Transport', icon: Car, color: 'text-blue-500 bg-blue-50' },
  { id: 'Food', label: '🍔 Food', icon: Utensils, color: 'text-red-500 bg-red-50' },
  { id: 'Shopping', label: '🛒 Shopping', icon: ShoppingCart, color: 'text-emerald-500 bg-emerald-50' },
  { id: 'Pharmacy', label: '💊 Pharmacy', icon: Pill, color: 'text-teal-500 bg-teal-50' },
  { id: 'Parcel', label: '📦 Parcel', icon: Package, color: 'text-amber-500 bg-amber-50' },
  { id: 'Bus Tickets', label: '🎫 Bus Tickets', icon: Bus, color: 'text-indigo-500 bg-indigo-50' },
  { id: 'Car Rental', label: '🚗 Car Rental', icon: Key, color: 'text-cyan-500 bg-cyan-50' },
  { id: 'Hotels', label: '🏨 Hotels', icon: Hotel, color: 'text-purple-500 bg-purple-50' },
  { id: 'Salon', label: '💇 Salon', icon: Scissors, color: 'text-pink-500 bg-pink-50' },
  { id: 'Payments', label: '💰 Payments', icon: CreditCard, color: 'text-green-500 bg-green-50' },
  { id: 'Messages', label: '💬 Messages', icon: MessageSquare, color: 'text-sky-500 bg-sky-50' },
  { id: 'Promotions', label: '📢 Promotions', icon: Megaphone, color: 'text-orange-500 bg-orange-50' },
  { id: 'Security', label: '🔐 Security', icon: Shield, color: 'text-rose-500 bg-rose-50' },
  { id: 'Navigation', label: '🗺️ Navigation', icon: Navigation, color: 'text-violet-500 bg-violet-50' },
  { id: 'System', label: '⚙️ System', icon: Settings, color: 'text-slate-500 bg-slate-50' },
];

export default function Notifications() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUNDS);
  const [activeTab, setActiveTab] = useState<'all_notifs' | 'simulator' | 'sound_settings'>('all_notifs');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  // Immersive full-screen critical alert state
  const [activeCriticalAlert, setActiveCriticalAlert] = useState<{
    id: string;
    title: string;
    body: string;
    category: string;
  } | null>(null);

  const componentLoadTime = useRef(Date.now());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load sound settings from Firestore
  useEffect(() => {
    const fetchSoundSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'notification_sounds');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSoundSettings({ ...DEFAULT_SOUNDS, ...docSnap.data() } as SoundSettings);
        } else {
          // Initialize defaults
          await setDoc(docRef, DEFAULT_SOUNDS);
        }
      } catch (err) {
        console.error("Failed to load sound settings:", err);
      }
    };
    fetchSoundSettings();
  }, []);

  // Fetch / Listen to Notifications
  useEffect(() => {
    if (!user) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef, 
      where('userId', '==', user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()).toISOString() : (data.createdAt || new Date().toISOString())
        } as Notification;
      });
      
      // Client-side sorting (newest first)
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Play sound for brand new notifications added after component mount
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const docData = change.doc.data();
          const docCreatedTime = docData.createdAt?.toMillis ? docData.createdAt.toMillis() : (docData.createdAt ? new Date(docData.createdAt).getTime() : Date.now());
          
          if (docCreatedTime > componentLoadTime.current - 2000) {
            const importance = docData.importance || 'normal';
            if (importance !== 'silent') {
              triggerSound(importance);
            }
            if (importance === 'critical') {
              setActiveCriticalAlert({
                id: change.doc.id,
                title: docData.title,
                body: docData.body,
                category: docData.category || 'System',
              });
              // Simulate physical vibration if supported
              if (navigator.vibrate) {
                navigator.vibrate([500, 300, 500, 300, 500]);
              }
            } else {
              toast.info(`🔔 ${docData.title}: ${docData.body}`);
            }
          }
        }
      });

      setNotifications(notifs);
      setLoading(false);
    }, (error: any) => {
      console.error("Error in notifications snapshot:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const triggerSound = (importance: 'critical' | 'important' | 'normal', isManualTest: boolean = false) => {
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const url = soundSettings[importance] || DEFAULT_SOUNDS[importance];
      if (!url) {
        if (isManualTest) toast.error("Hakuna link ya sauti iliyowekwa!");
        return;
      }
      const audio = new Audio(url);
      activeAudioRef.current = audio;
      
      // loop critical alerts until acknowledged
      if (importance === 'critical') {
        audio.loop = true;
      }
      
      audio.play().then(() => {
        setIsAudioEnabled(true);
        if (isManualTest) {
          toast.success(`Mlio wa ${importance} unacheza kikamilifu kutoka kwenye link!`);
        }
      }).catch(err => {
        console.warn("Autoplay blocked. User needs to interact with the page first.", err);
        if (err.name === 'NotAllowedError') {
          if (isManualTest) {
            toast.info("Ili kusikia sauti, tafadhali fungua mfumo huu kwenye tab mpya (New Tab) ya browser yako (Shared App au Dev URL) kisha ubofye skrini kuruhusu.");
          }
        } else {
          // Play synthetic sound!
          if (importance === 'critical') {
            playSyntheticCritical();
          } else if (importance === 'important') {
            playSyntheticImportant();
          } else {
            playSyntheticNormal();
          }
          if (isManualTest) {
            toast.success(`Mlio wa ${importance} umefanikiwa kuchezwa kutoka kwenye mfumo salama wa ndani!`);
          }
        }
      });
    } catch (e) {
      console.error("Audio trigger failed:", e);
      try {
        if (importance === 'critical') {
          playSyntheticCritical();
        } else if (importance === 'important') {
          playSyntheticImportant();
        } else {
          playSyntheticNormal();
        }
        if (isManualTest) {
          toast.success(`Mlio wa ${importance} umefanikiwa kuchezwa kutoka kwenye mfumo salama wa ndani!`);
        }
      } catch (innerErr) {
        if (isManualTest) {
          toast.error("Hitilafu imetokea wakati wa kucheza sauti.");
        }
      }
    }
  };

  const stopActiveAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadIds.forEach(id => {
        batch.update(doc(db, 'notifications', id), { isRead: true });
      });
      await batch.commit();
      toast.success("Taarifa zote zimetiwa alama ya kusomwa.");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const getCategoryIcon = (catName: string) => {
    const found = CATEGORIES.find(c => c.id === catName);
    if (found) {
      const IconComponent = found.icon;
      return <IconComponent className="w-5 h-5" />;
    }
    return <Bell className="w-5 h-5" />;
  };

  const getCategoryColor = (catName: string) => {
    const found = CATEGORIES.find(c => c.id === catName);
    return found ? found.color : 'text-neutral-500 bg-neutral-100';
  };

  const filteredNotifications = notifications.filter(n => {
    if (selectedCategory === 'all') return true;
    return n.category === selectedCategory;
  });

  // Simulator predefined templates
  const roleTemplates = {
    customer: [
      { title: "🆕 Oda imepokelewa", sw: "Oda yako imepokelewa kikamilifu!", cat: "Food", imp: "important" as const },
      { title: "✅ Oda imekubaliwa", sw: "Muuzaji amekubali kuandaa oda yako.", cat: "Food", imp: "important" as const },
      { title: "❌ Oda imekataliwa", sw: "Samahani, duka limekataa oda yako kwa sasa.", cat: "Food", imp: "critical" as const },
      { title: "👨‍🍳 Oda inaandaliwa", sw: "Chakula chako kinaandaliwa jikoni kwa usafi.", cat: "Food", imp: "normal" as const },
      { title: "📦 Rider amechukua oda", sw: "Msafirishaji ameondoka na oda yako kuileta kwako.", cat: "Parcel", imp: "important" as const },
      { title: "🚗 Dereva amekubali safari", sw: "Dereva amekubali safari yako ya teksi.", cat: "Transport", imp: "important" as const },
      { title: "📍 Dereva anakaribia", sw: "Dereva wako amefika karibu na eneo lako la kuanzia.", cat: "Transport", imp: "critical" as const },
      { title: "🏁 Safari imeanza", sw: "Safari yako imeanza salama. Furahia safari na Antway!", cat: "Transport", imp: "important" as const },
      { title: "🎉 Safari imekamilika", sw: "Asante kwa kusafiri nasi, safari yako imekamilika.", cat: "Transport", imp: "normal" as const },
      { title: "💰 Malipo yamefanikiwa", sw: "Malipo ya TZS 15,000 yamefanyika kwa ufanisi.", cat: "Payments", imp: "important" as const },
      { title: "❌ Malipo yameshindwa", sw: "Muamala umeshindwa. Tafadhali jaribu tena au badili njia ya malipo.", cat: "Payments", imp: "critical" as const },
      { title: "🎫 Booking Confirmed", sw: "Tiketi yako ya basi imethibitishwa. Kiti namba 14.", cat: "Bus Tickets", imp: "important" as const },
      { title: "🏨 Reservation Confirmed", sw: "Chumba chako katika Hoteli kimehifadhiwa kikamilifu.", cat: "Hotels", imp: "important" as const },
      { title: "💇 Appointment Confirmed", sw: "Muda wako wa saluni umethibitishwa na mtaalamu wako.", cat: "Salon", imp: "important" as const },
      { title: "🗺️ Driver changed route", sw: "Dereva amebadilisha njia! Antway inakuelekeza upya...", cat: "Navigation", imp: "critical" as const },
      { title: "🎁 Coupon Available", sw: "Una kuponi mpya ya punguzo la 20% kwenye chakula!", cat: "Promotions", imp: "normal" as const },
      { title: "🔐 OTP verification", sw: "Nambari yako ya siri ya OTP ya kuingia ni: 482910.", cat: "Security", imp: "important" as const }
    ],
    vendor: [
      { title: "🆕 New Order Received", sw: "Una oda mpya ya chakula ya TZS 35,000!", cat: "Food", imp: "critical" as const },
      { title: "❌ Order Cancelled", sw: "Mteja amesitisha oda namba #2910.", cat: "Food", imp: "critical" as const },
      { title: "💰 Withdrawal Approved", sw: "Ombi lako la kutoa TZS 150,500 limekubaliwa na kutumwa.", cat: "Payments", imp: "important" as const },
      { title: "📦 Low Stock Alert", sw: "Bidhaa yako 'Organic Tomatoes' imebaki 3 tu stoo.", cat: "Shopping", imp: "normal" as const },
      { title: "🏪 Store Approved", sw: "Duka lako limethibitishwa rasmi na sasa lipo live!", cat: "System", imp: "important" as const }
    ],
    rider: [
      { title: "🚖 New Ride Request", sw: "Ombi jipya la safari lipo karibu nawe! Kubali sasa.", cat: "Transport", imp: "critical" as const },
      { title: "📦 New Delivery Assigned", sw: "Una agizo jipya la kufikisha vifurushi vya dharura.", cat: "Parcel", imp: "critical" as const },
      { title: "🚨 SOS Emergency Alert", sw: "Mteja wako amebonyeza kitufe cha SOS! Msaada unakuja.", cat: "Security", imp: "critical" as const },
      { title: "💰 Wallet Credited", sw: "Akaunti yako imeongezewa TZS 12,000 kama bonasi ya leo.", cat: "Payments", imp: "important" as const }
    ],
    admin: [
      { title: "👤 New Vendor Verification", sw: "Duka jipya 'Papo Hapo Store' linasubiri idhini yako.", cat: "System", imp: "important" as const },
      { title: "⚠️ Server Error Alert", sw: "Hitilafu imetokea kwenye seva ya malipo ya m-pesa.", cat: "System", imp: "critical" as const },
      { title: "📈 Daily Sales Target Reached", sw: "Hongera! Malengo ya mauzo ya siku yamefikiwa kwa 110%.", cat: "Payments", imp: "normal" as const }
    ]
  };

  const simulateNotification = async (notif: { title: string; sw: string; cat: string; imp: 'critical' | 'important' | 'normal' | 'silent' }) => {
    if (!user) {
      toast.error("Tafadhali ingia kwenye akaunti kwanza.");
      return;
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: notif.title,
        body: notif.sw,
        category: notif.cat,
        importance: notif.imp,
        isRead: false,
        createdAt: serverTimestamp(),
        type: 'system'
      });
      toast.success(`Imeigizwa: ${notif.title}`);
    } catch (err) {
      console.error(err);
      toast.error("Imefeli kutuma taarifa.");
    }
  };

  const handleCustomSoundUpload = async (importance: keyof SoundSettings, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Url = e.target?.result as string;
      if (!base64Url) return;

      try {
        const updated = { ...soundSettings, [importance]: base64Url };
        setSoundSettings(updated);
        await setDoc(doc(db, 'settings', 'notification_sounds'), updated);
        toast.success(`Sauti ya ${importance} imepakiwa na kuhifadhiwa kikamilifu!`);
      } catch (err) {
        console.error(err);
        toast.error("Imefeli kuhifadhi sauti kwenye database.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomSoundLinkSave = async (importance: keyof SoundSettings, url: string) => {
    try {
      const updated = { ...soundSettings, [importance]: url };
      setSoundSettings(updated);
      await setDoc(doc(db, 'settings', 'notification_sounds'), updated);
      toast.success(`Sauti ya ${importance} imesasishwa kwa link!`);
    } catch (err) {
      console.error(err);
      toast.error("Imefeli kusave link.");
    }
  };

  const handleCustomSoundReset = async () => {
    try {
      setSoundSettings(DEFAULT_SOUNDS);
      await setDoc(doc(db, 'settings', 'notification_sounds'), DEFAULT_SOUNDS);
      toast.success("Mlio wa notification umerejeshwa kwenye sauti safi za awali!");
    } catch (err) {
      console.error(err);
      toast.error("Imeshindwa kurejesha sauti za awali.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 pt-6 px-4 space-y-8 text-neutral-900 dark:text-neutral-100 relative">
      
      {/* Immersive Siren / Flashing Critical Alert Modal */}
      <AnimatePresence>
        {activeCriticalAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-red-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center overflow-y-auto"
          >
            {/* Flashing Ambient Background Lights */}
            <div className="absolute inset-0 bg-gradient-to-t from-red-650/30 to-transparent animate-pulse pointer-events-none" />
            <div className="absolute top-10 w-72 h-72 bg-red-600/20 blur-[120px] rounded-full animate-ping pointer-events-none" />

            <div className="relative max-w-lg w-full bg-neutral-900/90 border-2 border-red-500/50 rounded-[3rem] p-10 shadow-[0_0_80px_rgba(239,68,68,0.4)] space-y-8">
              
              {/* Rotating/Beating Red Icon */}
              <div className="relative mx-auto w-24 h-24 bg-red-500/10 border-4 border-red-500 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <Flame className="w-12 h-12 text-red-500 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
              </div>

              <div className="space-y-3">
                <span className="bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.3rem] px-4 py-1.5 rounded-full border border-red-500/30">
                  ⚠️ Critical Notification
                </span>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none mt-2">
                  {activeCriticalAlert.title}
                </h2>
                <span className="inline-block text-xs font-bold text-red-400/80 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-lg">
                  Katika: {activeCriticalAlert.category}
                </span>
              </div>

              <p className="text-sm font-bold text-neutral-300 leading-relaxed bg-neutral-950/50 p-6 rounded-2xl border border-neutral-800">
                "{activeCriticalAlert.body}"
              </p>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={async () => {
                    stopActiveAudio();
                    await markAsRead(activeCriticalAlert.id);
                    setActiveCriticalAlert(null);
                    toast.success("Taarifa ya dharura imepokelewa na kuzimwa.");
                  }}
                  className="w-full h-16 bg-red-650 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-red-900/40 transition-all active:scale-95"
                >
                  ✅ THIBITISHA MAPOKEO (ACKNOWLEDGE)
                </Button>
                <button 
                  onClick={() => {
                    stopActiveAudio();
                    setActiveCriticalAlert(null);
                  }}
                  className="text-neutral-500 hover:text-white text-[10px] font-bold uppercase tracking-widest py-2 transition-all"
                >
                  Soma Baadaye (Keep as Unread)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 bg-gradient-to-tr from-orange-500 to-amber-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">Notification Center</h1>
            <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Antway Alert Hub & Sounds Engine</p>
          </div>
        </div>

        {/* Audio Enable Hint */}
        {!isAudioEnabled && (
          <button 
            onClick={() => {
              const audio = new Audio(DEFAULT_SOUNDS.normal);
              audio.play();
              setIsAudioEnabled(true);
              toast.success("Sauti za taarifa zimeruhusiwa kikamilifu!");
            }}
            className="self-start sm:self-auto bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all animate-pulse"
          >
            <Volume2 className="w-4 h-4" />
            Bofya Kuwasha Sauti
          </button>
        )}
      </div>

      {/* Primary Tabs */}
      <div className="flex flex-wrap gap-2.5 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] border border-neutral-200/55 dark:border-neutral-800/80">
        <button
          onClick={() => setActiveTab('all_notifs')}
          className={`flex-1 py-3 px-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'all_notifs' 
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          🔔 Inbox Zako
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 py-3 px-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'simulator' 
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          🔬 Simulators (Role Guide)
        </button>
        <button
          onClick={() => setActiveTab('sound_settings')}
          className={`flex-1 py-3 px-4 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'sound_settings' 
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          🎛️ Sound Settings
        </button>
      </div>

      {/* Tab content 1: All Notifications Inbox */}
      {activeTab === 'all_notifs' && (
        <div className="space-y-6">
          
          {/* Category Filter Horizontal List */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-3 scrollbar-none">
            {CATEGORIES.map(cat => {
              const IconComponent = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold tracking-tight shrink-0 transition-all border ${
                    isSelected 
                      ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/10' 
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-orange-500/40'
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
              Imepatikana ({filteredNotifications.length}) katika {CATEGORIES.find(c => c.id === selectedCategory)?.label || 'Zote'}
            </span>
            {filteredNotifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="rounded-xl text-neutral-500 hover:text-orange-600 text-xs font-bold gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Somwa Zote
              </Button>
            )}
          </div>

          {/* Inbox List */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notif, idx) => (
                <motion.div
                  key={notif.id || `notif-item-${idx}`}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onClick={() => markAsRead(notif.id)}
                  className={`relative p-5 rounded-[2rem] border transition-all cursor-pointer group ${
                    notif.isRead 
                      ? 'bg-white dark:bg-neutral-950 border-neutral-100 dark:border-neutral-900 hover:border-neutral-200' 
                      : 'bg-orange-50/40 dark:bg-orange-950/10 border-orange-100 dark:border-orange-950/20 shadow-sm hover:border-orange-200'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Unread Indicator Bar */}
                    {!notif.isRead && (
                      <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-orange-600 rounded-r-full" />
                    )}

                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${getCategoryColor(notif.category || 'System')}`}>
                      {getCategoryIcon(notif.category || 'System')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className={`text-sm font-bold tracking-tight ${notif.isRead ? 'text-neutral-900 dark:text-white' : 'text-orange-900 dark:text-orange-500'}`}>
                            {notif.title}
                          </h3>
                          <span className="inline-block text-[9px] font-black uppercase tracking-widest text-neutral-400 mt-0.5">
                            {notif.category || 'System'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[10px] text-neutral-400 font-bold">
                            {notif.createdAt ? format(new Date(notif.createdAt), 'HH:mm') : 'Hivi Sasa'}
                          </span>
                          {notif.importance && notif.importance !== 'normal' && (
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              notif.importance === 'critical' 
                                ? 'bg-red-500/10 text-red-500' 
                                : notif.importance === 'important'
                                ? 'bg-orange-500/10 text-orange-500'
                                : 'bg-neutral-500/10 text-neutral-400'
                            }`}>
                              {notif.importance}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 line-clamp-3 leading-relaxed font-medium">
                        {notif.body}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredNotifications.length === 0 && (
              <div className="py-24 text-center space-y-4 bg-neutral-50 dark:bg-neutral-900/40 rounded-[2.5rem] border border-dashed border-neutral-200 dark:border-neutral-800">
                <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-300 dark:text-neutral-600">
                  <Bell className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="font-bold text-neutral-900 dark:text-white">Hakuna taarifa zozote hapa</h3>
                  <p className="text-xs text-neutral-400 leading-normal">Bado haujapokea taarifa yoyote katika kitengo cha {CATEGORIES.find(c => c.id === selectedCategory)?.label || 'Zote'}.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content 2: Simulator Panel & Role Guide */}
      {activeTab === 'simulator' && (
        <div className="space-y-8">
          <div className="bg-orange-600/5 border border-orange-500/10 rounded-[2.5rem] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-black tracking-tight text-neutral-950 dark:text-white uppercase">Notification Simulator</h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-bold">
              Bofya aina yoyote ya taarifa hapa chini ili kuiga (simulate) namna inavyoingia katika mfumo wetu wa sauti na dharura. Taarifa za kiwango cha <strong className="text-red-500">Critical</strong> zitafungua skrini nzima ya king'ora inayopiga kelele mpaka utakapothibitisha.
            </p>
          </div>

          {(Object.keys(roleTemplates) as Array<keyof typeof roleTemplates>).map(role => (
            <div key={role} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <User className="w-5 h-5 text-orange-600" />
                <h4 className="text-sm font-black uppercase tracking-[0.2rem] text-neutral-800 dark:text-white">
                  {role === 'customer' ? '1. Customer (Mteja) Alerts' : role === 'vendor' ? '2. Vendor (Duka) Alerts' : role === 'rider' ? '3. Rider (Delivery Boy) Alerts' : '4. Admin Alerts'}
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roleTemplates[role].map((tmpl, idx) => (
                  <div 
                    key={`${role}-tmpl-${idx}`}
                    className="bg-white dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-900 p-5 rounded-[2rem] flex flex-col justify-between gap-4 hover:border-orange-500/20 transition-all shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-900 dark:text-white leading-snug">
                          {tmpl.title}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            tmpl.imp === 'critical' ? 'bg-red-500/15 text-red-500' : tmpl.imp === 'important' ? 'bg-orange-500/15 text-orange-500' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            {tmpl.imp}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-bold uppercase mt-1">
                        Category: {tmpl.cat}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 font-medium italic">
                        "{tmpl.sw}"
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => simulateNotification(tmpl)}
                      className="w-full bg-neutral-100 hover:bg-orange-600 hover:text-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all py-2.5 flex items-center justify-center gap-1.5 border-none"
                    >
                      <Play className="w-3.5 h-3.5" /> Igiza & Cheza Sauti
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab content 3: Sound Settings Dashboard */}
      {activeTab === 'sound_settings' && (
        <div className="space-y-8">
          <div className="bg-neutral-900 text-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <Volume2 className="w-8 h-8 text-orange-500" />
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-widest">Notification Sounds Config</CardTitle>
                  <CardDescription className="text-neutral-500 font-bold uppercase tracking-wider text-[9px]">Sanidi mlio wa taarifa kulingana na umuhimu wake</CardDescription>
                </div>
              </div>
              <Button 
                onClick={handleCustomSoundReset} 
                className="bg-neutral-800 border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 rounded-2xl h-10 px-4 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg self-start sm:self-auto"
              >
                <Undo2 className="w-3.5 h-3.5" /> Rudisha Sauti za Awali
              </Button>
            </div>

            <div className="space-y-8 mt-6">
              
              {/* Critical Sounds Input */}
              <div className="space-y-4 border-b border-neutral-800 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-[0.2rem] text-red-500">Critical Alarms (Loop)</span>
                  </div>
                  <button 
                    onClick={() => triggerSound('critical', true)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Play className="w-4 h-4" /> Jaribu Mlio
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">Inatumika kwa: Taxi Request, New Delivery, SOS Alerts, New Food Order nk.</p>
                <div className="flex gap-3">
                  <Input 
                    type="text" 
                    placeholder="Weka sound URL link..." 
                    className="flex-1 bg-neutral-800 border-none h-14 rounded-xl text-xs text-white placeholder:text-neutral-600 font-medium"
                    value={soundSettings.critical}
                    onChange={(e) => setSoundSettings({ ...soundSettings, critical: e.target.value })}
                  />
                  <Button 
                    onClick={() => handleCustomSoundLinkSave('critical', soundSettings.critical)}
                    className="h-14 bg-orange-600 hover:bg-orange-700 text-white px-5 rounded-xl font-bold text-xs"
                  >
                    Hifadhi Link
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded-xl text-xs font-bold text-neutral-300 transition-all">
                    <Upload className="w-4 h-4 text-orange-500" /> Upload Audio File
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleCustomSoundUpload('critical', e.target.files[0])}
                    />
                  </label>
                  <span className="text-[10px] text-neutral-500 font-bold italic">Max 100KB (WAV/MP3)</span>
                </div>
              </div>

              {/* Important Sounds Input */}
              <div className="space-y-4 border-b border-neutral-800 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-orange-500 rounded-full" />
                    <span className="text-xs font-black uppercase tracking-[0.2rem] text-orange-500">Important Notifications</span>
                  </div>
                  <button 
                    onClick={() => triggerSound('important', true)}
                    className="p-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Play className="w-4 h-4" /> Jaribu Mlio
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">Inatumika kwa: Order Accepted, Rider Assigned, Driver Arrived, Payments, Booking Confirmed nk.</p>
                <div className="flex gap-3">
                  <Input 
                    type="text" 
                    placeholder="Weka sound URL link..." 
                    className="flex-1 bg-neutral-800 border-none h-14 rounded-xl text-xs text-white placeholder:text-neutral-600 font-medium"
                    value={soundSettings.important}
                    onChange={(e) => setSoundSettings({ ...soundSettings, important: e.target.value })}
                  />
                  <Button 
                    onClick={() => handleCustomSoundLinkSave('important', soundSettings.important)}
                    className="h-14 bg-orange-600 hover:bg-orange-700 text-white px-5 rounded-xl font-bold text-xs"
                  >
                    Hifadhi Link
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded-xl text-xs font-bold text-neutral-300 transition-all">
                    <Upload className="w-4 h-4 text-orange-500" /> Upload Audio File
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleCustomSoundUpload('important', e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              {/* Normal Sounds Input */}
              <div className="space-y-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-neutral-500 rounded-full" />
                    <span className="text-xs font-black uppercase tracking-[0.2rem] text-neutral-400">Normal Alerts</span>
                  </div>
                  <button 
                    onClick={() => triggerSound('normal', true)}
                    className="p-2 bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Play className="w-4 h-4" /> Jaribu Mlio
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">Inatumika kwa: Kuponi, Ofa, Maoni ya Bidhaa, Pointi za uaminifu nk.</p>
                <div className="flex gap-3">
                  <Input 
                    type="text" 
                    placeholder="Weka sound URL link..." 
                    className="flex-1 bg-neutral-800 border-none h-14 rounded-xl text-xs text-white placeholder:text-neutral-600 font-medium"
                    value={soundSettings.normal}
                    onChange={(e) => setSoundSettings({ ...soundSettings, normal: e.target.value })}
                  />
                  <Button 
                    onClick={() => handleCustomSoundLinkSave('normal', soundSettings.normal)}
                    className="h-14 bg-orange-600 hover:bg-orange-700 text-white px-5 rounded-xl font-bold text-xs"
                  >
                    Hifadhi Link
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded-xl text-xs font-bold text-neutral-300 transition-all">
                    <Upload className="w-4 h-4 text-orange-500" /> Upload Audio File
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleCustomSoundUpload('normal', e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
