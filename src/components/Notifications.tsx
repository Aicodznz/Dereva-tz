import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, CheckCircle2, ShoppingBag, Tag, Star, 
  Clock, ChevronRight, Settings, Check, Trash2,
  AlertCircle, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'promotion' | 'system' | 'review';
  isRead: boolean;
  createdAt: any;
  actionUrl?: string;
}

type NotifTab = 'all' | 'activity' | 'offers';

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications/batch');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'activity') return n.type === 'order' || n.type === 'system';
    if (activeTab === 'offers') return n.type === 'promotion';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-5 h-5" />;
      case 'promotion': return <Tag className="w-5 h-5" />;
      case 'review': return <Star className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'order': return 'bg-blue-100 text-blue-600';
      case 'promotion': return 'bg-orange-100 text-orange-600';
      case 'review': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-500 font-medium">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 text-orange-600 rounded-2xl">
            <Bell className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">{t('notifications') || 'Notifications'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-neutral-500 hover:text-orange-600"
            onClick={markAllAsRead}
            title="Mark all as read"
          >
            <CheckCircle2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl text-neutral-500 hover:text-orange-600">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl">
        {[
          { id: 'all', label: 'Zote' },
          { id: 'activity', label: 'Shughuli' },
          { id: 'offers', label: 'Ofa & Taarifa' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as NotifTab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-orange-600 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => markAsRead(notif.id)}
              className={`relative p-4 rounded-3xl border transition-all cursor-pointer group ${
                notif.isRead 
                  ? 'bg-white border-neutral-100' 
                  : 'bg-orange-50/50 border-orange-100 shadow-sm'
              }`}
            >
              <div className="flex gap-4">
                {/* Unread Dot */}
                {!notif.isRead && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-orange-600 rounded-full" />
                )}

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${getIconBg(notif.type)}`}>
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-bold truncate ${notif.isRead ? 'text-neutral-900' : 'text-orange-900'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] text-neutral-400 whitespace-nowrap mt-1">
                      {notif.createdAt?.seconds ? format(new Date(notif.createdAt.seconds * 1000), 'HH:mm') : 'Just now'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                    {notif.body}
                  </p>
                  
                  {notif.actionUrl && (
                    <Link 
                      to={notif.actionUrl}
                      className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold text-orange-600 hover:underline"
                    >
                      View Details <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredNotifications.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-200">
              <Bell className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-neutral-900">Huna taarifa zozote hapa</h3>
              <p className="text-sm text-neutral-400">Tutaarifu pindi kitu kipya kitakapotokea.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
