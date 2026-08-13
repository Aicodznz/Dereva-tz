import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, query, where, onSnapshot, 
  updateDoc, doc, writeBatch, addDoc, serverTimestamp, setDoc, getDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, CheckCircle2, Volume2, Upload, Play, Sparkles, User,
  Flame, Undo2, CheckCheck, Sliders, Inbox, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { playSyntheticNormal, playSyntheticImportant, playSyntheticCritical } from '../utils/soundAlert';

interface Notification {
  id: string;
  title: string;
  body: string;
  type?: string;
  role?: 'customer' | 'vendor' | 'rider' | 'admin' | 'all';
  category?: string;
  importance?: 'critical' | 'important' | 'normal' | 'silent';
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

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUNDS);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sound_settings' | 'simulator'>('inbox');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'critical' | 'important'>('all');
  const [loading, setLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  // Immersive full-screen critical alert state
  const [activeCriticalAlert, setActiveCriticalAlert] = useState<{
    id: string;
    title: string;
    body: string;
    category?: string;
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
    if (!user) {
      setLoading(false);
      return;
    }

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
                category: docData.category || 'Dharura',
              });
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
      
      if (importance === 'critical') {
        audio.loop = true;
      }
      
      audio.play().then(() => {
        setIsAudioEnabled(true);
        if (isManualTest) {
          toast.success(`Mlio wa ${importance} unacheza kikamilifu!`);
        }
      }).catch(err => {
        console.warn("Autoplay blocked. Playing fallback sound.", err);
        if (importance === 'critical') {
          playSyntheticCritical();
        } else if (importance === 'important') {
          playSyntheticImportant();
        } else {
          playSyntheticNormal();
        }
        if (isManualTest) {
          toast.success(`Mlio wa ${importance} umefanikiwa kuchezwa!`);
        }
      });
    } catch (e) {
      console.error("Audio trigger failed:", e);
      if (importance === 'critical') {
        playSyntheticCritical();
      } else if (importance === 'important') {
        playSyntheticImportant();
      } else {
        playSyntheticNormal();
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
    if (unreadIds.length === 0) {
      toast.info("Taarifa zote tayari zimesomwa.");
      return;
    }

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

  const handleCustomSoundLinkSave = async (importance: keyof SoundSettings, url: string) => {
    try {
      const updated = { ...soundSettings, [importance]: url };
      setSoundSettings(updated);
      await setDoc(doc(db, 'settings', 'notification_sounds'), updated);
      toast.success(`Link ya sauti ya '${importance}' imehifadhiwa!`);
    } catch (err) {
      toast.error("Imeshindwa kuhifadhi link.");
    }
  };

  const handleCustomSoundReset = async () => {
    try {
      setSoundSettings(DEFAULT_SOUNDS);
      await setDoc(doc(db, 'settings', 'notification_sounds'), DEFAULT_SOUNDS);
      toast.success("Sauti zimerejeshwa katika hali ya kawaida!");
    } catch (err) {
      toast.error("Hitilafu imetokea.");
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
        toast.success(`Faili la sauti ya '${importance}' limehifadhiwa kikamilifu!`);
      } catch (err) {
        toast.error("Faili ni kubwa mno kwa stoo.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Filtered Notifications based on status
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const criticalCount = notifications.filter(n => n.importance === 'critical').length;
  const importantCount = notifications.filter(n => n.importance === 'important').length;

  const filteredNotifications = notifications.filter(n => {
    if (statusFilter === 'unread') return !n.isRead;
    if (statusFilter === 'critical') return n.importance === 'critical';
    if (statusFilter === 'important') return n.importance === 'important';
    return true;
  });

  // Simulator predefined templates
  const roleTemplates = {
    customer: [
      { title: "🆕 Oda Imepokelewa", sw: "Oda yako imepokelewa kikamilifu na inafanyiwa kazi.", imp: "important" as const },
      { title: "✅ Oda Imekubaliwa", sw: "Muuzaji amekubali kuandaa oda yako sasa hivi.", imp: "important" as const },
      { title: "📦 Msafirishaji Amechukua Oda", sw: "Rider ameondoka na oda yako kuileta kwako.", imp: "important" as const },
      { title: "🚗 Dereva Amefika Eneo Lako", sw: "Dereva wako amefika karibu nawe. Tafadhali jitayarishe.", imp: "critical" as const },
      { title: "💰 Malipo Yamekamilika", sw: "Malipo ya TZS 25,000 yamefanyika kwa ufanisi.", imp: "important" as const },
      { title: "🎁 Punguzo la Bei (Ofa)", sw: "Una punguzo la 20% kwenye oda yako inayofuata leo!", imp: "normal" as const },
    ],
    driver_vendor: [
      { title: "🚖 Ombi Jipya la Safari", sw: "Mteja mpya yupo karibu nawe. Kubali safari sasa!", imp: "critical" as const },
      { title: "🛒 Oda Mpya Dukani", sw: "Una oda mpya ya chakula/bidhaa ya TZS 45,000.", imp: "critical" as const },
      { title: "🚨 SOS Dharura ya Usalama", sw: "Taarifa ya usalama imepokelewa. Msaada unatolewa mara moja.", imp: "critical" as const },
      { title: "💵 Pesa Imeingia Kwenye Mkoba", sw: "Mapato ya TZS 60,000 yameingizwa kwenye pochi yako ya Papo Hapo.", imp: "important" as const },
    ]
  };

  const simulateNotification = async (notif: { title: string; sw: string; imp: 'critical' | 'important' | 'normal' }) => {
    if (!user) {
      toast.error("Tafadhali ingia kwenye akaunti kwanza.");
      return;
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: notif.title,
        body: notif.sw,
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20 px-2 sm:px-4">
      
      {/* FULL-SCREEN CRITICAL POPUP DIALOG */}
      <AnimatePresence>
        {activeCriticalAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-neutral-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 text-center"
          >
            <div className="relative max-w-md w-full bg-neutral-900 border-2 border-red-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(239,68,68,0.4)] space-y-6">
              
              <div className="relative mx-auto w-20 h-20 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/30">
                <Flame className="w-10 h-10 text-red-500 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
              </div>

              <div className="space-y-2">
                <span className="inline-block bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-red-500/30">
                  ⚠️ Taarifa ya Dharura (Critical Alert)
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">
                  {activeCriticalAlert.title}
                </h2>
              </div>

              <p className="text-sm font-medium text-neutral-300 bg-neutral-950/70 p-4 rounded-2xl border border-neutral-800 leading-relaxed">
                "{activeCriticalAlert.body}"
              </p>

              <div className="flex flex-col gap-2.5">
                <Button 
                  onClick={async () => {
                    stopActiveAudio();
                    await markAsRead(activeCriticalAlert.id);
                    setActiveCriticalAlert(null);
                    toast.success("Taarifa imethibitishwa.");
                  }}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-900/40 transition-all active:scale-95"
                >
                  <CheckCheck className="w-4 h-4 mr-1.5" /> Thibitisha Mapokeo
                </Button>
                <button 
                  onClick={() => {
                    stopActiveAudio();
                    setActiveCriticalAlert(null);
                  }}
                  className="text-neutral-400 hover:text-white text-xs font-bold py-2 transition-all"
                >
                  Funga (Soma Baadaye)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODERN SLICK HEADER */}
      <div className="bg-white dark:bg-neutral-900/90 rounded-3xl p-5 sm:p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 dark:text-white uppercase italic">
                Arifa & Taarifa
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-orange-600 text-white rounded-full">
                  {unreadCount} Mpya
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Papo Hapo Express Alert & Notification Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isAudioEnabled ? (
            <button 
              onClick={() => {
                const audio = new Audio(DEFAULT_SOUNDS.normal);
                audio.play().catch(() => {});
                setIsAudioEnabled(true);
                toast.success("Sauti za arifa zimewashwa!");
              }}
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-xs"
            >
              <Volume2 className="w-4 h-4 animate-pulse" /> Washa Sauti
            </button>
          ) : (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Sauti Ipo Wazi
            </span>
          )}

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-9 px-3 rounded-xl border-neutral-200 dark:border-neutral-700 hover:border-orange-500 hover:text-orange-600 font-bold text-xs gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Soma Zote
            </Button>
          )}
        </div>
      </div>

      {/* TOP LEVEL NAVIGATION TABS */}
      <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'inbox'
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Inbox ({notifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sound_settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'sound_settings'
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Sauti (Sound Settings)</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'simulator'
              ? 'bg-white dark:bg-neutral-800 text-orange-600 dark:text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Simulate Test</span>
        </button>
      </div>

      {/* TAB 1: INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          
          {/* CLEAN STATUS FILTERS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 border ${
                statusFilter === 'all'
                  ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              Zote ({notifications.length})
            </button>

            <button
              onClick={() => setStatusFilter('unread')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 border ${
                statusFilter === 'unread'
                  ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              Hazijasomwa ({unreadCount})
            </button>

            <button
              onClick={() => setStatusFilter('critical')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 border ${
                statusFilter === 'critical'
                  ? 'bg-red-600 border-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              Dharura ({criticalCount})
            </button>

            <button
              onClick={() => setStatusFilter('important')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 border ${
                statusFilter === 'important'
                  ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              Muhimu ({importantCount})
            </button>
          </div>

          {/* NOTIFICATION LIST */}
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notif) => {
                const isCritical = notif.importance === 'critical';
                const isImportant = notif.importance === 'important';

                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={() => markAsRead(notif.id)}
                    className={`relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group ${
                      notif.isRead
                        ? 'bg-white dark:bg-neutral-900/70 border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300'
                        : isCritical
                        ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 shadow-xs'
                        : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 shadow-xs'
                    }`}
                  >
                    {/* Unread Left Border Marker */}
                    {!notif.isRead && (
                      <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full ${
                        isCritical ? 'bg-red-500' : 'bg-orange-500'
                      }`} />
                    )}

                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCritical 
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-400' 
                          : isImportant
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/80 dark:text-orange-400'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {isCritical ? (
                          <Flame className="w-5 h-5 animate-pulse" />
                        ) : (
                          <Bell className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-sm font-bold tracking-tight ${
                            notif.isRead 
                              ? 'text-neutral-800 dark:text-neutral-200' 
                              : isCritical
                              ? 'text-red-700 dark:text-red-400 font-extrabold'
                              : 'text-neutral-900 dark:text-white font-extrabold'
                          }`}>
                            {notif.title}
                          </h3>

                          <span className="text-[11px] text-neutral-400 font-medium shrink-0">
                            {notif.createdAt ? format(new Date(notif.createdAt), 'HH:mm') : ''}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                          {notif.body}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          {notif.importance && notif.importance !== 'normal' && (
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isCritical 
                                ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400' 
                                : 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400'
                            }`}>
                              {notif.importance}
                            </span>
                          )}

                          {!notif.isRead && (
                            <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400">
                              • Bofya kusoma
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredNotifications.length === 0 && (
              <div className="py-16 text-center space-y-3 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
                    Hakuna taarifa zozote hapa
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Huna ujumbe au arifa yoyote katika kitengo hiki.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SOUND SETTINGS */}
      {activeTab === 'sound_settings' && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-neutral-900 dark:text-white uppercase italic">
                Mipangilio ya Sauti (Sound Alerts)
              </h2>
              <p className="text-xs text-neutral-500">
                Weka sauti na milio ya taarifa kulingana na uzito wa arifa.
              </p>
            </div>
            <Button
              onClick={handleCustomSoundReset}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold gap-1.5 self-start sm:self-auto"
            >
              <Undo2 className="w-3.5 h-3.5" /> Rudisha Sauti za Awali
            </Button>
          </div>

          <div className="space-y-6">
            
            {/* Critical Sound */}
            <div className="p-4 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                    1. Mlio wa Dharura (Critical Alert Siren)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerSound('critical', true)}
                  className="h-8 rounded-lg text-xs font-bold text-red-600 hover:text-red-700 gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Jaribu Sauti
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Hupigwa mfululizo kwa safari za teksi, oda mpya za haraka, na dharura.
              </p>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  placeholder="URL ya sauti..." 
                  className="h-10 text-xs rounded-xl bg-white dark:bg-neutral-950 font-medium"
                  value={soundSettings.critical}
                  onChange={(e) => setSoundSettings({ ...soundSettings, critical: e.target.value })}
                />
                <Button 
                  onClick={() => handleCustomSoundLinkSave('critical', soundSettings.critical)}
                  className="h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold px-4"
                >
                  Hifadhi
                </Button>
              </div>
            </div>

            {/* Important Sound */}
            <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    2. Mlio wa Taarifa Muhimu (Important Notification)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerSound('important', true)}
                  className="h-8 rounded-lg text-xs font-bold text-amber-600 hover:text-amber-700 gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Jaribu Sauti
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Hupigwa kwa oda zilizokubaliwa, malipo yaliyofaulu, na rider anapofika.
              </p>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  placeholder="URL ya sauti..." 
                  className="h-10 text-xs rounded-xl bg-white dark:bg-neutral-950 font-medium"
                  value={soundSettings.important}
                  onChange={(e) => setSoundSettings({ ...soundSettings, important: e.target.value })}
                />
                <Button 
                  onClick={() => handleCustomSoundLinkSave('important', soundSettings.important)}
                  className="h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold px-4"
                >
                  Hifadhi
                </Button>
              </div>
            </div>

            {/* Normal Sound */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-neutral-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    3. Mlio wa Kawaida (Normal Chime)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerSound('normal', true)}
                  className="h-8 rounded-lg text-xs font-bold text-neutral-600 gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Jaribu Sauti
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Hupigwa kwa kuponi, ofa na ujumbe wa kawaida.
              </p>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  placeholder="URL ya sauti..." 
                  className="h-10 text-xs rounded-xl bg-white dark:bg-neutral-950 font-medium"
                  value={soundSettings.normal}
                  onChange={(e) => setSoundSettings({ ...soundSettings, normal: e.target.value })}
                />
                <Button 
                  onClick={() => handleCustomSoundLinkSave('normal', soundSettings.normal)}
                  className="h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold px-4"
                >
                  Hifadhi
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-neutral-900 dark:text-white uppercase italic">
              Jaribu Mfumo wa Taarifa (Notification Simulator)
            </h2>
            <p className="text-xs text-neutral-500">
              Bofya aina yoyote ya taarifa hapa chini ili kuona namna inavyotokea na kusikika live.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 mb-3">
                1. Taarifa za Wateja (Customer Alerts)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {roleTemplates.customer.map((tmpl, idx) => (
                  <div 
                    key={`cust-${idx}`}
                    className="p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3 hover:border-orange-500 transition-all bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {tmpl.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {tmpl.sw}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => simulateNotification(tmpl)}
                      className="h-8 text-[10px] font-black uppercase rounded-lg bg-orange-600 hover:bg-orange-700 text-white shrink-0 gap-1"
                    >
                      <Play className="w-3 h-3" /> Tuma
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-orange-600 mb-3">
                2. Taarifa za Madereva & Maduka (Driver / Vendor Alerts)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {roleTemplates.driver_vendor.map((tmpl, idx) => (
                  <div 
                    key={`drv-${idx}`}
                    className="p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3 hover:border-orange-500 transition-all bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {tmpl.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {tmpl.sw}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => simulateNotification(tmpl)}
                      className="h-8 text-[10px] font-black uppercase rounded-lg bg-red-600 hover:bg-red-700 text-white shrink-0 gap-1"
                    >
                      <Play className="w-3 h-3" /> Tuma
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
