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
  }, [messages, isLoading]);

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
    "Naomba usafiri wa Gari toka Ubungo kwenda Posta",
    "Je, nauli ya Bajaji toka Mwenge hadi Kariakoo ni ngapi?",
    "Naomba oda ya Chips Kuku robo na Soda ya baridi",
    "Nahitaji kutuma mzigo wa kifurushi toka Sinza kwenda Mikocheni"
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
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div 
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        className="w-full max-w-lg bg-[#0e1726] border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white"
      >
        {/* Header Bar - WhatsApp Emerald Green */}
        <div className="bg-gradient-to-r from-[#00A884] to-[#075E54] p-3.5 sm:p-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <MessageCircle className="w-5 h-5 fill-white text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                  WhatsApp AI Assistant
                  <span className="bg-amber-400 text-neutral-950 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Wajid Edition</span>
                </h3>
              </div>
              <p className="text-[10px] text-emerald-100 flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                Msaidizi Mahiri wa Safari, Duka & Risiti • Saa 24/7
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-4 bg-[#0a101d] border-b border-emerald-950/60 p-1 shrink-0 text-[10.5px] font-bold">
          <button
            onClick={() => setTab('chat')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${
              tab === 'chat' 
                ? 'bg-[#00A884] text-white shadow-md' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Chat AI</span>
          </button>

          <button
            onClick={() => setTab('receipt')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${
              tab === 'receipt' 
                ? 'bg-[#00A884] text-white shadow-md' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Tuma Risiti</span>
          </button>

          <button
            onClick={() => setTab('order')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${
              tab === 'order' 
                ? 'bg-[#00A884] text-white shadow-md' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Agiza Safari</span>
          </button>

          <button
            onClick={() => setTab('guide')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${
              tab === 'guide' 
                ? 'bg-[#00A884] text-white shadow-md' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Mwongozo</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-[340px]">
          {/* TAB 1: Real-time Live WhatsApp Simulation Chat */}
          {tab === 'chat' && (
            <div className="flex flex-col h-full space-y-3">
              {/* WhatsApp Chat Background Wallpaper */}
              <div className="flex-1 bg-[#0b141a] rounded-2xl p-3 overflow-y-auto space-y-2.5 max-h-[300px] border border-neutral-800/80 shadow-inner">
                {messages.map((m) => (
                  <div 
                    key={m.id} 
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                        m.sender === 'user' 
                          ? 'bg-[#005c4b] text-white rounded-br-xs' 
                          : 'bg-[#202c33] text-neutral-100 rounded-bl-xs border border-white/5'
                      }`}
                    >
                      {m.text}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-neutral-400">
                        <span>{m.time}</span>
                        {m.sender === 'user' && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
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

              {/* Quick Sample Prompts */}
              <div className="space-y-1">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Mifano ya Maswali ya Haraka:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sampleQuickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-[10px] bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg text-left transition-colors"
                    >
                      👉 {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Andika ujumbe kwa WhatsApp AI..."
                  className="flex-1 bg-[#1a2536] border border-neutral-700/80 focus:border-[#00A884] outline-none rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="w-10 h-10 rounded-xl bg-[#00A884] hover:bg-[#008f6f] disabled:opacity-50 text-white flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Direct Open WhatsApp button */}
              <div className="pt-1 flex items-center justify-between border-t border-neutral-800/80">
                <span className="text-[10px] text-neutral-400">Unataka kufungua WhatsApp halisi ya simu yako?</span>
                <button
                  onClick={handleOpenRealWhatsAppRide}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-[10.5px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                >
                  <ExternalLink className="w-3 h-3" />
                  Fungua WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Send WhatsApp Ride & Order Receipts */}
          {tab === 'receipt' && (
            <div className="space-y-3.5">
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
                    placeholder="Mf. 0712345678 au +255..."
                    className="w-full bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Dereva (WhatsApp):</label>
                  <input
                    type="text"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="Mf. 0765432100 au +255..."
                    className="w-full bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                  />
                </div>
              </div>

              {/* Sample Ride Info Card */}
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
                  onClick={handleSendRideReceiptToCustomer}
                  className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                  Tuma Risiti kwa Mteja
                </button>

                <button
                  onClick={handleSendRideReceiptToDriver}
                  className="w-full py-2.5 px-3 bg-[#075E54] hover:bg-[#0a7569] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4" />
                  Tuma Nakala kwa Dereva
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Instant Ride Order via WhatsApp */}
          {tab === 'order' && (
            <div className="space-y-3.5">
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
                    onClick={() => {
                      navigator.clipboard.writeText(formatPhoneForWhatsApp(assistantPhone));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Namba imenakiliwa!");
                    }}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Imenakiliwa' : 'Nakili'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleOpenRealWhatsAppRide}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#00A884] to-[#25D366] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-between hover:opacity-95 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    <span>Omba Usafiri kupitia WhatsApp AI</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleOpenRealWhatsAppShop}
                  className="w-full py-3 px-4 bg-[#1a2536] hover:bg-[#223046] border border-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-between transition-all active:scale-98"
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

          {/* TAB 4: Wajid TechTube Setup Guide (20 Mins) */}
          {tab === 'guide' && (
            <div className="space-y-3 text-xs leading-relaxed">
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
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-[#0a101d] border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Papo Hapo AI WhatsApp Bot • Imeunganishwa na Firestore & Gemini</span>
          </div>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold text-[10px] transition-colors"
          >
            Funga
          </button>
        </div>
      </motion.div>
    </div>
  );
}
