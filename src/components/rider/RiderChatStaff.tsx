import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, CheckCheck, Circle, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface Message {
  id: string;
  sender: 'staff' | 'driver';
  text: string;
  timestamp: string;
}

export default function RiderChatStaff({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      sender: 'staff',
      text: `Mambo, habari gani! Mimi ni Neema kutoka huduma kwa wateja ya Papo Hapo Tanzania 🇹🇿. Je, ninaweza kukusaidia nini leo kuhusu akaunti au safari zako?`,
      timestamp: 'Sasa hivi'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsgText = input;
    const timestamp = new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'driver',
      text: userMsgText,
      timestamp
    };

    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    // Dynamic smart responses in Swahili
    setTimeout(() => {
      let replyText = "Nashukuru kwa maelezo yako. Nimepokea ujumbe wako na ninaufanyia kazi sasa hivi. Tafadhali nipe dakika chache.";
      const cleanInput = userMsgText.toLowerCase();

      if (cleanInput.includes('leseni') || cleanInput.includes('document') || cleanInput.includes('picha')) {
        replyText = "Kuhusu masuala ya leseni au nyaraka, tafadhali hakikisha picha uliyotuma inaonyesha herufi zote vizuri bila mwanga mkali wa jua. Idara ya usajili inakagua nyaraka ndani ya masaa 2 tangu kutumwa kwake.";
      } else if (cleanInput.includes('malipo') || cleanInput.includes('pesa') || cleanInput.includes('wallet') || cleanInput.includes('m-pesa') || cleanInput.includes('tigo')) {
        replyText = "Kuhusu malipo na kutoa salio (Withdraw), mifumo yetu imewanishwa na M-Pesa na Tigo Pesa moja kwa moja. Pesa inachukua kati ya sekunde 30 hadi dakika 5 kufika kwenye simu yako pindi unapoomba kuitoa.";
      } else if (cleanInput.includes('safari') || cleanInput.includes('mteja') || cleanInput.includes('abiria')) {
        replyText = "Kama una changamoto na safari inayoendelea au mteja fulani, tafadhali kumbuka kurekodi namba ya safari na utuambie hapa ili tukusaidie haraka. Usalama wako ndio kipaumbele chetu!";
      } else if (cleanInput.includes('mambo') || cleanInput.includes('habari') || cleanInput.includes('hello') || cleanInput.includes('mambo vipi')) {
        replyText = "Habari nzuri sana! Niambie, una tatizo lolote au ungependa kupata ufafanuzi wa huduma gani ya Papo Hapo leo?";
      }

      const staffReply: Message = {
        id: `msg-reply-${Date.now()}`,
        sender: 'staff',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, staffReply]);
      setIsTyping(false);
    }, 1800);
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950 relative h-screen max-w-2xl mx-auto">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 bg-white dark:bg-neutral-900 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 font-black">
                N
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-neutral-800 dark:text-neutral-100">Neema (Papo Support)</span>
                <span className="text-[7px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded uppercase leading-none">WAFANYAKAZI</span>
              </div>
              <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider">Inapatikana • Mtandaoni</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 pb-36">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-neutral-700 dark:text-neutral-300">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed">
            Mawasiliano yote na wafanyakazi wa Papo Hapo yanalindwa na kurekodiwa kwa ajili ya kuboresha ubora na usalama wa huduma.
          </p>
        </div>

        {messages.map((m) => {
          const isStaff = m.sender === 'staff';
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[80%] rounded-[1.8rem] p-5 space-y-1.5 shadow-sm ${
                isStaff 
                  ? 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 rounded-tl-sm border border-neutral-100 dark:border-neutral-800' 
                  : 'bg-emerald-600 text-white rounded-tr-sm'
              }`}>
                <p className="text-xs leading-relaxed font-bold">{m.text}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`text-[8px] font-black ${isStaff ? 'text-neutral-400' : 'text-emerald-200'}`}>
                    {m.timestamp}
                  </span>
                  {!isStaff && <CheckCheck className="w-3 h-3 text-emerald-200 stroke-[3]" />}
                </div>
              </div>
            </motion.div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-neutral-900 text-neutral-400 rounded-[1.5rem] rounded-tl-sm p-4 border border-neutral-100 dark:border-neutral-800 flex items-center gap-1 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                Neema anaandika...
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Footer input form */}
      <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-900 absolute bottom-0 left-0 right-0 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Andika ujumbe wako hapa..."
            className="flex-1 h-14 px-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
          />
          <button
            type="submit"
            className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/15 active:scale-90 transition-all shrink-0"
          >
            <Send className="w-5 h-5 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
}
