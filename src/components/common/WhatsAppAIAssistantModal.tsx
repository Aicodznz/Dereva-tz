import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X, Send, Bot, Share2,
  CheckCheck, FileText, Car, ShoppingBag,
  ExternalLink, Copy, Check, ArrowRight, ShieldCheck,
  RefreshCw, Info, Wallet, CreditCard, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buildRideReceiptWhatsAppUrl,
  buildRideRequestWhatsAppUrl,
  buildProductInquiryWhatsAppUrl,
  formatPhoneForWhatsApp,
} from '../../utils/whatsappHelper';
import { WhatsAppInteractiveMessageView } from './WhatsAppInteractiveSheet';

interface WhatsAppAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'chat' | 'papopay' | 'receipt' | 'order' | 'guide';
  currentRide?: any;
  currentOrder?: any;
}

interface SimulatedMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  media?: any[];
  interactive?: any;
}

export default function WhatsAppAIAssistantModal({
  isOpen,
  onClose,
  initialMode = 'chat',
  currentRide,
  currentOrder,
}: WhatsAppAIAssistantModalProps) {
  const [tab, setTab] = useState<'chat' | 'papopay' | 'receipt' | 'order' | 'guide'>(initialMode);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [assistantPhone, setAssistantPhone] = useState('0712345678');
  const [customerPhone, setCustomerPhone] = useState(currentRide?.customerPhone || currentOrder?.customerPhone || '0712345678');
  const [driverPhone, setDriverPhone] = useState(currentRide?.driverPhone || '');

  // PapoPay WhatsApp Link / Order Card Builder state
  const [payTitle, setPayTitle] = useState('Malipo ya Huduma PapoPay');
  const [payAmount, setPayAmount] = useState('15000');
  const [payRecipientName, setPayRecipientName] = useState('PapoPay Merchant');

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

  const [messages, setMessages] = useState<SimulatedMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: `Habari! 👋 Mimi ni *Papo Hapo WhatsApp AI Assistant*.

Ninaweza kukusaidia papo hapo:
💳 *PapoPay & PapoWallet* (Salio, Tuma Pesa 0% Ada, LUKU, DAWASA, Kadi ya Mwanafunzi & Gawana Bili)
🚗 *PapoRide* (Boda, Bajaji, Teksi)
🍔 *PapoFood & PapoMart* (Chakula & Duka)
📦 *PapoSend* (Kutuma Mzigo / Delivery)

Bonyeza vitufe hapo chini au andika unachohitaji!`,
      time: '12:00',
    },
  ]);

  useEffect(() => {
    if (initialMode) setTab(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, tab]);

  const nowTime = () => new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

  const handleSendMessage = async (textToSend?: string, displayText?: string) => {
    const rawCmd = (textToSend ?? inputText).trim();
    const visibleText = (displayText || rawCmd).trim();
    if (!rawCmd || isLoading) return;

    const userMsg: SimulatedMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: visibleText,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/meta/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: 'user-demo-' + (customerPhone || 'guest').replace(/\D/g, ''),
          message: rawCmd,
          channel: 'whatsapp',
        }),
      });

      if (!res.ok) throw new Error('Hitilafu kwenye mawasiliano ya AI');
      const data = await res.json();

      const botReply: SimulatedMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: data.reply || 'Asante kwa ujumbe wako. Tunashughulikia ombi lako sasa hivi!',
        media: Array.isArray(data.media) ? data.media : undefined,
        interactive: data.interactive || undefined,
        time: nowTime(),
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (err) {
      console.error('AI Simulate error:', err);
      const botFallback: SimulatedMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: `Nimepokea: "${visibleText}".\n\nMtandao unasumbua kidogo. Jaribu tena au tumia kiungo cha PapoPay moja kwa moja.`,
        time: nowTime(),
      };
      setMessages((prev) => [...prev, botFallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchPapoPayCheckoutInChat = () => {
    const amt = Math.max(100, parseInt(payAmount.replace(/\D/g, ''), 10) || 15000);
    const refCode = `PP-${Math.floor(100000 + Math.random() * 899999)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qs = new URLSearchParams({
      to: customerPhone || '0712345678',
      name: payRecipientName.trim() || 'PapoPay Merchant',
      amount: String(amt),
      ref: refCode,
      title: payTitle.trim() || 'Malipo ya PapoPay',
      purpose: 'pay_vendor',
      mode: 'whatsapp',
    });
    const checkoutUrl = `${origin}/pay?${qs.toString()}`;

    const orderCardMsg: SimulatedMessage = {
      id: `pp-card-${Date.now()}`,
      sender: 'bot',
      text: `🧾 *Kadi ya Malipo ya PapoPay Tayari!* (#${refCode})\nBonyeza *Review and pay* kulipa TZS ${amt.toLocaleString()} kupitia PapoWallet, M-Pesa, Mixx by Yas, Airtel Money au Kadi.`,
      time: nowTime(),
      interactive: {
        type: 'order_details',
        body: {
          text: `${payRecipientName} · ${payTitle} · TZS ${amt.toLocaleString()}`,
        },
        action: {
          name: 'review_and_pay',
          parameters: {
            reference_id: refCode,
            type: 'digital-goods',
            currency: 'TZS',
            total_amount: { value: amt, offset: 1 },
            order: {
              status: 'pending',
              items: [
                {
                  retailer_id: refCode,
                  name: payTitle,
                  amount: { value: amt, offset: 1 },
                  quantity: 1,
                },
              ],
            },
          },
        },
        papopayMeta: {
          orderId: refCode,
          referenceId: refCode,
          merchantName: payRecipientName.trim() || 'PapoPay Merchant',
          merchantPhone: customerPhone || '0712345678',
          itemTitle: payTitle.trim() || 'Malipo ya PapoPay',
          amount: amt,
          purpose: 'pay_vendor',
          checkoutUrl,
          payerPhone: customerPhone || '0712345678',
        },
      },
    };
    setMessages((prev) => [...prev, orderCardMsg]);
    setTab('chat');
    toast.success('Kadi ya Review & Pay imewekwa kwenye chat!');
  };

  const sampleQuickPrompts = [
    { label: '💳 PapoPay Menu', query: 'PapoPay' },
    { label: '💸 Tuma Pesa', query: 'Tuma pesa' },
    { label: '⚡ Lipa LUKU', query: 'LUKU 10000 14285930219' },
    { label: '💰 Salio & Risiti', query: 'Salio langu la PapoWallet' },
    { label: '🤝 Gawana Bili', query: 'Gawana bili' },
    { label: '🔗 Link ya Malipo', query: 'Link ya malipo' },
    { label: '🚗 Omba Usafiri', query: 'Naomba usafiri wa Gari toka Ubungo kwenda Posta' },
    { label: '🍔 Agiza Chakula', query: 'Naomba oda ya Chips Kuku robo na Soda ya baridi' },
  ];

  const defaultRideObj = currentRide || {
    id: 'PH-' + Math.floor(1000 + Math.random() * 9000),
    pickup: { name: 'Nelson Mandela Road, Mabibo' },
    destination: { name: 'Police Quarters, Mikocheni' },
    fare: 22000,
    customerName: 'Mteja Mpendwa',
    driverName: 'Garitz',
    vehiclePlate: 'TZ T778 ELW',
    vehicleType: 'Gari (Taxi)',
    paymentMethod: 'cash',
    distance: 11.0,
  };

  const customerReceiptUrl = buildRideReceiptWhatsAppUrl(defaultRideObj, customerPhone, false);
  const driverReceiptUrl = buildRideReceiptWhatsAppUrl(defaultRideObj, driverPhone, true);
  const realWhatsAppRideUrl = buildRideRequestWhatsAppUrl(assistantPhone, {
    pickup: currentRide?.pickup?.name || 'Dar es Salaam',
    destination: currentRide?.destination?.name || 'Kariakoo',
    vehicleType: 'Gari',
  });
  const realWhatsAppShopUrl = buildProductInquiryWhatsAppUrl(
    assistantPhone,
    'Chakula / Bidhaa ya Duka',
    15000,
    'Papo Hapo Shop'
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const expressPayLinkUrl = `${origin}/pay?${new URLSearchParams({
    to: customerPhone || '0712345678',
    name: payRecipientName.trim() || 'PapoPay Merchant',
    amount: String(Math.max(100, parseInt(payAmount.replace(/\D/g, ''), 10) || 15000)),
    title: payTitle.trim() || 'Malipo ya PapoPay',
    purpose: 'pay_vendor',
    mode: 'whatsapp',
  }).toString()}`;

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
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="w-full sm:max-w-lg h-full sm:h-[700px] sm:max-h-[92vh] bg-[#121b22] border-0 sm:border border-emerald-500/30 rounded-none sm:rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-white relative"
      >
        {/* Pinned Top WhatsApp Header Bar */}
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
              <h3 className="font-black text-sm sm:text-base tracking-tight truncate text-white">
                Papo Hapo WhatsApp AI
              </h3>
              <p className="text-[10.5px] text-neutral-300 mt-0.5 truncate">
                PapoPay & Huduma Zote · Mtandaoni Saa 24/7
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer border border-white/20"
            title="Funga Dirisha"
            aria-label="Funga"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* 5-Tab Switcher */}
        <div className="grid grid-cols-5 bg-[#111b21] border-b border-white/5 p-1 shrink-0 text-[10px] sm:text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`min-h-[38px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'chat' ? 'bg-[#00a884] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('papopay')}
            className={`min-h-[38px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'papopay' ? 'bg-[#00a884] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>PapoPay</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('receipt')}
            className={`min-h-[38px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'receipt' ? 'bg-[#00a884] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Risiti</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('order')}
            className={`min-h-[38px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'order' ? 'bg-[#00a884] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Agiza</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('guide')}
            className={`min-h-[38px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              tab === 'guide' ? 'bg-[#00a884] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Msaada</span>
          </button>
        </div>

        {/* TAB 1: Chat Feed & Interactive Cards */}
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto whatsapp-chat-scroll overscroll-contain px-3.5 py-3 space-y-2.5 bg-[#0b141a]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[84%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                      m.sender === 'user'
                        ? 'bg-[#005c4b] text-white rounded-br-xs'
                        : 'bg-[#202c33] text-neutral-100 rounded-bl-xs border border-white/5'
                    }`}
                  >
                    {m.text}

                    {Array.isArray(m.media) && m.media.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {m.media.map((att: any, idx: number) =>
                          att?.url ? (
                            <div key={idx} className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
                              <img
                                src={att.url}
                                alt={att.caption || 'Papo Hapo Media'}
                                referrerPolicy="no-referrer"
                                className="w-full max-h-44 object-contain bg-white"
                              />
                              {att.caption && (
                                <p className="px-2 py-1 text-[10px] text-neutral-300">{att.caption}</p>
                              )}
                            </div>
                          ) : null
                        )}
                      </div>
                    )}

                    {m.sender === 'bot' && m.interactive && (
                      <WhatsAppInteractiveMessageView
                        interactive={m.interactive}
                        isDark={true}
                        defaultPhone={customerPhone}
                        onSelectReply={(replyId, label) => handleSendMessage(replyId, label || replyId)}
                        onPaymentCompleted={(receiptPayload) => {
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: `paid-${Date.now()}`,
                              sender: 'bot',
                              text: receiptPayload?.body?.text || '✅ Malipo ya PapoPay yamekamilika!',
                              interactive: receiptPayload,
                              time: nowTime(),
                            },
                          ]);
                        }}
                      />
                    )}

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

            {/* Quick Sample Prompts */}
            <div className="bg-[#111b21] px-3 py-1.5 border-t border-white/5 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {sampleQuickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q.query)}
                    className="min-h-[30px] text-[10.5px] whitespace-nowrap bg-emerald-950/70 hover:bg-[#00a884]/25 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full transition-colors cursor-pointer shrink-0 font-semibold"
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
                placeholder="Andika ujumbe (Mf. PapoPay, Tuma pesa, LUKU)..."
                className="flex-1 min-h-[40px] bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none rounded-full px-4 py-2 text-xs text-white placeholder-neutral-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                aria-label="Tuma ujumbe"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Real WhatsApp Trigger */}
            <div className="px-3 py-2 bg-[#111b21] border-t border-white/5 flex items-center justify-between shrink-0">
              <span className="text-[10.5px] text-neutral-400 truncate mr-2">Fungua WhatsApp halisi ya simu yako:</span>
              <a
                href={realWhatsAppRideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 min-h-[34px] bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Fungua WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: PapoPay WhatsApp Checkout Builder */}
        {tab === 'papopay' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-2xl space-y-1">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <Wallet className="w-4 h-4" />
                PapoPay Ndani ya WhatsApp (Review & Pay)
              </h4>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Tengeneza kadi ya malipo ya WhatsApp au kiungo cha PapoPay Express Checkout ili wateja walipe kupitia PapoWallet (PIN ya tarakimu 4), M-Pesa, Mixx by Yas, Airtel Money au Kadi.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 block mb-1">
                  Jina la Mpokeaji / Duka / Dereva
                </label>
                <input
                  type="text"
                  value={payRecipientName}
                  onChange={(e) => setPayRecipientName(e.target.value)}
                  className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 block mb-1">
                  Huduma / Maelezo ya Bili
                </label>
                <input
                  type="text"
                  value={payTitle}
                  onChange={(e) => setPayTitle(e.target.value)}
                  className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-400 block mb-1">
                    Kiasi (TZS)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-neutral-400 block mb-1">
                    Simu ya Mlipaji
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleLaunchPapoPayCheckoutInChat}
                className="w-full min-h-[46px] px-4 bg-[#00a884] hover:bg-[#008f6f] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Tuma Kadi ya Review & Pay Kwenye Chat</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(expressPayLinkUrl);
                    toast.success('Link ya PapoPay imenakiliwa!');
                  }}
                  className="min-h-[42px] px-3 bg-[#1a2536] hover:bg-[#233147] border border-neutral-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nakili Link</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Lipa ${payTitle} (TZS ${Number(payAmount || 0).toLocaleString()}/=) papo hapo kwa PapoPay: ${expressPayLinkUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-3 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Tuma WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Receipt Dispatch */}
        {tab === 'receipt' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-2xl space-y-1">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Risiti ya Safari & Oda Moja kwa Moja WhatsApp
              </h4>
              <p className="text-[11px] text-neutral-300">
                Tuma stakabadhi rasmi ya safari au ya mauzo ya duka moja kwa moja kwa mteja au dereva.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Mteja (WhatsApp):</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mf. 0712345678"
                  className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Dereva (WhatsApp):</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="Mf. 0765432100"
                  className="w-full min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            <div className="bg-[#111c2e] border border-neutral-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-[10.5px] font-black text-emerald-400 uppercase tracking-wider">Muhtasari wa Risiti:</span>
                <span className="text-[10px] font-bold text-neutral-400">#{defaultRideObj.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Kuanzia (Pickup):</span>
                  <span className="font-bold text-white text-[11px] truncate block">
                    {defaultRideObj.pickup?.name || 'Nelson Mandela Rd, Mabibo'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Kuelekea (Dest):</span>
                  <span className="font-bold text-white text-[11px] truncate block">
                    {defaultRideObj.destination?.name || 'Police Quarters, Mikocheni'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Dereva / Chombo:</span>
                  <span className="font-bold text-white text-[11px]">
                    {defaultRideObj.driverName || 'Garitz (TZ T778 ELW)'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Nauli Iliyolipwa:</span>
                  <span className="font-black text-emerald-400 text-sm tabular-nums">
                    TZS {(defaultRideObj.fare || 22000).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={customerReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-3 bg-[#25D366] hover:bg-[#1ebd59] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <Share2 className="w-4 h-4" />
                Tuma Risiti kwa Mteja
              </a>

              <a
                href={driverReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-3 bg-[#075E54] hover:bg-[#0a7569] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4" />
                Tuma Nakala kwa Dereva
              </a>
            </div>
          </div>
        )}

        {/* TAB 4: Instant Ride Order */}
        {tab === 'order' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            <div className="bg-[#111c2e] border border-neutral-800 p-3 rounded-2xl space-y-1">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <Car className="w-4 h-4" />
                Omba Safari au Bidhaa Papo kwa Papo WhatsApp
              </h4>
              <p className="text-[11px] text-neutral-300">
                Mteja hahitaji kusakinisha programu; anabofya kiungo na kumwambia msaidizi wa AI moja kwa moja kwenye WhatsApp.
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
                  className="flex-1 min-h-[42px] bg-[#1a2536] border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(formatPhoneForWhatsApp(assistantPhone));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success('Namba imenakiliwa!');
                  }}
                  className="min-h-[42px] px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Imenakiliwa' : 'Nakili'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={realWhatsAppRideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] py-3 px-4 bg-gradient-to-r from-[#00A884] to-[#25D366] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-between hover:opacity-95 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <span>Omba Usafiri kupitia WhatsApp AI</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={realWhatsAppShopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] py-3 px-4 bg-[#1a2536] hover:bg-[#223046] border border-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Ulizia Bidhaa za Duka & Dawa WhatsApp</span>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400" />
              </a>
            </div>
          </div>
        )}

        {/* TAB 5: Setup Guide */}
        {tab === 'guide' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed">
            <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                Mwongozo wa PapoPay WhatsApp
              </span>
              <h4 className="font-black text-white text-sm">
                Vipengele Vyote Vinavyofanya Kazi Ndani ya WhatsApp
              </h4>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-[#111c2e] p-3 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">PapoWallet, Tuma Pesa (0% Ada) & Wakala</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Andika <code className="text-emerald-400">PapoPay</code>, <code className="text-emerald-400">Tuma pesa</code> au <code className="text-emerald-400">Toa pesa</code> kuangalia salio, kuhamisha fedha papo hapo au kupata msimbo wa Wakala.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-[#111c2e] p-3 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Kadi ya Checkout (Review & Pay) & Gawana Bili</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Andika <code className="text-emerald-400">Gawana bili</code> au <code className="text-emerald-400">Link ya malipo</code> kuunda kadi ya malipo ndani ya chat yenye PIN ya tarakimu 4 na E-Risiti.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-[#111c2e] p-3 rounded-xl border border-neutral-800">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0 text-xs">
                  3
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs">Bili za LUKU, DAWASA & Kadi za Mwanafunzi</h5>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Andika <code className="text-emerald-400">LUKU 10000 14285930219</code> au <code className="text-emerald-400">Mwanafunzi</code> kupata tokeni na salio la kadi papo hapo (+5% PapoPoints).
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
            <span className="truncate">Papo Hapo WhatsApp AI · PapoPay Integrated</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[32px] px-3 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg font-bold text-[10px] transition-all shrink-0 cursor-pointer"
          >
            Funga
          </button>
        </div>
      </motion.div>
    </div>
  );
}
