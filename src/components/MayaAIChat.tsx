import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, X, Bot, User as UserIcon, ShieldCheck, 
  Car, Utensils, CreditCard, Package, RefreshCw, 
  MapPin, CheckCircle, AlertTriangle, ChevronRight, PhoneCall,
  Flame, Ambulance, Wallet, HelpCircle, CornerDownLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'user' | 'maya';
  text: string;
  timestamp: Date;
  functionCalls?: Array<{
    name: string;
    args: any;
  }>;
  pendingConfirmation?: {
    type: 'payment' | 'booking' | 'food';
    title: string;
    details: any;
  };
  actionSuccess?: boolean;
}

export default function MayaAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'maya',
      text: 'Habari! Mimi ni MAYA — Akili Mnemba (AI) ya Papo Hapo Super App 🇹🇿.\n\nNinaweza kukusaidia kuitisha Usafiri (Boda, Bajaji, Gari, Ambulansi, au Zimamoto), kuagiza Chakula, au kufanya Malipo salama. Nikupe msaada gani leo?',
      timestamp: new Date()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build history payload for Gemini
      const historyPayload = messages.slice(-8).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const res = await fetch('/api/maya/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userContext: {
            city: 'Dar es Salaam',
            location: 'Mwenge / Posta',
            phone: '+255700000000'
          }
        })
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        throw new Error(data.error || data.reply || 'Hitilafu kwenye mfumo');
      }

      let pendingConf: any = null;

      // Check if function call requires payment/confirmation
      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          if (fc.name === 'confirmPayment') {
            pendingConf = {
              type: 'payment',
              title: 'Thibitisha Muamala wa Malipo',
              details: fc.args
            };
          } else if (fc.name === 'bookTaxi' && (fc.args.vehicle_type === 'ambulance' || fc.args.vehicle_type === 'fire')) {
            pendingConf = {
              type: 'booking',
              title: fc.args.vehicle_type === 'ambulance' ? 'Thibitisha Wito wa Ambulansi (Emergency)' : 'Thibitisha Wito wa Zimamoto (Fire)',
              details: fc.args
            };
          }
        }
      }

      const mayaMsg: Message = {
        id: `maya-${Date.now()}`,
        sender: 'maya',
        text: data.reply || 'Tumepata ombi lako kikamilifu.',
        timestamp: new Date(),
        functionCalls: data.functionCalls,
        pendingConfirmation: pendingConf
      };

      setMessages(prev => [...prev, mayaMsg]);

    } catch (err: any) {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'maya',
          text: err.message || 'Samahani, kumetokea hitilafu kidogo ya muunganisho. Tafadhali jaribu tena au tumia USSD *149*00#.',
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleConfirmAction = async (msgId: string, details: any, confirmed: boolean) => {
    if (!confirmed) {
      toast.info('Muamala/Ombi limeghairiwa.');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingConfirmation: undefined, text: m.text + '\n\n❌ (Ombi limeghairiwa na mtumiaji)' } : m));
      return;
    }

    toast.loading('Inathibitisha na kutekeleza na MAYA...', { id: 'maya-exec' });
    
    setTimeout(() => {
      toast.success('Imethibitishwa kikamilifu! Mfumo umeanza kufanya kazi.', { id: 'maya-exec' });
      setMessages(prev => prev.map(m => m.id === msgId ? { 
        ...m, 
        pendingConfirmation: undefined, 
        actionSuccess: true,
        text: m.text + '\n\n✅ *Muamala/Wito umethibitishwa kikamilifu!*'
      } : m));

      // Trigger actual UI navigation if booking taxi
      if (details.pickup_location || details.destination) {
        navigate('/taxi');
      }
    }, 1200);
  };

  const quickPrompts = [
    { label: '🚖 Boda / Taxi kwenda Kariakoo', prompt: 'Nahitaji usafiri wa Boda kutoka Mwenge kwenda Kariakoo Dar es Salaam' },
    { label: '🚑 Ambulansi ya Dharura', prompt: 'Nahitaji Ambulansi ya dharura haraka sana Posta Dar es Salaam' },
    { label: '🚒 Zimamoto (Fire Truck)', prompt: 'Nahitaji faya/zimamoto ya dharura Mbezi Beach' },
    { label: '🍔 Agiza Chips Kuku', prompt: 'Agiza Chips Kuku kutoka Mlimani City ulete Mwenge' },
    { label: '💰 Angalia Salio la Papo Wallet', prompt: 'Angalia salio langu la Papo Wallet' }
  ];

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 left-6 z-[160] flex items-center gap-2.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 text-white px-4 py-3 rounded-full shadow-[0_12px_30px_rgba(234,88,12,0.45)] border border-white/20 backdrop-blur-md group"
        aria-label="Fungua MAYA AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-9 h-9 bg-black/30 rounded-full flex items-center justify-center border border-white/20">
            <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-orange-600 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-orange-600" />
        </div>

        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-black uppercase tracking-wider leading-none text-white">MAYA AI</div>
          <div className="text-[9px] font-bold text-amber-100 uppercase tracking-widest">Assistant 🇹🇿</div>
        </div>
      </motion.button>

      {/* DRAWER / MODAL CHAT UI */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="w-full sm:max-w-lg h-[90vh] sm:h-[650px] bg-neutral-900 text-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative"
            >
              {/* HEADER */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20 border border-white/20">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base tracking-tight text-white uppercase">MAYA AI</h3>
                      <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                        Papo Hapo 🇹🇿
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-medium">Mtanzania Kidijitali • Kiswahili & English</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MESSAGES BODY */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'maya' && (
                      <div className="w-8 h-8 rounded-xl bg-orange-600/30 border border-orange-500/40 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                      </div>
                    )}

                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-orange-600 text-white rounded-tr-none font-medium'
                        : 'bg-neutral-800/90 border border-white/10 text-neutral-200 rounded-tl-none'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* CONFIRMATION CARD FOR PAYMENTS OR EMERGENCY BOOKINGS */}
                      {msg.pendingConfirmation && (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="mt-4 p-4 rounded-xl bg-neutral-900 border border-amber-500/40 space-y-3"
                        >
                          <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4" />
                            <span>{msg.pendingConfirmation.title}</span>
                          </div>

                          <div className="bg-black/40 p-3 rounded-lg text-xs space-y-1 font-mono text-neutral-300">
                            {msg.pendingConfirmation.details.amount && (
                              <div className="flex justify-between">
                                <span>Kiasi:</span>
                                <span className="text-amber-300 font-bold">TSH {msg.pendingConfirmation.details.amount.toLocaleString()}</span>
                              </div>
                            )}
                            {msg.pendingConfirmation.details.method && (
                              <div className="flex justify-between">
                                <span>Njia:</span>
                                <span className="uppercase text-orange-400">{msg.pendingConfirmation.details.method}</span>
                              </div>
                            )}
                            {msg.pendingConfirmation.details.vehicle_type && (
                              <div className="flex justify-between">
                                <span>Usafiri:</span>
                                <span className="uppercase text-amber-300">{msg.pendingConfirmation.details.vehicle_type}</span>
                              </div>
                            )}
                            {msg.pendingConfirmation.details.pickup_location && (
                              <div className="flex justify-between">
                                <span>Kuanzia:</span>
                                <span className="text-neutral-200">{msg.pendingConfirmation.details.pickup_location}</span>
                              </div>
                            )}
                            {msg.pendingConfirmation.details.destination && (
                              <div className="flex justify-between">
                                <span>Kufika:</span>
                                <span className="text-neutral-200">{msg.pendingConfirmation.details.destination}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation?.details, true)}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-2.5 px-3 rounded-lg text-xs uppercase tracking-wider transition-all"
                            >
                              Thibitisha Sasa
                            </button>
                            <button
                              onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation?.details, false)}
                              className="bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-3 rounded-lg text-xs uppercase transition-all"
                            >
                              Ghairi
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <div className="flex gap-3 justify-start items-center">
                    <div className="w-8 h-8 rounded-xl bg-orange-600/30 border border-orange-500/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
                    </div>
                    <div className="bg-neutral-800 border border-white/10 px-4 py-3 rounded-2xl text-xs text-neutral-400 font-mono flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                      MAYA inafikiria na kuandaa maelezo...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* QUICK PROMPT CHIPS */}
              <div className="px-4 py-2 border-t border-white/5 bg-neutral-900/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="shrink-0 text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* INPUT FORM */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 sm:p-4 bg-neutral-950 border-t border-white/10 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Andika ombi lako kwa MAYA (Kiswahili/English)..."
                  className="flex-1 bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-11 h-11 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-orange-600/30 shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
