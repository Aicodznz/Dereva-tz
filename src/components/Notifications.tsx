import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, query, where, onSnapshot, 
  updateDoc, doc, writeBatch, deleteDoc, getDoc, setDoc 
} from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Volume2, Flame, CheckCheck, Inbox, Trash2,
  Lock, Smartphone, ArrowDownToLine, CircleDot, Image,
  Zap, Layers, VolumeX, Timer, Send, ShieldCheck, CheckCircle2,
  ExternalLink, Sparkles, RefreshCw, SmartphoneNfc
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { playSyntheticNormal, playSyntheticImportant, playSyntheticCritical } from '../utils/soundAlert';
import { pushNotificationService, PushNotificationPayload } from '../utils/pushNotificationService';

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
}

interface SoundSettings {
  critical: string;
  important: string;
  normal: string;
}

const DEFAULT_SOUNDS: SoundSettings = {
  critical: 'https://assets.mixkit.co/active_storage/sfx/911/911-720.wav',
  important: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-720.wav',
  normal: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-720.wav',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUNDS);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'critical' | 'important'>('all');
  const [loading, setLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Tab: 'push_studio' (9 Native Push Notification Types) or 'inbox' (All stored notifications)
  const [activeMainTab, setActiveMainTab] = useState<'push_studio' | 'inbox'>('push_studio');

  // Push Notification Studio State
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => 
    pushNotificationService.getPermission()
  );
  const [appBadgeCount, setAppBadgeCount] = useState<number>(() => 
    pushNotificationService.getAppBadgeCount() || 3
  );
  const [isProgressRunning, setIsProgressRunning] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [lastActionReceived, setLastActionReceived] = useState<string | null>(null);
  const [groupedCounter, setGroupedCounter] = useState(1);
  
  // Immersive full-screen critical alert state
  const [activeCriticalAlert, setActiveCriticalAlert] = useState<{
    id: string;
    title: string;
    body: string;
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

  const triggerSound = (importance: 'critical' | 'important' | 'normal') => {
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const url = soundSettings[importance] || DEFAULT_SOUNDS[importance];
      if (!url) return;
      
      const audio = new Audio(url);
      activeAudioRef.current = audio;
      
      if (importance === 'critical') {
        audio.loop = true;
      }
      
      audio.play().then(() => {
        setIsAudioEnabled(true);
      }).catch(() => {
        if (importance === 'critical') {
          playSyntheticCritical();
        } else if (importance === 'important') {
          playSyntheticImportant();
        } else {
          playSyntheticNormal();
        }
      });
    } catch (e) {
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

  // Delete single notification
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success("Taarifa imefutwa.");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Imeshindwa kufuta taarifa.");
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    if (!user || notifications.length === 0) return;
    if (!window.confirm("Je, una uhakika unataka kufuta taarifa zote?")) {
      return;
    }

    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      toast.success("Taarifa zote zimefutwa kikamilifu.");
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      toast.error("Imeshindwa kufuta taarifa zote.");
    }
  };

  // Listen for Push Notification interactive actions
  useEffect(() => {
    const unsub = pushNotificationService.onAction((event) => {
      setLastActionReceived(`Umebonyeza [${event.action.toUpperCase()}] kwenye taarifa "${event.title || 'Papo Hapo'}"`);
      toast.success(`⚡ Tendo Limethibitishwa: ${event.action.toUpperCase()}`, {
        description: `Umefanya tendo hili moja kwa moja kutoka kwenye Push Notification bila kufungua app!`,
        icon: '🔔'
      });
    });
    return () => unsub();
  }, []);

  const handleRequestPushPermission = async () => {
    const perm = await pushNotificationService.requestPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      toast.success("Hongera! Push Notifications zimeruhusiwa rasmi kwenye kifaa chako.");
      pushNotificationService.showBannerNotification({
        title: "🎉 Push Notification Imewashwa!",
        body: "Sasa utapokea arifa zote za lock screen, banner, na miamala ya PapoPay."
      });
    } else {
      toast.error("Ruhusa ya Push Notification haikukubaliwa na kivinjari.");
    }
  };

  // 1. Lock Screen Test
  const handleTestLockScreen = async () => {
    const ok = await pushNotificationService.showLockScreenNotification({
      amount: 150000,
      customerName: "Amina Bakari"
    });
    if (ok) {
      toast.success("🔔 Lock Screen Notification Imetumwa!", {
        description: "Funga simu yako au angalia lock screen kuona arifa iliyolindwa."
      });
    }
  };

  // 2. Banner Test
  const handleTestBanner = async () => {
    const ok = await pushNotificationService.showBannerNotification({
      title: "📱 Papo Hapo: Dereva Amewasili!",
      body: "Dereva Juma (Toyota IST T 412 DFG) yuko nje. Bofya kuona ramani."
    });
    if (ok) {
      toast.success("📱 Notification Banner Imetumwa!", {
        description: "Ujumbe unajitokeza mara moja juu ya skrini yako (Heads-Up Banner)."
      });
    }
  };

  // 3. Panel Test
  const handleTestPanel = async () => {
    const ok = await pushNotificationService.showPanelNotification({
      title: "📥 PapoPay: Risiti ya EFD Imethibitishwa",
      body: "Risiti #TZ-EFD-9012 ya TZS 45,000 imehifadhiwa. Shusha sehemu ya juu ya simu kuiona."
    });
    if (ok) {
      toast.success("📥 Notification Panel Imetumwa!", {
        description: "Shusha sehemu ya juu ya simu yako (Notification Center / Drawer) kuiona."
      });
    }
  };

  // 4. Badge Test
  const handleUpdateBadge = async (newCount: number) => {
    const next = Math.max(0, newCount);
    setAppBadgeCount(next);
    if (next === 0) {
      await pushNotificationService.clearAppBadge();
      toast.info("🔴 App Badge Imeondolewa kwenye icon ya app.");
    } else {
      await pushNotificationService.setAppBadge(next);
      toast.success(`🔴 App Badge Imesasishwa: ${next} kwenye icon ya app!`, {
        description: "Angalia launcher / home screen ya simu au dock ya kompyuta."
      });
    }
  };

  // 5. Rich Notification Test
  const handleTestRich = async () => {
    const ok = await pushNotificationService.showRichNotification({
      title: "🖼️ PapoPay: Risiti ya Muamala",
      body: "Malipo ya TZS 350,000 kwa Baraka Msuya yamekamilika kwa uthibitisho wa uso.",
      image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80"
    });
    if (ok) {
      toast.success("🖼️ Rich Notification Imetumwa!", {
        description: "Inaonyesha picha kamili ya risiti ya muamala ndani ya arifa."
      });
    }
  };

  // 6. Action Notification Test
  const handleTestAction = async () => {
    const ok = await pushNotificationService.showActionNotification({
      title: "⚡ PapoPay: Ombi la Malipo TZS 60,000",
      body: "Kituo cha Kariakoo Hub kinaomba uidhinishe malipo. Bofya kitufe kutenda.",
      actions: [
        { action: 'kubali', title: '✅ Kubali' },
        { action: 'kataa', title: '❌ Kataa' },
        { action: 'angalia', title: '👁️ Angalia' }
      ]
    });
    if (ok) {
      toast.success("⚡ Action Notification Imetumwa!", {
        description: "Ina vitufe vya [Kubali], [Kataa], na [Angalia] bila kulazimika kufungua app nzima!"
      });
    }
  };

  // 7. Grouped Notification Test
  const handleTestGrouped = async () => {
    const ok = await pushNotificationService.showGroupedNotification(groupedCounter);
    setGroupedCounter(prev => prev + 1);
    if (ok) {
      toast.success(`📚 Grouped Notification #${groupedCounter} Imetumwa!`, {
        description: "Inakusanya taarifa kwenye kikundi kimoja (Stack) ili panel isijazwe."
      });
    }
  };

  // 8. Silent Notification Test
  const handleTestSilent = async () => {
    const ok = await pushNotificationService.showSilentNotification({
      title: "🤫 PapoPay: Sasisho Kimyakimya",
      body: "Alama zako za kibayometriki za AI zimesawazishwa bila kutoa mlio wala banner."
    });
    if (ok) {
      toast.success("🤫 Silent Notification Imetumwa!", {
        description: "Imewasili kimyakimya bila sauti wala mtikisiko, ikiwa tayari kwenye panel."
      });
    }
  };

  // 9. Progress Notification Test
  const handleTestProgress = async () => {
    if (isProgressRunning) return;
    setIsProgressRunning(true);
    setProgressPercent(15);
    toast.info("⏳ Progress Notification Imeanza!", {
      description: "Tazama arifa yako ikisasisha maendeleo kutoka 15% hadi 100% kwa vitendo."
    });

    await pushNotificationService.startProgressNotificationDemo((percent) => {
      setProgressPercent(percent);
    });

    setIsProgressRunning(false);
    toast.success("⏳ Progress Notification Imekamilika 100%!");
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

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 px-2 sm:px-4">
      
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
              Papo Hapo Express Alert Hub
            </p>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center flex-wrap gap-2 self-start sm:self-center">
          {!isAudioEnabled ? (
            <button 
              onClick={() => {
                const audio = new Audio(DEFAULT_SOUNDS.normal);
                audio.play().catch(() => {});
                setIsAudioEnabled(true);
                toast.success("Sauti za arifa zimewashwa!");
              }}
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-black uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
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

          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={deleteAllNotifications}
              className="h-9 px-3 rounded-xl border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-400 font-bold text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Futa Zote
            </Button>
          )}
        </div>
      </div>

      {/* TOP PRIMARY TABS: PUSH NOTIFICATIONS STUDIO (9 TYPES) vs INBOX */}
      <div className="flex items-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveMainTab('push_studio')}
          className={`flex-1 py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'push_studio'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <SmartphoneNfc className="w-4 h-4" />
          <span>1. Kituo cha Push Notifications (Aina 9)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('inbox')}
          className={`flex-1 py-3 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'inbox'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>2. Kikasha cha Taarifa ({notifications.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PUSH NOTIFICATION STUDIO - ALL 9 NATIVE TYPES      */}
      {/* ======================================================== */}
      {activeMainTab === 'push_studio' && (
        <div className="space-y-4">
          {/* SYSTEM PERMISSION & BADGE STATUS BANNER */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                  pushPermission === 'granted' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                      Hali ya Ruhusa ya Push Notifications:
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      pushPermission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {pushPermission === 'granted' ? 'Imeruhusiwa ✓' : pushPermission === 'denied' ? 'Imezuiwa ✕' : 'Inahitaji Ruhusa ⚠️'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {pushPermission === 'granted'
                      ? 'Arifa za mfumo (System Notifications) ziko tayari kufanya kazi kwenye kifaa chako.'
                      : 'Bofya kitufe cha chini ili kuruhusu kifaa chako kupokea arifa za mfumo.'}
                  </p>
                </div>
              </div>

              {pushPermission !== 'granted' ? (
                <Button
                  onClick={handleRequestPushPermission}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 shrink-0"
                >
                  <Bell className="w-4 h-4 mr-1.5" /> Washa Push Notifications
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Web Push Active
                  </span>
                </div>
              )}
            </div>

            {/* LIVE ACTION INTERCEPT NOTIFICATION LOG */}
            {lastActionReceived && (
              <div className="p-3 rounded-2xl bg-orange-950/40 border border-orange-500/40 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-orange-200">
                  <Sparkles className="w-4 h-4 text-orange-400 shrink-0 animate-spin" />
                  <span className="font-bold">{lastActionReceived}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastActionReceived(null)}
                  className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5"
                >
                  Futa
                </button>
              </div>
            )}

            {/* LIVE PROGRESS NOTIFICATION RUNNER BAR */}
            {isProgressRunning && (
              <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-teal-300 font-bold flex items-center gap-1.5">
                    <Timer className="w-4 h-4 animate-spin text-teal-400" />
                    Progress Notification Inafanya Kazi...
                  </span>
                  <span className="text-teal-400 font-black">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: 'easeOut', duration: 0.4 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TABLE & GRID OF ALL 9 NATIVE PUSH NOTIFICATION TYPES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Aina 9 za Push Notifications Zinazofanya Kazi:
              </h2>
              <span className="text-xs text-neutral-500 font-medium">Bofya "Tuma Jaribio" Kujaribu Kila Moja</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. 🔔 LOCK SCREEN */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-amber-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                        <Lock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">🔔 Lock Screen</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      Imefungwa
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Inaonekana simu ikiwa imefungwa (Lock Screen) ikilinda taarifa na kuonyesha uthibitisho wa miamala.
                  </p>
                </div>

                <Button
                  onClick={handleTestLockScreen}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Lock Screen Jaribio
                </Button>
              </div>

              {/* 2. 📱 NOTIFICATION BANNER */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-emerald-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">📱 Notification Banner</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      Heads-Up
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Ujumbe unajitokeza mara moja juu ya skrini (Banner) ukiwa na mtikisiko wa tahadhari.
                  </p>
                </div>

                <Button
                  onClick={handleTestBanner}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Banner Jaribio
                </Button>
              </div>

              {/* 3. 📥 NOTIFICATION PANEL */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-cyan-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                        <ArrowDownToLine className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">📥 Notification Panel</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                      Drawer Tray
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Inaonekana ukishusha sehemu ya juu ya simu (Notification Center / Drawer) ikiwa na risiti na link ya kufungua.
                  </p>
                </div>

                <Button
                  onClick={handleTestPanel}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Panel Jaribio
                </Button>
              </div>

              {/* 4. 🔴 APP BADGE */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-rose-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
                        <CircleDot className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">🔴 App Badge</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      Icon Counter
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Alama nyekundu ya idadi ya ujumbe kwenye icon ya app kwenye home screen ya simu au dock ya kompyuta.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateBadge(appBadgeCount - 1)}
                    className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-bold text-xs"
                  >
                    -
                  </button>
                  <div className="flex-1 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-center font-mono font-black text-xs">
                    🔴 Idadi: {appBadgeCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateBadge(appBadgeCount + 1)}
                    className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-bold text-xs"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateBadge(0)}
                    className="px-2.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-bold text-[10px] text-neutral-500"
                    title="Futa Badge"
                  >
                    Futa
                  </button>
                </div>
              </div>

              {/* 5. 🖼️ RICH NOTIFICATION */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-purple-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold">
                        <Image className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">🖼️ Rich Notification</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      Picha / Media
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Huonyesha picha kubwa ya risiti ya muamala au picha ya mtumaji ndani ya notification banner na drawer.
                  </p>
                </div>

                <Button
                  onClick={handleTestRich}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Rich Notification
                </Button>
              </div>

              {/* 6. ⚡ ACTION NOTIFICATION */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-amber-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">⚡ Action Notification</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      Interactive Buttons
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Ina vitufe kama [Kubali], [Kataa], au [Angalia] bila kulazimika kufungua app nzima.
                  </p>
                </div>

                <Button
                  onClick={handleTestAction}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Action Notification
                </Button>
              </div>

              {/* 7. 📚 GROUPED NOTIFICATION */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-blue-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">📚 Grouped Notification</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      Stack / Summary
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Hukusanya taarifa nyingi kutoka app moja ili notification panel isijazwe ujumbe mmoja mmoja.
                  </p>
                </div>

                <Button
                  onClick={handleTestGrouped}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Grouped (#{groupedCounter})
                </Button>
              </div>

              {/* 8. 🤫 SILENT NOTIFICATION */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-neutral-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-neutral-500/20 text-neutral-500 flex items-center justify-center font-bold">
                        <VolumeX className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">🤫 Silent Notification</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      Kimyakimya
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Inaweza kuwasilisha taarifa bila kutoa sauti au kuonyesha banner, inatua kimyakimya kwenye panel.
                  </p>
                </div>

                <Button
                  onClick={handleTestSilent}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Tuma Silent Notification
                </Button>
              </div>

              {/* 9. ⏳ PROGRESS NOTIFICATION */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-teal-400/50 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-500 flex items-center justify-center font-bold">
                        <Timer className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">⏳ Progress Notification</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                      Live Task
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <strong>Inavyoonekana:</strong> Upau wa asilimia <code>[████▒▒▒▒] dk 6 zimebaki</code> unaosasisha maendeleo ya dereva anaposogea au muda wa kufika (ETA) kwa wakati halisi.
                  </p>
                </div>

                <Button
                  disabled={isProgressRunning}
                  onClick={handleTestProgress}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm disabled:opacity-50"
                >
                  <Timer className={`w-3.5 h-3.5 mr-1.5 ${isProgressRunning ? 'animate-spin' : ''}`} />
                  {isProgressRunning ? `Inasasisha [${progressPercent}%]...` : 'Anzisha Live ETA & Progress [████▒▒▒▒]'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INBOX - STORED FIRESTORE NOTIFICATIONS LIST        */}
      {/* ======================================================== */}
      {activeMainTab === 'inbox' && (
        <div className="space-y-4">
          {/* STATUS FILTER PILLS */}
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
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    onClick={() => markAsRead(notif.id)}
                    className={`relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group ${
                      notif.isRead
                        ? 'bg-white dark:bg-neutral-900/70 border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700'
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

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-neutral-400 font-medium">
                              {notif.createdAt ? format(new Date(notif.createdAt), 'HH:mm') : ''}
                            </span>

                            {/* DELETE BUTTON */}
                            <button
                              onClick={(e) => deleteNotification(notif.id, e)}
                              title="Futa taarifa hii"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all opacity-80 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

    </div>
  );
}
