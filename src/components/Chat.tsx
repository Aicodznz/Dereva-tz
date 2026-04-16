import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
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
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  onBack?: () => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}

export default function Chat({ onBack }: ChatProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // For simplicity, we'll use a single global support chat or a user-specific chat
    // In a real app, you'd have conversation IDs
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', user.uid),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        senderId: user.uid,
        senderName: profile?.displayName || 'User',
        participants: [user.uid, 'SUPPORT_ID'], // Support ID for demo
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
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
        {/* Contacts Sidebar (Optional for Desktop) */}
        <div className="hidden lg:flex w-80 bg-white rounded-3xl shadow-sm border border-neutral-100 flex-col overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h3 className="text-xl font-black mb-4">Messages</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input placeholder="Search chats..." className="pl-10 bg-neutral-50 border-none h-11 rounded-xl" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center text-white font-bold">
                PH
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate">Papo Hapo Support</h4>
                <p className="text-xs text-orange-600 font-medium truncate">Online</p>
              </div>
            </div>
            {/* Mock other contacts */}
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-400 font-bold">
                  V{i}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate text-neutral-800">Vendor {i}</h4>
                  <p className="text-xs text-neutral-400 truncate">Last message...</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 border-none shadow-sm rounded-3xl overflow-hidden flex flex-col">
          <CardHeader className="bg-white border-b border-neutral-100 p-4 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                PH
              </div>
              <div>
                <h4 className="font-bold text-sm">Papo Hapo Support</h4>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-600 rounded-xl">
                <Phone className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-600 rounded-xl">
                <Video className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-600 rounded-xl">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50" ref={scrollRef}>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                    isMe 
                      ? 'bg-orange-600 text-white rounded-tr-none' 
                      : 'bg-white text-neutral-800 rounded-tl-none'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] mt-1.5 font-medium opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center text-orange-600 mb-4">
                  <MessageCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-neutral-800">Start a conversation</h3>
                <p className="text-neutral-500 text-sm mt-2 max-w-xs">Our support team is here to help you with any questions or issues.</p>
              </div>
            )}
          </CardContent>

          <div className="p-4 bg-white border-t border-neutral-100 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('chat_placeholder')}
                className="flex-1 bg-neutral-50 border-none h-12 rounded-2xl focus-visible:ring-orange-600"
              />
              <Button 
                type="submit" 
                disabled={!newMessage.trim()}
                className="w-12 h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shrink-0 p-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
