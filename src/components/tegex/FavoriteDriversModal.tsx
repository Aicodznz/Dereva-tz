import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Heart, Trash2, Phone, MessageSquare, Star, 
  Navigation, MessageCircle, ArrowLeft, Send, ExternalLink,
  Zap, Search, Sparkles, Check, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../ThemeContext';
import { useAuth } from '../../AuthContext';
import { db } from '../../firebase';
import { collection, query, where, limit, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { 
  FavoriteDriver, 
  getLocalFavoriteDrivers, 
  removeCustomerFavoriteDriver,
  fetchFavoriteDrivers,
  saveCustomerFavoriteDriver
} from '../../utils/customerPreferences';

interface FavoriteDriversModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDriverForBooking?: (driver: FavoriteDriver) => void;
  userId?: string;
}

interface InAppChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  createdAt: any;
}

const VEHICLE_CONFIGS: Record<string, { label: string; iconEmoji: string; color: string }> = {
  mini: { label: 'Gari / Taxi', iconEmoji: '🚗', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  bajaj: { label: 'Bajaji', iconEmoji: '🛺', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  bike: { label: 'Boda Boda', iconEmoji: '🏍️', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
};

export const FavoriteDriversModal: React.FC<FavoriteDriversModalProps> = ({
  isOpen,
  onClose,
  onSelectDriverForBooking,
  userId,
}) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [drivers, setDrivers] = useState<FavoriteDriver[]>([]);
  const [activeChatDriver, setActiveChatDriver] = useState<FavoriteDriver | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'online' | '5stars'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineDriverMap, setOnlineDriverMap] = useState<Record<string, boolean>>({});
  const [discovered5StarDrivers, setDiscovered5StarDrivers] = useState<FavoriteDriver[]>([]);
  const [addingDiscoveredId, setAddingDiscoveredId] = useState<string | null>(null);

  // In-system chat states
  const [chatMessages, setChatMessages] = useState<InAppChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load drivers on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      const list = getLocalFavoriteDrivers();
      setDrivers(list);
      fetchFavoriteDrivers(userId).then(fetched => {
        if (fetched && fetched.length > 0) {
          setDrivers(fetched);
        }
      });
    } else {
      setActiveChatDriver(null);
      setInputMessage('');
      setSearchQuery('');
    }
  }, [isOpen, userId]);

  // Listen to favorite driver update events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) setDrivers(e.detail);
    };
    window.addEventListener('paporide_drivers_updated', handleUpdate);
    return () => window.removeEventListener('paporide_drivers_updated', handleUpdate);
  }, []);

  const formatCleanPhone = (p: string) => {
    let clean = (p || '').replace(/\s+/g, '').replace(/-/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.substring(1);
    } else if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    return clean;
  };

  // Listen to active online drivers in Firestore
  useEffect(() => {
    if (!isOpen) return;

    try {
      const q = query(
        collection(db, 'drivers'),
        where('isOnline', '==', true)
      );

      const unsub = onSnapshot(q, (snap) => {
        const map: Record<string, boolean> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = true;
          if (data.phone) {
            map[formatCleanPhone(data.phone)] = true;
          }
          if (data.vehiclePlate) {
            map[data.vehiclePlate.trim().toUpperCase().replace(/\s+/g, '')] = true;
          }
          if (data.name) {
            map[data.name.trim().toLowerCase()] = true;
          }
        });
        setOnlineDriverMap(map);
      }, (err) => {
        console.warn('FavoriteDriversModal: error listening to online drivers:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('FavoriteDriversModal: could not query online drivers:', e);
    }
  }, [isOpen]);

  // Discover 5-star drivers from previous completed rides
  useEffect(() => {
    if (!isOpen) return;
    const load5StarDriversFromRides = async () => {
      try {
        const uid = user?.uid || userId;
        if (!uid) return;

        const q = query(
          collection(db, 'rides'),
          where('customerId', '==', uid),
          where('status', '==', 'completed'),
          limit(25)
        );

        const snap = await getDocs(q);
        const candidates: FavoriteDriver[] = [];
        const seenPhones = new Set<string>();

        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const rating = Number(data.rating || data.driverRating || data.stars || 5);
          if (rating >= 4.5 && data.driverInfo?.name) {
            const phone = data.driverInfo.phone || '';
            const clean = formatCleanPhone(phone);
            if (clean && !seenPhones.has(clean)) {
              seenPhones.add(clean);
              // Check if not already in favorites
              const alreadyFav = drivers.some(
                (f) => formatCleanPhone(f.phone) === clean || (f.driverId && f.driverId === data.driverId)
              );
              if (!alreadyFav) {
                candidates.push({
                  id: `disc_${d.id}`,
                  driverId: data.driverId || '',
                  name: data.driverInfo.name,
                  phone: data.driverInfo.phone || '',
                  photo: data.driverInfo.photo || '',
                  vehicleType: data.vehicleType || data.driverInfo.vehicleType || 'mini',
                  vehiclePlate: data.driverInfo.vehiclePlate || data.driverInfo.plateNumber || 'T 123 ABC',
                  vehicleModel: data.driverInfo.vehicleModel || 'Taxi',
                  rating: rating,
                  notes: 'Dereva uliyempa nyota 5 kwenye safari iliyopita',
                  addedAt: Date.now(),
                });
              }
            }
          }
        });

        setDiscovered5StarDrivers(candidates);
      } catch (err) {
        console.warn('Could not discover 5-star drivers from rides:', err);
      }
    };

    load5StarDriversFromRides();
  }, [isOpen, user?.uid, userId, drivers]);

  const checkIsDriverOnline = (drv: FavoriteDriver): boolean => {
    if (drv.driverId && onlineDriverMap[drv.driverId]) return true;
    if (drv.id && onlineDriverMap[drv.id]) return true;
    if (drv.phone && onlineDriverMap[formatCleanPhone(drv.phone)]) return true;
    if (drv.vehiclePlate && onlineDriverMap[drv.vehiclePlate.trim().toUpperCase().replace(/\s+/g, '')]) return true;
    if (drv.name && onlineDriverMap[drv.name.trim().toLowerCase()]) return true;
    return false;
  };

  const handleAddDiscoveredDriver = async (discovered: FavoriteDriver) => {
    try {
      setAddingDiscoveredId(discovered.id);
      await saveCustomerFavoriteDriver(
        {
          driverId: discovered.driverId,
          name: discovered.name,
          phone: discovered.phone,
          photo: discovered.photo,
          vehicleType: discovered.vehicleType,
          vehiclePlate: discovered.vehiclePlate,
          vehicleModel: discovered.vehicleModel,
          rating: discovered.rating || 5.0,
          notes: 'Dereva wa nyota 5 aliyehifadhiwa kutoka safari zilizopita',
        },
        userId
      );
      toast.success(`Dereva "${discovered.name}" ameongezwa kwenye vipenzi vyako! ⭐`);
      setDiscovered5StarDrivers((prev) => prev.filter((d) => d.id !== discovered.id));
      setDrivers(getLocalFavoriteDrivers());
    } catch (err) {
      console.error('Failed to add discovered driver:', err);
      toast.error('Imeshindwa kuongeza dereva kwenye vipenzi.');
    } finally {
      setAddingDiscoveredId(null);
    }
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((drv) => {
      // Tab filter
      if (activeTab === 'online' && !checkIsDriverOnline(drv)) return false;
      if (activeTab === '5stars' && (drv.rating || 5) < 4.8) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (drv.name || '').toLowerCase().includes(q);
        const matchesPlate = (drv.vehiclePlate || '').toLowerCase().includes(q);
        const matchesPhone = (drv.phone || '').includes(q);
        const matchesModel = (drv.vehicleModel || '').toLowerCase().includes(q);
        return matchesName || matchesPlate || matchesPhone || matchesModel;
      }
      return true;
    });
  }, [drivers, activeTab, searchQuery, onlineDriverMap]);

  const onlineCount = useMemo(() => {
    return drivers.filter((d) => checkIsDriverOnline(d)).length;
  }, [drivers, onlineDriverMap]);

  const fiveStarCount = useMemo(() => {
    return drivers.filter((d) => (d.rating || 5) >= 4.8).length;
  }, [drivers]);

  const handleDelete = async (id: string, driverName: string) => {
    if (window.confirm(`Una uhakika unataka kuondoa "${driverName}" kwenye madereva unaowapenda?`)) {
      await removeCustomerFavoriteDriver(id, userId);
      toast.success(`"${driverName}" ameondolewa.`);
      setDrivers(getLocalFavoriteDrivers());
      if (activeChatDriver?.id === id) {
        setActiveChatDriver(null);
      }
    }
  };

  // Real-time chat subscription when activeChatDriver is set
  const currentUserId = user?.uid || userId || 'guest_customer';
  const targetDriverRecipientId = activeChatDriver 
    ? (activeChatDriver.driverId || activeChatDriver.id || ('drv_' + formatCleanPhone(activeChatDriver.phone)))
    : '';

  const chatId = activeChatDriver && currentUserId
    ? [currentUserId, targetDriverRecipientId].sort().join('_')
    : '';

  useEffect(() => {
    if (!chatId || !activeChatDriver) {
      setChatMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as InAppChatMessage[];

        msgs.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tA - tB;
        });

        setChatMessages(msgs);
      },
      (error) => {
        console.warn('Favorite driver chat snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [chatId, activeChatDriver]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatDriver]);

  const handleSendChatMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !chatId || !activeChatDriver || isSending) return;

    try {
      setIsSending(true);
      const msgData = {
        chatId,
        text,
        senderId: currentUserId,
        senderName: user?.displayName || profile?.displayName || profile?.fullName || 'Mteja',
        senderPhoto: user?.photoURL || (profile as any)?.photoURL || (profile as any)?.photo || '',
        participants: [currentUserId, targetDriverRecipientId].sort(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'messages'), msgData);
      setInputMessage('');
    } catch (err) {
      console.error('Failed to send favorite driver message:', err);
      toast.error('Imeshindikana kutuma ujumbe kwenye mfumo.');
    } finally {
      setIsSending(false);
    }
  };

  const quickSwahiliReplies = [
    'Habari dereva! Upo tayari kwa safari?',
    'Uko eneo gani sasa hivi?',
    'Nitakuhitaji baada ya dakika chache',
    'Nimeagiza safari nawe, tafadhali ipokee',
    'Sawa, shukrani!',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          theme === 'dark' ? 'border-neutral-800 bg-[#161622]' : 'border-neutral-100 bg-neutral-50/80'
        }`}>
          <div className="flex items-center gap-3">
            {activeChatDriver ? (
              <button
                onClick={() => setActiveChatDriver(null)}
                className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 transition-all active:scale-95"
                title="Rudi kwenye orodha ya madereva"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <Heart className="w-5 h-5 fill-rose-500" />
              </div>
            )}
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                {activeChatDriver ? `Chat na ${activeChatDriver.name}` : 'Madereva Ninaowapenda (Favorite Drivers)'}
              </h3>
              <p className="text-[11px] text-neutral-400 font-semibold">
                {activeChatDriver 
                  ? 'Mawasiliano ya moja kwa moja kwenye mfumo' 
                  : 'Orodha ya madereva wako unaowaamini na kuwapenda zaidi'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {activeChatDriver ? (
          /* ACTIVE IN-SYSTEM CHAT VIEW WITH FAVORITE DRIVER */
          <div className="flex-1 overflow-hidden flex flex-col min-h-[420px]">
            {/* Driver Banner Info */}
            <div className={`p-3.5 border-b flex items-center justify-between gap-3 ${
              theme === 'dark' ? 'bg-[#141420] border-neutral-800' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-rose-500/10 border border-rose-500/30 flex items-center justify-center font-black text-rose-500 shrink-0">
                  {activeChatDriver.photo ? (
                    <img src={activeChatDriver.photo} alt={activeChatDriver.name} className="w-full h-full object-cover" />
                  ) : (
                    activeChatDriver.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black truncate">{activeChatDriver.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Yupo mtandaoni" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold">
                    <span className="bg-amber-400 text-neutral-950 font-mono font-black px-1 rounded text-[9px]">
                      {activeChatDriver.vehiclePlate}
                    </span>
                    <span>{activeChatDriver.vehicleModel || 'Dereva Mpendwa'}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons on driver chat banner */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    navigate(`/chat?to=${targetDriverRecipientId}`);
                    onClose();
                  }}
                  className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                    theme === 'dark'
                      ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                  title="Fungua Skrini Kamili ya Chat"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Skrini Kamili</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div 
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-neutral-400">
                    Bado hujaanza mazungumzo na dereva huyu kwenye mfumo.
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Tuma ujumbe hapa chini au chagua sentensi za haraka kuwasiliana naye moja kwa moja!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  const timeFormatted = msg.createdAt 
                    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs font-medium leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-xs'
                            : `${theme === 'dark' ? 'bg-neutral-800 text-neutral-100 border border-neutral-700' : 'bg-neutral-100 text-neutral-800 border border-neutral-200'} rounded-bl-xs`
                        }`}
                      >
                        <p>{msg.text}</p>
                        <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-neutral-400'}`}>
                          {timeFormatted}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick replies pills */}
            <div className={`p-2 border-t overflow-x-auto flex gap-1.5 no-scrollbar ${
              theme === 'dark' ? 'bg-[#14141e] border-neutral-800' : 'bg-neutral-50 border-neutral-100'
            }`}>
              {quickSwahiliReplies.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSendChatMessage(r)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border transition-all active:scale-95 shrink-0 ${
                    theme === 'dark'
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:border-indigo-500/40'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-indigo-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className={`p-3 border-t flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200'
              }`}
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Andika ujumbe kwa dereva kwenye mfumo..."
                className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-bold border outline-none ${
                  theme === 'dark'
                    ? 'bg-[#181824] border-neutral-700 text-white placeholder-neutral-500 focus:border-indigo-500'
                    : 'bg-neutral-100 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-indigo-600'
                }`}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0"
                title="Tuma Ujumbe"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* FAVORITE DRIVERS LIST VIEW */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Search and Tabs Filter Bar */}
            <div className="space-y-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tafuta dereva kwa jina, namba ya pleti au gari..."
                  className={`w-full pl-9 pr-8 py-2.5 rounded-2xl text-xs border outline-none transition-all ${
                    theme === 'dark'
                      ? 'bg-neutral-900/80 border-neutral-800 text-white placeholder-neutral-500 focus:border-rose-500'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:border-rose-500'
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Wote ({drivers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('online')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTab === 'online'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-neutral-500 hover:text-emerald-500'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  Hewani ({onlineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('5stars')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTab === '5stars'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-neutral-500 hover:text-amber-500'
                  }`}
                >
                  <Star className="w-3 h-3 fill-current" />
                  Nyota 5 ({fiveStarCount})
                </button>
              </div>
            </div>

            {/* 5-Star Drivers Auto-Discovery Banner */}
            {discovered5StarDrivers.length > 0 && (
              <div className={`p-3.5 rounded-2xl border transition-all ${
                theme === 'dark' 
                  ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30' 
                  : 'bg-gradient-to-r from-amber-50 to-orange-50/40 border-amber-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 fill-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-black text-amber-700 dark:text-amber-300">
                      Madereva uliowapa Nyota 5 kwenye safari zilizopita:
                    </h5>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 mb-2">
                      Weka kwenye orodha ya vipenzi ili uweze kuwaomba safari moja kwa moja wakati wowote.
                    </p>

                    <div className="space-y-2">
                      {discovered5StarDrivers.slice(0, 2).map((disc) => (
                        <div 
                          key={disc.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                            theme === 'dark' ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-neutral-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate">{disc.name}</span>
                              <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-500">
                                <Star className="w-3 h-3 fill-amber-500" /> 5.0
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 block font-mono">
                              {disc.vehiclePlate} • {disc.vehicleModel || 'Taxi'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddDiscoveredDriver(disc)}
                            disabled={addingDiscoveredId === disc.id}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer"
                          >
                            <Heart className="w-3 h-3 fill-white" />
                            <span>{addingDiscoveredId === disc.id ? 'Inaongeza...' : '+ Weka Vipenzi'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DRIVERS LIST */}
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                  <Heart className="w-7 h-7 fill-rose-500/50" />
                </div>
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  {searchQuery 
                    ? `Hakuna dereva anayelingana na "${searchQuery}"`
                    : activeTab === 'online'
                      ? 'Hakuna dereva mpendwa aliye hewani kwa sasa'
                      : activeTab === '5stars'
                        ? 'Huna dereva wa nyota 5 kwenye orodha yako bado'
                        : 'Huna dereva unayempenda bado'}
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  {searchQuery 
                    ? 'Jaribu kutafuta kwa jina lingine au namba ya usajili wa chombo chake.'
                    : 'Ukisafiri na dereva mzuri na mstaarabu, mhifadhi kwenye skrini ya ukadiriaji (Rating) ili umkute hapa na kumuomba safari moja kwa moja akiwa hewani!'}
                </p>
              </div>
            ) : (
              filteredDrivers.map((drv) => {
                const vehicleConfig = VEHICLE_CONFIGS[drv.vehicleType] || VEHICLE_CONFIGS.mini;
                const cleanPhone = formatCleanPhone(drv.phone);
                const isOnline = checkIsDriverOnline(drv);

                return (
                  <div
                    key={drv.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all hover:shadow-md flex flex-col gap-3 ${
                      isOnline
                        ? theme === 'dark'
                          ? 'bg-neutral-900/90 border-emerald-500/30 hover:border-emerald-500/50 shadow-sm'
                          : 'bg-white border-emerald-300 hover:border-emerald-400 shadow-sm'
                        : theme === 'dark'
                          ? 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                          : 'bg-white border-neutral-200/90 hover:border-neutral-300 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Avatar, Name, Rating & Badges */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 ${
                            isOnline ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-500'
                          } flex items-center justify-center text-lg font-black ${
                            theme === 'dark' ? 'bg-neutral-800 text-neutral-200' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {drv.photo ? (
                              <img src={drv.photo} alt={drv.name} className="w-full h-full object-cover" />
                            ) : (
                              drv.name.charAt(0)
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center shadow-sm text-xs">
                            {vehicleConfig.iconEmoji}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black tracking-tight truncate">
                              {drv.name}
                            </h4>
                            <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-md text-[10px] font-black shrink-0 border border-amber-500/20">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{drv.rating ? drv.rating.toFixed(1) : '5.0'}</span>
                            </div>
                            {isOnline ? (
                              <span className="flex items-center gap-1 text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Yupo Hewani Sasa
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-md">
                                Hajaingia Mtandaoni
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-amber-400 text-neutral-950 font-mono font-black text-[9.5px] px-1.5 py-0.5 rounded border border-amber-500 shadow-2xs leading-none">
                              {drv.vehiclePlate}
                            </span>
                            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 truncate">
                              {drv.vehicleModel || vehicleConfig.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Top Right: In-System Chat & Delete Menu */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* In-system Chat button */}
                        <button
                          onClick={() => setActiveChatDriver(drv)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all active:scale-95 shadow-2xs cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200'
                          }`}
                          title="Chat na dereva kwenye mfumo"
                        >
                          <MessageCircle className="w-4 h-4 text-indigo-500" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Chat</span>
                        </button>

                        {/* Delete favorite driver button */}
                        <button
                          onClick={() => handleDelete(drv.id, drv.name)}
                          className="p-1.5 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Ondoa kwenye pendwa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Driver Notes if any */}
                    {drv.notes && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic bg-neutral-100/70 dark:bg-neutral-800/40 p-2 rounded-xl">
                        💬 "{drv.notes}"
                      </p>
                    )}

                    {/* Bottom Action Buttons: Omba Safari Naye (Direct) | Piga Simu | WhatsApp */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      {/* Direct Booking with Preferred Driver */}
                      {onSelectDriverForBooking && (
                        <button
                          onClick={() => {
                            onSelectDriverForBooking(drv);
                            toast.success(
                              isOnline
                                ? `Ombi la safari linatumwa moja kwa moja kwa ${drv.name} aliye hewani! 🚕⚡`
                                : `Safari itaombwa kupitia dereva wako mpendwa: ${drv.name}! 🚕❤️`
                            );
                            onClose();
                          }}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
                            isOnline
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                          }`}
                        >
                          {isOnline ? (
                            <>
                              <Zap className="w-3.5 h-3.5 fill-white" />
                              <span>⚡ Omba Safari Naye Sasa (Yupo Hewani)</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Agiza Safari Naye</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Call direct */}
                      <a
                        href={`tel:${drv.phone}`}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Piga Simu Moja kwa Moja"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Piga Simu</span>
                      </a>

                      {/* WhatsApp direct */}
                      <a
                        href={`https://wa.me/${cleanPhone}?text=Habari%20${encodeURIComponent(drv.name)},%20nimepata%20namba%20yako%20kupitia%20PapoRide.%20Je,%20upo%20tayari%20kwa%20safari?`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Tuma Ujumbe WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`p-3.5 border-t flex items-center justify-between text-[11px] text-neutral-400 ${
          theme === 'dark' ? 'border-neutral-800 bg-[#14141e]' : 'border-neutral-100 bg-neutral-50'
        }`}>
          <span>
            {activeChatDriver 
              ? `Ujumbe utatumwa kwa ${activeChatDriver.name}` 
              : `Jumla: ${drivers.length} ${drivers.length === 1 ? 'dereva mpendwa' : 'madereva unaowapenda'}`}
          </span>
          <button
            onClick={activeChatDriver ? () => setActiveChatDriver(null) : onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold hover:opacity-80 transition-opacity"
          >
            {activeChatDriver ? 'Rudi' : 'Funga'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

