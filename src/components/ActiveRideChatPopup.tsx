import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Check, CheckCheck } from 'lucide-react';

interface ActiveRideChatPopupProps {
  rideId: string;
  user: any;
  recipientId: string;
  recipientName: string;
  recipientPhoto?: string;
  isDriver?: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  createdAt: any;
}

export default function ActiveRideChatPopup({
  rideId,
  user,
  recipientId,
  recipientName,
  recipientPhoto,
  isDriver = false,
}: ActiveRideChatPopupProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  
  const lastViewedMessageId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive stable chatId
  const chatId = useMemo(() => {
    if (!user?.uid || !recipientId) return '';
    return [user.uid, recipientId].sort().join('_');
  }, [user?.uid, recipientId]);

  // Pre-configured Swahili quick replies
  const quickReplies = isDriver
    ? ["Nimeshafika pickup", "Nimekaribia hapo", "Sawa, nakufikia sasa", "Subiri kidogo tafadhali", "Niko njiani"]
    : ["Niko hapa tayari", "Nakuja sasa hivi", "Unakaribia?", "Sawa, nakuona", "Nitachelewa kidogo"];

  // Real-time Firestore subscription to chat messages
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ChatMessage[];

        // Sort messages chronologically by timestamp
        msgs.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tA - tB;
        });

        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          
          // Check if this is a new message from the other person
          const isNew = latestMessage?.id !== lastMsg.id;
          const isFromOther = lastMsg.senderId !== user?.uid;

          if (isNew) {
            setLatestMessage(lastMsg);

            if (isFromOther) {
              if (!isExpanded) {
                setUnreadCount((prev) => prev + 1);
                // Trigger the audio-visual toast speech bubble
                setShowToast(true);
                // Play subtle notification touch context
                try {
                  if ('vibrate' in navigator) navigator.vibrate([100]);
                } catch (e) {}
              }
            }
          }
        }

        setMessages(msgs);
      },
      (error) => {
        console.error("Firestore active chat error:", error);
      }
    );

    return () => unsubscribe();
  }, [chatId, user?.uid, isExpanded]);

  // Auto-dismiss the new message notification bubble after 6 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showToast, latestMessage?.id]);

  // Handle auto-scroll to bottom of messages container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (isExpanded && messages.length > 0) {
      setUnreadCount(0);
      setShowToast(false);
      lastViewedMessageId.current = messages[messages.length - 1].id;
    }
  }, [messages, isExpanded]);

  // Send a text message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user || !chatId || !recipientId) return;

    try {
      const msgData = {
        chatId,
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || (isDriver ? "Dereva" : "Mteja"),
        senderPhoto: user.photoURL || '',
        participants: [user.uid, recipientId].sort(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'messages'), msgData);
    } catch (error) {
      console.error("Error sending popup chat message:", error);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
    setInputText('');
  };

  if (!chatId) return null;

  return (
    <div className="absolute bottom-4 right-4 z-[300] flex flex-col items-end pointer-events-auto">
      {/* 1. Speech Bubble Overlay/Toast (Screenshot style) */}
      <AnimatePresence>
        {showToast && latestMessage && !isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => {
              setIsExpanded(true);
              setShowToast(false);
            }}
            className="mb-3 max-w-[280px] bg-white border border-neutral-100 rounded-2xl p-3 pr-14 shadow-xl flex items-start gap-2.5 cursor-pointer relative hover:shadow-2xl hover:scale-[1.02] active:scale-98 transition-all group"
          >
            {/* Visual Speech Bubble Indicator arrow */}
            <div className="absolute right-6 -bottom-2 w-4 h-4 bg-white border-r border-b border-neutral-100 rotate-45"></div>

            <div className="flex-1 min-w-0">
              <span className="block text-[11px] font-black text-neutral-900 tracking-wide uppercase leading-none mb-1">
                {isDriver ? "Mteja" : "Dereva"}:
              </span>
              <p className="text-xs font-medium text-neutral-700 line-clamp-2 leading-relaxed">
                {latestMessage.text}
              </p>
            </div>

            {/* Avatar on the right */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full overflow-hidden border-2 border-[#1070ff] bg-neutral-100 shadow-sm flex-shrink-0">
              <img
                src={recipientPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${recipientId}`}
                alt="Avatar"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Expanded Chat Bubble Box */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 45, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 260 }}
            className="w-[calc(100vw-32px)] sm:w-[350px] h-[400px] bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-3"
          >
            {/* Chat Box Header */}
            <div className="p-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-neutral-800 border border-white/10">
                    <img
                      src={recipientPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${recipientId}`}
                      alt={recipientName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#00E5A0] border-2 border-[#0a0a0f] rounded-full"></div>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white italic tracking-wide uppercase">
                    {recipientName || (isDriver ? "Mteja" : "Dereva")}
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-bold tracking-wide uppercase leading-none mt-0.5">
                    Mawasiliano ya Safari
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages Scrolling Container */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none opacity-60">
                  <span className="text-xl mb-1">💬</span>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
                    Tuma ujumbe sasa...
                  </p>
                  <p className="text-[10px] text-neutral-500 leading-normal mt-1">
                    Ujumbe hapa huhifadhiwa salama kwa mawasiliano ya safari hii pekee
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#1070ff] text-white rounded-tr-sm font-medium'
                            : 'bg-neutral-800 text-white rounded-tl-sm border border-white/5 font-medium'
                        }`}
                      >
                        <p className="whitespace-pre-wrap breakdown-words">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[8.5px] opacity-60">
                          <span>
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })
                              : ''}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3 text-white/80" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Swahili Quick Reply Chips */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01]">
              <div className="flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto no-scrollbar py-0.5">
                {quickReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(reply)}
                    className="text-[10px] font-bold text-[#1070ff] hover:text-white bg-[#1070ff]/10 hover:bg-[#1070ff] px-2.5 py-1.5 rounded-xl transition-all whitespace-nowrap uppercase tracking-wider"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar Form */}
            <form
              onSubmit={handleFormSubmit}
              className="p-3 bg-white/[0.03] border-t border-white/5 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Andika ujumbe hapa..."
                className="flex-1 bg-white/5 border border-white/5 hover:border-white/10 focus:border-[#1070ff] outline-none text-xs text-white placeholder-neutral-500 rounded-xl px-3 py-2.5 transition-all text-left"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  inputText.trim()
                    ? 'bg-[#1070ff] text-white hover:scale-105 active:scale-95'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Circle Action Badge Button (The trigger) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative w-12 h-12 bg-gradient-to-tr from-[#1070ff] to-[#4fa1ff] rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-300 z-[310] ${
          isExpanded ? 'rotate-90' : ''
        }`}
      >
        {isExpanded ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5 stroke-[2.5]" />}

        {/* Floating pulse notification highlight on unread count */}
        {unreadCount > 0 && !isExpanded && (
          <>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ef4444] text-[10px] font-black text-white flex items-center justify-center rounded-full animate-bounce shadow-md">
              {unreadCount}
            </span>
            <div className="absolute -inset-0 rounded-full border-2 border-[#ef4444] animate-ping opacity-60"></div>
          </>
        )}
      </button>
    </div>
  );
}
