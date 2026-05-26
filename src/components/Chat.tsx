import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, doc, getDoc, updateDoc, limit, serverTimestamp, arrayUnion, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  Send, 
  User, 
  MessageCircle,
  Phone,
  Video,
  MoreVertical,
  Search,
  Reply as ReplyIcon,
  Smile,
  Heart,
  ThumbsUp,
  CornerUpLeft,
  X,
  Plus,
  MessageSquare,
  Trash2,
  Ban,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

import { useSearchParams } from 'react-router-dom';

interface ChatProps {
  onBack?: () => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  participants: string[];
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reactions?: Record<string, string[]>; // emoji -> userIds
  deletedBy?: string[];
  createdAt: any;
}

interface ChatSession {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  participantProfiles?: Record<string, { name: string; photo: string; role: string }>;
  unreadCount?: Record<string, number>;
}

export default function Chat({ onBack }: ChatProps) {
  const { user, profile, signInGuest } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeRecipientId = searchParams.get('to');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(activeRecipientId);
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message|null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const emojis = ['❤️', '👍', '😂', '😮', '🙏', '🔥'];

  const chatId = (user && recipientId) ? [user.uid, recipientId].sort().join('_') : null;

  const visibleMessages = messages.filter(msg => !msg.deletedBy?.includes(user?.uid || ''));

  const isBlockedByMe = (profile as any)?.blockedUsers?.includes(recipientId || '') || false;
  const amIBlocked = recipientProfile?.blockedUsers?.includes(user?.uid || '') || false;

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        deletedBy: arrayUnion(user.uid)
      });
      toast.success("Meseji imefutwa.");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Imeshindwa kufuta meseji.");
    }
  };

  const handleDeleteFullChat = async () => {
    if (!user || !chatId) return;
    const confirmDelete = window.confirm("Je, una uhakika unataka kufuta mazungumzo haya yote upande wako?");
    if (!confirmDelete) return;

    try {
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId)
      );
      const snap = await getDocs(q);
      const msgPromises = snap.docs.map((mDoc) => {
        const deletedByList = mDoc.data().deletedBy || [];
        if (!deletedByList.includes(user.uid)) {
          return updateDoc(mDoc.ref, {
            deletedBy: arrayUnion(user.uid)
          });
        }
        return Promise.resolve();
      });
      await Promise.all(msgPromises);
      toast.success("Mazungumzo yote yamefutwa yaliyo upande wako.");
      setRecipientId(null);
      setSearchParams({});
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Imeshindwa kufuta mazungumzo yote.");
    }
  };

  const handleToggleBlock = async () => {
    if (!user || !recipientId) return;
    const currentlyBlocked = (profile as any)?.blockedUsers || [];
    let updated;
    if (isBlockedByMe) {
      updated = currentlyBlocked.filter((id: string) => id !== recipientId);
      toast.success("Umemfungulia block mtumiaji huyu.");
    } else {
      const confirmBlock = window.confirm("Je, una uhakika unataka kumzuia (Block) mtumiaji huyu? Hatoweza kukutumia meseji tena.");
      if (!confirmBlock) return;
      updated = [...currentlyBlocked, recipientId];
      toast.success("Umemgomea (Blocked) mtumiaji huyu!");
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: updated
      });
      // Sync locally
      if (profile) {
        (profile as any).blockedUsers = updated;
      }
    } catch (error) {
      console.error("Error updating block status:", error);
      toast.error("Imeshindwa kusasisha block.");
    }
  };

  // Handle Guest Sign In
  useEffect(() => {
    if (!user && !loading) {
      signInGuest().catch(err => console.error("Guest sign in failed", err));
    }
  }, [user, loading]);

  // Load Sessions (For Vendors/Support)
  useEffect(() => {
    if (!user) return;
    
    const fetchSessions = async () => {
      const q = query(
        collection(db, 'messages'),
        where('participants', 'array-contains', user.uid),
        limit(200)
      );
      const snap = await getDocs(q);
      const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort client-side
      messages.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      const sessionsMap = new Map<string, ChatSession>();
      messages.forEach(m => {
        if (!m.chatId || sessionsMap.has(m.chatId)) return;
        
        // Skip messages deleted/hidden by this user
        if (m.deletedBy && m.deletedBy.includes(user.uid)) return;
        
        const otherParticipantId = m.participants.find((id: string) => id !== user.uid);
        sessionsMap.set(m.chatId, {
          id: m.chatId,
          participants: m.participants,
          lastMessage: m.text,
          lastMessageTime: m.createdAt,
        });
      });
      
      setSessions(Array.from(sessionsMap.values()));
    };

    fetchSessions();

    const unsub = onSnapshot(
      query(collection(db, 'messages'), where('participants', 'array-contains', user.uid)),
      () => fetchSessions()
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (activeRecipientId) {
      setRecipientId(activeRecipientId);
    }
  }, [activeRecipientId]);

  useEffect(() => {
    if (!recipientId) return;
    
    const fetchRecipient = async () => {
      // Fetch recipient's user document to check blockedUsers list
      let blockedUsers: string[] = [];
      try {
        const uSnap = await getDoc(doc(db, 'users', recipientId));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          blockedUsers = uData.blockedUsers || [];
        }
      } catch (err) {
        console.error("Error fetching recipient user doc:", err);
      }

      // 1. Check if recipientId is a Vendor
      const vendorsRef = collection(db, 'vendors');
      const q2 = query(vendorsRef, where('ownerUid', '==', recipientId));
      
      const [snap1, snap2] = await Promise.all([
        getDoc(doc(db, 'vendors', recipientId)),
        getDocs(q2)
      ]);

      if (snap1.exists()) {
        const vData = snap1.data();
        setRecipientProfile({ name: vData.businessName, photo: vData.logoUrl, role: 'vendor', blockedUsers });
        return;
      }
      
      if (!snap2.empty) {
        const vData = snap2.docs[0].data();
        setRecipientProfile({ name: vData.businessName, photo: vData.logoUrl, role: 'vendor', blockedUsers });
        return;
      }

      // 2. Check if recipientId is a User
      const uSnap = await getDoc(doc(db, 'users', recipientId));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        setRecipientProfile({ name: uData.displayName, photo: uData.photoURL, role: uData.role, blockedUsers });
      }
    };
    fetchRecipient();
  }, [recipientId]);

  useEffect(() => {
    if (!user || !chatId) return;

    const fetchMessages = async () => {
      const q = query(
        collection(db, 'messages'),
        where('chatId', '==', chatId),
        limit(100)
      );
      const snap = await getDocs(q);
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Sort client-side asc
      msgs.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateA.getTime() - dateB.getTime();
      });
      
      setMessages(msgs);
      setLoading(false);
    };

    fetchMessages();

    const unsub = onSnapshot(
      query(collection(db, 'messages'), where('chatId', '==', chatId)),
      () => fetchMessages()
    );

    return () => unsub();
  }, [user?.uid, chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId || !recipientId) return;

    try {
      const msgData: any = {
        chatId: chatId,
        text: newMessage,
        senderId: user.uid,
        senderName: profile?.displayName || 'User',
        senderPhoto: profile?.photoURL || '',
        participants: [user.uid, recipientId].sort(),
        createdAt: new Date().toISOString(),
      };

      if (replyingTo) {
        msgData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName
        };
      }

      await addDoc(collection(db, 'messages'), msgData);
      
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];
    
    let newUsers;
    if (users.includes(user.uid)) {
      newUsers = users.filter(id => id !== user.uid);
    } else {
      newUsers = [...users, user.uid];
    }

    const newReactions = { ...currentReactions, [emoji]: newUsers };
    if (newUsers.length === 0) delete newReactions[emoji];

    try {
      await updateDoc(doc(db, 'messages', messageId), { reactions: newReactions });
      setShowEmojiPicker(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      {onBack && (
        <div className="flex items-center justify-between shrink-0">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-orange-600 font-bold hover:underline"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('back_to_home')}
          </button>
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Contacts Sidebar (Responsive list) */}
        <div className={`w-full lg:w-80 bg-white rounded-3xl shadow-sm border border-neutral-100 flex-col overflow-hidden ${recipientId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-6 border-b border-neutral-100">
            <h3 className="text-xl font-black mb-4">Messages</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input placeholder="Search chats..." className="pl-10 bg-neutral-50 border-none h-11 rounded-xl" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {sessions.map(session => {
              const otherId = session.participants.find(id => id !== user?.uid);
              const isActive = recipientId === otherId;
              return (
                <div 
                  key={session.id} 
                  onClick={() => setSearchParams({ to: otherId! })}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group ${isActive ? 'bg-orange-50 border border-orange-100' : 'hover:bg-neutral-50 border border-transparent'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm transition-all ${isActive ? 'bg-orange-600 scale-105 shadow-orange-600/20' : 'bg-neutral-200 text-neutral-400 group-hover:bg-neutral-300'}`}>
                    {otherId?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-sm truncate ${isActive ? 'text-orange-600' : 'text-neutral-800'}`}>{otherId === 'SUPPORT_ID' ? 'Papo Hapo Support' : `Chat with ${otherId?.substring(0, 5)}...`}</h4>
                    <p className={`text-xs truncate ${isActive ? 'text-orange-500/80 font-medium' : 'text-neutral-400'}`}>
                      {session.lastMessage}
                    </p>
                  </div>
                  <div className="text-[10px] text-neutral-300 font-medium">
                    {session.lastMessageTime ? new Date(session.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="py-20 text-center px-6">
                <MessageCircle className="w-10 h-10 text-neutral-200 mx-auto mb-2" />
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest leading-relaxed">Hakuna mazungumzo bado</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {recipientId ? (
          <Card className="flex-1 border-none shadow-sm rounded-3xl overflow-hidden flex flex-col relative animate-in fade-in duration-200">
            <CardHeader className="bg-white border-b border-neutral-100 p-4 flex flex-row items-center justify-between shrink-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-600/10">
                  {recipientProfile?.photo ? (
                    <img src={recipientProfile.photo} alt={recipientProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    recipientProfile?.name?.charAt(0) || '?'
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{recipientProfile?.name || 'Loading...'}</h4>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Mubashara</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-600 rounded-xl">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex text-neutral-400 hover:text-orange-600 rounded-xl">
                  <Video className="w-4 h-4" />
                </Button>
                
                {/* Options Menu */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-neutral-400 hover:text-orange-600 rounded-xl"
                    onClick={() => setShowChatOptions(!showChatOptions)}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                  {showChatOptions && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 p-2 z-[999] text-sm animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => {
                          handleDeleteFullChat();
                          setShowChatOptions(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-red-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl font-bold flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Futa Mazungumzo
                      </button>
                      <button
                        onClick={() => {
                          handleToggleBlock();
                          setShowChatOptions(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl font-bold flex items-center gap-2 ${
                          isBlockedByMe 
                            ? 'text-emerald-500 hover:bg-neutral-50 dark:hover:bg-neutral-800' 
                            : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <Ban className="w-4 h-4" />
                        {isBlockedByMe ? 'Mfungulie Block (Unblock)' : 'Mzuie Kuniandikia (Block)'}
                      </button>
                    </div>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-neutral-400 hover:text-orange-600 rounded-xl" 
                  onClick={() => {
                    setRecipientId(null);
                    setSearchParams({});
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/50 no-scrollbar relative" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {visibleMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                    >
                      {/* Sender Name (Only if not me) */}
                      {!isMe && (
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">{msg.senderName}</span>
                      )}

                      <div className="relative max-w-[85%] sm:max-w-[75%]">
                        {/* Reply Indicator in Bubble */}
                        {msg.replyTo && (
                          <div className={`mb-1 p-2 rounded-xl text-[10px] border-l-4 ${isMe ? 'bg-orange-700/50 border-orange-300 text-orange-50' : 'bg-neutral-100 border-neutral-300 text-neutral-500'}`}>
                            <span className="font-bold block mb-0.5 opacity-70">@{msg.replyTo.senderName}</span>
                            <span className="line-clamp-1 italic">{msg.replyTo.text}</span>
                          </div>
                        )}

                        <div className={`relative p-4 rounded-[2rem] shadow-sm transition-all group-hover:shadow-md ${
                          isMe 
                            ? 'bg-orange-600 text-white rounded-tr-none' 
                            : 'bg-white border border-neutral-100 text-neutral-800 rounded-tl-none'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          
                          {/* Message Actions (Invisible by default on desktop, partially visible on touch for convenience) */}
                          <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1.5 h-full`}>
                            <button 
                              onClick={() => setReplyingTo(msg)}
                              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-neutral-400 hover:text-orange-600 transition-all hover:scale-110"
                              title="Reply"
                            >
                              <ReplyIcon className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-neutral-400 hover:text-orange-600 transition-all hover:scale-110"
                              title="React"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-all hover:scale-110"
                              title="Futa Meseji"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Emoji Picker Overlay */}
                          <AnimatePresence>
                            {showEmojiPicker === msg.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} bg-white rounded-2xl shadow-xl border border-neutral-100 p-2 flex gap-1 z-[60]`}
                              >
                                {emojis.map(e => (
                                  <button 
                                    key={e} 
                                    onClick={() => handleReaction(msg.id, e)}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-neutral-50 rounded-xl transition-all hover:scale-120 text-lg"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Reactions Display */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([emoji, uids]) => (
                              <button 
                                key={emoji} 
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-all ${
                                  uids.includes(user?.uid || '') 
                                    ? 'bg-orange-100 border-orange-200 text-orange-600 shadow-sm' 
                                    : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{uids.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-tighter opacity-40 block ${isMe ? 'text-right' : 'text-left'}`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sasa hivi'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {visibleMessages.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-50">
                  <div className="w-20 h-20 bg-orange-100 rounded-[2rem] flex items-center justify-center text-orange-600 mb-6 animate-bounce">
                    <MessageCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-neutral-800 uppercase tracking-tighter">Anza Mazungumzo</h3>
                  <p className="text-neutral-500 text-xs mt-2 max-w-[200px] leading-relaxed font-bold uppercase tracking-widest">Timu yetu ipo hapa kukusaidia kwa lolote.</p>
                </div>
              )}
            </CardContent>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-neutral-100 shrink-0 z-30">
              <AnimatePresence>
                {replyingTo && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-3 bg-neutral-50 rounded-2xl p-3 flex items-center gap-3 border-l-4 border-orange-600 overflow-hidden"
                  >
                    <CornerUpLeft className="w-4 h-4 text-orange-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-0.5">Kujibu kwa {replyingTo.senderName}</p>
                      <p className="text-xs text-neutral-500 truncate italic">{replyingTo.text}</p>
                    </div>
                    <button 
                      onClick={() => setReplyingTo(null)}
                      className="p-1 hover:bg-neutral-200 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-neutral-400" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {isBlockedByMe ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider text-center rounded-2xl border border-red-100 dark:border-red-900/30">
                  Umemuweka block mtumiaji huyu. Mfungulie ili kuendelea kuwasiliana.
                </div>
              ) : amIBlocked ? (
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/20 text-neutral-500 text-xs font-bold uppercase tracking-wider text-center rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  Huwezi chat na mtu huyu kwa sasa (Umezuiliwa).
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                  <div className="flex-1 bg-neutral-50 rounded-[1.5rem] p-2 flex items-center gap-2 border border-transparent focus-within:border-orange-200 transition-all">
                    <button type="button" className="p-2 text-neutral-400 hover:text-orange-600 transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                    <textarea 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                        }
                      }}
                      placeholder={t('chat_placeholder')}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1 max-h-32 min-h-[44px] resize-none no-scrollbar font-medium"
                      rows={1}
                    />
                    <button type="button" className="p-2 text-neutral-400 hover:text-orange-600 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shrink-0 p-0 shadow-lg shadow-orange-600/20 active:scale-90 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
              )}
            </div>
          </Card>
        ) : (
          <div className="hidden lg:flex flex-1 bg-neutral-50/50 rounded-3xl flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-neutral-200">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-orange-600 mb-6">
              <MessageSquare className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-neutral-900 tracking-tight">Karibu Kwenye Chat</h3>
            <p className="text-neutral-500 text-sm mt-3 max-w-sm font-medium uppercase tracking-widest leading-relaxed">Chagua mazungumzo upande wa kushoto au anza mapya kutoka kwa duka lolote.</p>
          </div>
        )}
      </div>
    </div>
  );
}
