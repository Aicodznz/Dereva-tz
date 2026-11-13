import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, Bot, Sparkles, MessageCircle, Share2, 
  CheckCheck, FileText, Smartphone, Car, ShoppingBag, 
  ExternalLink, Copy, Check, ArrowRight, ShieldCheck,
  RefreshCw, Info, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  buildRideReceiptWhatsAppUrl, 
  buildRideRequestWhatsAppUrl, 
  buildProductInquiryWhatsAppUrl, 
  formatPhoneForWhatsApp 
} from '../../utils/whatsappHelper';

interface WhatsAppAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'chat' | 'receipt' | 'order' | 'guide';
  currentRide?: any;
  currentOrder?: any;
}

interface SimulatedMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export default function WhatsAppAIAssistantModal({
  isOpen,
  onClose,
  initialMode = 'chat',
  currentRide,
  currentOrder
}: WhatsAppAIAssistantModalProps) {
  const [tab, setTab] = useState<'chat' | 'receipt' | 'order' | 'guide'>(initialMode);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // WhatsApp Assistant Phone configuration
  const [assistantPhone, setAssistantPhone] = useState('0712345678');
  const [customerPhone, setCustomerPhone] = useState(currentRide?.customerPhone || currentOrder?.customerPhone || '');
  const [driverPhone, setDriverPhone] = useState(currentRide?.driverPhone || '');

  // Dispatch global event when open/close so other floating pills (like Maya AI) hide and never collide
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('whatsapp-ai-modal-open');
      window.dispatchEvent(new CustomEvent('whatsapp_modal_state', { detail: { open: true } }));
    } else {
      document.body.classList.remove('whatsapp-ai-modal-open');
      window.dispatchEvent(new CustomEvent('whatsapp_modal_state', { detail: { open: false } }));
    }
    return () => {
      document.body.classList.remove('whatsapp-ai-modal-open');
      window.dispatchEvent(new CustomEvent('whatsapp_modal_state', { detail: { open: false } }));
    };
  }, [isOpen]);

  // Pre-configured simulation conversation
  const [messages, setMessages] = useState<SimulatedMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: `Habari! 👋 Mimi ni *Papo Hapo WhatsApp AI Assistant*.

Ninaweza kukusaidia:
🚗 *1. Kuomba Usafiri* (Gari, Boda, au Bajaji)
🍔 *2. Kuagiza Chakula & Vyakula vya Mgahawa*
🛍️ *3. Kununua Bidhaa za Duka & Dawa za Pharmacy*
📦 *4. Kutuma Mzigo / Delivery*
🧾 *5. Kupokea Risiti ya Safari au Oda*

Ungependa nikusaidie nini leo? Andika ujumbe wako hapa chini!`,
      time: '12:00'
    }
  ]);

  useEffect(() => {
    if (initialMode) setTab(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, tab]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: SimulatedMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/meta/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: 'user-demo-' + (customerPhone || 'guest'),
          message: text,
          channel: 'whatsapp'
        })
      });

      if (!res.ok) throw new Error("Hitilafu kwenye mawasiliano ya AI");
      const data = await res.json();

      const botReply: SimulatedMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: data.reply || "Asante kwa ujumbe wako. Tunashughulikia ombi lako sasa hivi!",
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botReply]);
    } catch (err: any) {
      console.error("AI Simulate error:", err);
      // Fallback friendly reply
      const botFallback: SimulatedMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: `Nimepokea: "${text}".\n\n✅ Maombi yako yamepokelewa! Unaweza pia kufungua WhatsApp halisi kwa kubofya kitufe cha *"Fungua WhatsApp"* ili kuongea na msaidizi wa simu moja kwa moja.`,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botFallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQuickPrompts = [
    { label: "🚗 Ubungo ➔ Posta (Gari)", query: "Naomba usafiri wa Gari toka Ubungo kwenda Posta" },
    { label: "🛺 Mwenge ➔ Kariakoo (Bajaji)", query: "Je, nauli ya Bajaji toka Mwenge hadi Kariakoo ni ngapi?" },
    { label: "🍔 Chips Kuku (Chakula)", query: "Naomba oda ya Chips Kuku robo na Soda ya baridi" },
    { label: "📦 Sinza ➔ Mikocheni (Kifurushi)", query: "Nahitaji kutuma mzigo wa kifurushi toka Sinza kwenda Mikocheni" }
  ];

  // Ride Receipt sender
  const handleSendRideReceiptToCustomer = () => {
    const ride = currentRide || {
      id: 'PH-' + Math.floor(1000 + Math.random() * 9000),
      pickup: { name: 'Nelson Mandela Road, Mabibo' },
      destination: { name: 'Police Quarters, Mikocheni' },
      fare: 22000,
      customerName: 'Mteja Mpendwa',
      driverName: 'Garitz',
      vehiclePlate: 'TZ T778 ELW',
      vehicleType: 'Gari (Taxi)',
      paymentMethod: 'cash',
      distance: 11.0
    };

    const url = buildRideReceiptWhatsAppUrl(ride, customerPhone, false);
    window.open(url, '_blank');
    toast.success("Risiti ya WhatsApp inafunguliwa kwa Mteja!", { icon: "🧾" });
  };

  const handleSendRideReceiptToDriver = () => {
    const ride = currentRide || {
      id: 'PH-' + Math.floor(1000 + Math.random() * 9000),
      pickup: { name: 'Nelson Mandela Road, Mabibo' },
      destination: { name: 'Police Quarters, Mikocheni' },
      fare: 22000,
      customerName: 'Mteja Mpendwa',
      driverName: 'Garitz',
      vehiclePlate: 'TZ T778 ELW',
      vehicleType: 'Gari (Taxi)',
      paymentMethod: 'cash',
      distance: 11.0
    };

    const url = buildRideReceiptWhatsAppUrl(ride, driverPhone, true);
    window.open(url, '_blank');
    toast.success("Nakala ya risiti inafunguliwa kwa Dereva!", { icon: "🚗" });
  };

  const handleOpenRealWhatsAppRide = () => {
    const url = buildRideRequestWhatsAppUrl(assistantPhone, {
      pickup: currentRide?.pickup?.name || 'Dar es Salaam',
      destination: currentRide?.destination?.name || 'Kariakoo',
      vehicleType: 'Gari'
    });
    window.open(url, '_blank');
  };

  const handleOpenRealWhatsAppShop = () => {
    const url = buildProductInquiryWhatsAppUrl(assistantPhone, 'Chakula / Bidhaa ya Duka', 15000, 'Papo Hapo Shop');
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-start sm:justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="w-full sm:max-w-lg h-full sm:h-[680px] sm:max-h-[92vh] bg-[#121b22] border-0 sm:border border-emerald-500/30 rounded-none sm:rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-white relative"
      >
        {/* Pinned Top WhatsApp Header Bar - Always Visible and Clickable */}
        <div className="bg-[#1f2c34] px-3.5 py-3 sm:px-4 sm:py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 shadow-md z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/brand/whatsapp-badge.png"
                alt="Papo Hapo WhatsApp"
                className="w-10 h-10 rounded-full object-cover shadow-md border border-orange-400/50 bg-white"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#1f2c34] rounded-full"></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-sm sm:text-base tracking-tight truncate text-white">
                  Papo Hapo WhatsApp AI
                </h3>
                <span className="bg-[#00a884]/20 border border-[#00a884]/40 text-[#25d366] text-[8.5px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0">
                  Wajid Edition
                </span>
              </div>
              <p className="text-[10px] text-neutral-300 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-pulse shrink-0" />
                Inapatikana mtandaoni • Saa 24/7
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer shadow-sm border border-white/20"
            title="Funga Dirisha"
            aria-label="Funga"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Switcher - Pinned Row */}
        <div className="grid grid-cols-4 bg-[#111b21] border-b border-white/5 p-1 shrink-0 text-[10px] sm:text-[11px] font-bold">
          <button
            onClick={() => setTab('chat')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'chat' 
                ? 'bg-[#00a884] text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Chat AI</span>
          </button>

          <button
            onClick={() => setTab('receipt')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'receipt' 
                ? 'bg-[#00a884] text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Risiti</span>
          </button>

          <button
            onClick={() => setTab('order')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'order' 
                ? 'bg-[#00a884] text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Agiza</span>
          </button>

          <button
            onClick={() => setTab('guide')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'guide' 
                ? 'bg-[#00a884] text-white shadow-sm' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Mwongozo</span>
          </button>
        </div>

        {/* TAB 1: Chat Feed & Pinned Bottom Input */}
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Scrollable Message List (Single Clean Scrollbar) */}
            <div className="flex-1 min-h-0 overflow-y-auto whatsapp-chat-scroll overscroll-contain px-3.5 py-3 space-y-2.5 bg-[#0b141a]">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                      m.sender === 'user' 
                        ? 'bg-[#005c4b] text-white rounded-br-xs' 
                        : 'bg-[#202c33] text-neutral-100 rounded-bl-xs border border-white/5'
                    }`}
                  >
                    {m.text}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-neutral-400">
                      <span>{m.time}</span>
                      {m.sender === 'user' && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 bg-[#202c33] px-3 py-2 rounded-2xl w-fit text-xs text-emerald-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>WhatsApp AI inaandika jibu...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Sample Chips (Always Visible Above Input) */}
            <div className="bg-[#111b21] px-3 py-1.5 border-t border-white/5 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {sampleQuickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q.query)}
                    className="text-[10px] whitespace-nowrap bg-emerald-950/70 hover:bg-[#00a884]/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full transition-colors cursor-pointer shrink-0"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pinned Input Bar */}
            <div className="p-2.5 bg-[#202c33] border-t border-white/5 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Andika ujumbe kwa WhatsApp AI..."
                className="flex-1 bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none rounded-full px-4 py-2 text-xs text-white placeholder-neutral-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Real WhatsApp Trigger */}
            <div className="px-3 py-2 bg-[#111b21] border-t border-white/5 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-neutral-400 truncate mr-2">Fungua WhatsApp halisi ya simu yako:</span>
              <button
                type="button"
                onClick={handleOpenRealWhatsAppRide}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                Fungua WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Receipt Dispatch */}
        {tab === 'receipt' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-2xl space-y-1">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Risiti ya Safari & Oda Moja kwa Moja WhatsApp
              </h4>
              <p className="text-[11px] text-neutral-300">
                Tuma stakabadhi rasmi ya safari au ya mauzo ya duka moja kwa moja kwa mteja au dereva kwa kubofya kitufe kimoja.
              </p>
            </div>

            {/* Phone inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Mteja (WhatsApp):</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mf. 0712345678"
                  className="w-full bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Dereva (WhatsApp):</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="Mf. 0765432100"
                  className="w-full bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            {/* Ride Card */}
            <div className="bg-[#111c2e] border border-neutral-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-[10.5px] font-black text-emerald-400 uppercase tracking-wider">Muhtasari wa Risiti ya Safari:</span>
                <span className="text-[10px] font-bold text-neutral-400">#PH-7849</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Kuanzia (Pickup):</span>
                  <span className="font-bold text-white text-[11px] truncate block">
                    {currentRide?.pickup?.name || "Nelson Mandela Rd, Mabibo"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Kuelekea (Dest):</span>
                  <span className="font-bold text-white text-[11px] truncate block">
                    {currentRide?.destination?.name || "Police Quarters, Mikocheni"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Dereva / Chombo:</span>
                  <span className="font-bold text-white text-[11px]">
                    {currentRide?.driverName || "Garitz (TZ T778 ELW)"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Nauli Iliyolipwa:</span>
                  <span className="font-black text-emerald-400 text-sm">
                    TZS {(currentRide?.fare || 22000).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Dispatch Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSendRideReceiptToCustomer}
                className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Tuma Risiti kwa Mteja
              </button>

              <button
                type="button"
                onClick={handleSendRideReceiptToDriver}
                className="w-full py-2.5 px-3 bg-[#075E54] hover:bg-[#0a7569] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Tuma Nakala kwa Dereva
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Instant Ride Order */}
        {tab === 'order' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            <div className="bg-[#111c2e] border border-neutral-800 p-3 rounded-2xl space-y-1">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <Car className="w-4 h-4" />
                Omba Safari au Bidhaa Papo kwa Papo WhatsApp
              </h4>
              <p className="text-[11px] text-neutral-300">
                Mteja hahitaji kusakinisha programu; anabofya kiungo na kumwambia msaidizi wa AI moja kwa moja kwenye WhatsApp anapotaka kwenda!
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya WhatsApp ya Ofisi / Msaidizi AI:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={assistantPhone}
                  onChange={(e) => setAssistantPhone(e.target.value)}
                  placeholder="Mf. 0712345678"
                  className="flex-1 bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(formatPhoneForWhatsApp(assistantPhone));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success("Namba imenakiliwa!");
                  }}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Imenakiliwa' : 'Nakili'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleOpenRealWhatsAppRide}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#00A884] to-[#25D366] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-between hover:opacity-95 transition-all active:scale-98 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <span>Omba Usafiri kupitia WhatsApp AI</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleOpenRealWhatsAppShop}
                className="w-full py-3 px-4 bg-[#1a2536] hover:bg-[#223046] border border-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-between transition-all active:scale-98 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Ulizia Bidhaa za Duka & Dawa WhatsApp</span>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Wajid TechTube Setup Guide */}
        {tab === 'guide' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed">
            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                Somo la Wajid Techtube (Chini ya Dk 20)
              </span>
              <h4 className="font-black text-white text-sm">
                Jinsi Mfumo Huu wa WhatsApp AI Unavyofanya Kazi
              </h4>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-[#111c2e] p-2.5 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Webhook ya Meta & WhatsApp Business Cloud API</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Programu yetu ina API rasmi <code className="text-emerald-400">/api/meta/webhook</code> inayounganishwa na namba yako ya WhatsApp kupitia Meta for Developers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-[#111c2e] p-2.5 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Ubongo wa Gemini 3.8 Flash AI</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Mteja anapoandika kwa Kiswahili au Kiingereza, Gemini inatambua anachotaka (nauli ya safari, bidhaa ya duka, au chakula) na kumpa bei sahihi na stakabadhi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-[#111c2e] p-2.5 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  3
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Kupokea Risiti na Oda Masaa 24/7</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Dereva, mteja na tajiri wa duka wanapokea ujumbe na risiti zilizothibitishwa moja kwa moja kwenye namba zao za WhatsApp papo hapo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pinned Bottom Footer Bar */}
        <div className="px-3.5 py-2.5 bg-[#1f2c34] border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-300 shrink-0">
          <div className="flex items-center gap-1.5 truncate mr-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#25d366] shrink-0" />
            <span className="truncate">Papo Hapo AI WhatsApp Bot • Firestore & Gemini</span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg font-bold text-[10px] transition-all shrink-0 cursor-pointer"
          >
            Funga
          </button>
        </div>
      </motion.div>
    </div>
  );
}
