import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Car,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Delete,
  Droplet,
  Eye,
  EyeOff,
  ExternalLink,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Link2,
  List,
  Lock,
  MapPin,
  Package,
  Phone,
  Plus,
  Receipt,
  Scissors,
  Send,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Utensils,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PapoPayOrderMeta {
  orderId?: string;
  referenceId?: string;
  merchantName?: string;
  merchantPhone?: string;
  itemTitle?: string;
  amount?: number;
  purpose?: string;
  checkoutUrl?: string;
  payerPhone?: string;
  walletBalance?: number;
  methodLabel?: string;
  newBalance?: number;
  token?: string | null;
  units?: string | null;
  cashbackPoints?: number;
  paidAt?: string;
}

interface WhatsAppInteractiveMessageViewProps {
  interactive: any;
  isDark?: boolean;
  defaultPhone?: string;
  onSelectReply: (replyId: string, displayLabel?: string) => void;
  onPaymentCompleted?: (receiptPayload: any) => void;
}

type SheetMode =
  | null
  | { kind: 'list'; payload: any }
  | { kind: 'flow'; payload: any }
  | { kind: 'checkout'; step: 'order_details' | 'address' | 'review' | 'pin' | 'success'; meta: PapoPayOrderMeta }
  | { kind: 'receipt'; meta: PapoPayOrderMeta };

const DEFAULT_HUB_SERVICES = [
  { key: 'papopay', title: 'PapoPay', statusLabel: 'Wazi', isAvailable: true, badgePill: '24/7', desc: 'Pochi na Malipo' },
  { key: 'taxi', title: 'PapoRide', statusLabel: 'Wazi', isAvailable: true, desc: 'Safari & Bodaboda' },
  { key: 'food', title: 'PapoFood', statusLabel: 'Wazi', isAvailable: true, desc: 'Chakula na Meza' },
  { key: 'grocery', title: 'PapoMart', statusLabel: 'Wazi', isAvailable: true, desc: 'Vyakula na Bidhaa' },
  { key: 'parcel', title: 'PapoSend', statusLabel: 'Wazi', isAvailable: true, desc: 'Vifurushi na Mizigo' },
  { key: 'pharmacy', title: 'PapoMed', statusLabel: 'Wazi', isAvailable: true, desc: 'Famasi na Afya' },
  { key: 'salon', title: 'PapoStyle', statusLabel: 'Wazi', isAvailable: true, desc: 'Saluni na Spa' },
  { key: 'handyman', title: 'PapoFix', statusLabel: 'Wazi', isAvailable: true, desc: 'Matengenezo na Fundi' },
  { key: 'hotel', title: 'PapoStay', statusLabel: 'Wazi', isAvailable: true, desc: 'Hoteli na Malazi' },
];

const HUB_SERVICE_STYLE: Record<string, { bg: string; icon: any }> = {
  papopay: { bg: 'bg-[#1fa855]', icon: Wallet },
  taxi: { bg: 'bg-[#f97316]', icon: Car },
  food: { bg: 'bg-[#ef4444]', icon: Utensils },
  grocery: { bg: 'bg-[#2563eb]', icon: ShoppingCart },
  parcel: { bg: 'bg-[#7c3aed]', icon: Package },
  pharmacy: { bg: 'bg-[#0891b2]', icon: HeartPulse },
  salon: { bg: 'bg-[#9333ea]', icon: Scissors },
  handyman: { bg: 'bg-[#16a34a]', icon: Wrench },
  hotel: { bg: 'bg-[#ea580c]', icon: Building2 },
  bus_ticket: { bg: 'bg-[#0284c7]', icon: Car },
  events: { bg: 'bg-[#db2777]', icon: Sparkles },
  orders: { bg: 'bg-[#0d9488]', icon: ShoppingBag },
};

interface SavedAddress {
  id: string;
  name: string;
  phone: string;
  address: string;
}

const PAYMENT_OPTIONS = [
  { id: 'papowallet', label: 'PapoPay Wallet', sub: 'Salio lako la PapoPay (0% Ada)', icon: Wallet },
  { id: 'mpesa', label: 'M-Pesa (Vodacom)', sub: 'USSD Push moja kwa moja', icon: Smartphone },
  { id: 'tigopesa', label: 'Mixx by Yas', sub: 'Tigo Pesa USSD Push', icon: Smartphone },
  { id: 'airtel', label: 'Airtel Money', sub: 'Airtel Money USSD Push', icon: Smartphone },
  { id: 'halopesa', label: 'HaloPesa', sub: 'Halotel Mobile Money', icon: Smartphone },
  { id: 'card', label: 'PapoPay Mastercard / Visa', sub: 'Virtual au Kadi ya Benki', icon: CreditCard },
] as const;

export const WhatsAppInteractiveMessageView: React.FC<WhatsAppInteractiveMessageViewProps> = ({
  interactive,
  isDark = true,
  defaultPhone = '0712345678',
  onSelectReply,
  onPaymentCompleted,
}) => {
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('addr-1');
  const [addresses, setAddresses] = useState<SavedAddress[]>([
    {
      id: 'addr-1',
      name: 'Mteja wa Papo Hapo',
      phone: defaultPhone || '+255712345678',
      address: 'Mtaa wa Samora, Posta Mpya, Dar es Salaam',
    },
    {
      id: 'addr-2',
      name: 'Nyumbani / Ofisi',
      phone: defaultPhone || '+255712345678',
      address: 'Mikocheni B, karibu na Rose Garden, Dar es Salaam',
    },
  ]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState(defaultPhone || '');
  const [newAddrStreet, setNewAddrStreet] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<string>('papowallet');
  const [payerPhone, setPayerPhone] = useState<string>(defaultPhone || '0712345678');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [pinDigits, setPinDigits] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [completedResult, setCompletedResult] = useState<any>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Native WhatsApp Flows v6.0 Drawer State
  const [flowScreen, setFlowScreen] = useState<'home' | 'inputs' | 'summary'>('home');
  const [flowActionId, setFlowActionId] = useState<string>('send_p2p');
  const [flowChannel, setFlowChannel] = useState<string>('PAPOWALLET');
  const [flowRecipient, setFlowRecipient] = useState<string>('');
  const [flowAmount, setFlowAmount] = useState<string>('');
  const [flowNote, setFlowNote] = useState<string>('');
  const [flowPin, setFlowPin] = useState<string>('');
  const [flowError, setFlowError] = useState<string>('');
  const [flowVerifiedProfile, setFlowVerifiedProfile] = useState<{
    found: boolean;
    fullName?: string;
    username?: string;
    maskedWalletId?: string;
    phone?: string;
    verified?: boolean;
  } | null>(null);
  const [flowLookingUp, setFlowLookingUp] = useState<boolean>(false);
  const [regName, setRegName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>(defaultPhone || '');
  const [regLang, setRegLang] = useState<'sw' | 'en'>('sw');

  useEffect(() => {
    if (defaultPhone && (!payerPhone || payerPhone === '0712345678')) {
      setPayerPhone(defaultPhone);
    }
    if (defaultPhone && !regPhone) {
      setRegPhone(defaultPhone);
    }
  }, [defaultPhone]);

  // Debounced live lookup for @username / Wallet ID / Phone inside PapoPay Flow
  useEffect(() => {
    if (sheet?.kind !== 'flow' || flowScreen !== 'inputs' || flowActionId !== 'send_p2p' || flowChannel !== 'PAPOWALLET') {
      setFlowVerifiedProfile(null);
      return;
    }
    const q = flowRecipient.trim();
    if (q.length < 3) {
      setFlowVerifiedProfile(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setFlowLookingUp(true);
      try {
        const resp = await fetch(`/api/wallet/recipient-lookup?q=${encodeURIComponent(q)}`);
        const data = resp.ok ? await resp.json() : null;
        if (!cancelled && data?.ok) {
          setFlowVerifiedProfile(data);
        }
      } catch {
        if (!cancelled) setFlowVerifiedProfile(null);
      } finally {
        if (!cancelled) setFlowLookingUp(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sheet?.kind, flowScreen, flowActionId, flowChannel, flowRecipient]);

  if (!interactive || typeof interactive !== 'object') return null;

  const openWhatsAppFlowDrawer = (payload: any) => {
    setFlowScreen('home');
    setFlowActionId('send_p2p');
    setFlowChannel('PAPOWALLET');
    setFlowRecipient('');
    setFlowAmount('');
    setFlowNote('');
    setFlowPin('');
    setFlowError('');
    setFlowVerifiedProfile(null);
    setSheet({ kind: 'flow', payload });

    const phoneLookup = payload?.papopayFlowMeta?.walletSummary?.phone || defaultPhone || '';
    if (String(phoneLookup).replace(/\D/g, '').length >= 9) {
      fetch(`/api/payments/papopay-wallet-balance?phone=${encodeURIComponent(phoneLookup)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && typeof d.walletBalance === 'number') {
            setWalletBalance(d.walletBalance);
          }
        })
        .catch(() => {});
    }
  };

  const startPapoPayFlowAction = (actionId: string, defaultChannel: string) => {
    setFlowActionId(actionId);
    setFlowChannel(defaultChannel);
    setFlowRecipient('');
    setFlowAmount('');
    setFlowNote('');
    setFlowPin('');
    setFlowError('');
    setFlowVerifiedProfile(null);
    setFlowScreen('inputs');
  };

  const submitInstantPapoPayFlow = (payloadObj: Record<string, any>, label: string) => {
    setSheet(null);
    onSelectReply(`__FLOW_DATA__:${JSON.stringify(payloadObj)}`, label);
  };

  const computeFlowFeePreview = (actionId: string, channel: string, amt: number): number => {
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    if (actionId === 'topup' || actionId === 'bill_luku' || actionId === 'split_bill' || actionId === 'create_link' || actionId === 'pay_target') {
      return 0;
    }
    if (channel === 'PAPOWALLET') return 0;
    if (channel === 'BANK') return Math.max(500, Math.round(amt * 0.005));
    return Math.max(300, Math.round(amt * 0.01));
  };

  const extractOrderMeta = (payload: any): PapoPayOrderMeta => {
    const meta: PapoPayOrderMeta = payload?.papopayMeta || {};
    const params = payload?.action?.parameters || {};
    const firstItem = params?.order?.items?.[0];
    const amt =
      Number(meta.amount || 0) ||
      Number(params?.total_amount?.value || 0) ||
      0;
    return {
      orderId: meta.orderId || firstItem?.retailer_id || params?.reference_id || 'PP-1001',
      referenceId: meta.referenceId || params?.reference_id || 'PP-1001',
      merchantName: meta.merchantName || 'PapoPay Merchant',
      merchantPhone: meta.merchantPhone || '',
      itemTitle: meta.itemTitle || firstItem?.name || params?.order?.description || 'Malipo ya PapoPay',
      amount: amt,
      purpose: meta.purpose || 'pay_vendor',
      checkoutUrl: meta.checkoutUrl || params?.payment_settings?.[0]?.payment_link?.uri || '',
      payerPhone: meta.payerPhone || defaultPhone || '',
      walletBalance: Number(meta.walletBalance || 0),
      methodLabel: meta.methodLabel || 'PapoPay Wallet',
      newBalance: meta.newBalance,
      token: meta.token || null,
      units: meta.units || null,
      cashbackPoints: meta.cashbackPoints || 0,
      paidAt: meta.paidAt || new Date().toISOString(),
    };
  };

  const openCheckoutFlow = async (meta: PapoPayOrderMeta) => {
    const phoneToUse = meta.payerPhone || payerPhone || defaultPhone || '0712345678';
    setPayerPhone(phoneToUse);
    setWalletBalance(Number(meta.walletBalance || 0));
    setCheckoutError('');
    setPinDigits('');
    setCompletedResult(null);
    setSheet({ kind: 'checkout', step: 'order_details', meta });

    if (phoneToUse.replace(/\D/g, '').length >= 9) {
      try {
        const res = await fetch(`/api/payments/papopay-wallet-balance?phone=${encodeURIComponent(phoneToUse)}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.walletBalance === 'number') {
            setWalletBalance(data.walletBalance);
          }
        }
      } catch {}
    }
  };

  const handleSaveNewAddress = () => {
    if (newAddrStreet.trim().length < 3) {
      setCheckoutError('Tafadhali andika mtaa/eneo kamili.');
      return;
    }
    const created: SavedAddress = {
      id: `addr-${Date.now()}`,
      name: newAddrName.trim() || 'Mteja wa PapoPay',
      phone: newAddrPhone.trim() || payerPhone,
      address: newAddrStreet.trim(),
    };
    setAddresses((prev) => [created, ...prev]);
    setSelectedAddressId(created.id);
    setShowAddAddress(false);
    setNewAddrName('');
    setNewAddrStreet('');
    setCheckoutError('');
    if (sheet?.kind === 'checkout') {
      setSheet({ ...sheet, step: 'order_details' });
    }
  };

  const submitCheckoutPayment = async (overridePin?: string) => {
    if (sheet?.kind !== 'checkout') return;
    const meta = sheet.meta;
    const activeAddr = addresses.find((a) => a.id === selectedAddressId);
    const phoneToUse = payerPhone.trim() || meta.payerPhone || '0712345678';
    if (phoneToUse.replace(/\D/g, '').length < 9) {
      setCheckoutError('Weka namba sahihi ya simu ya malipo (Mfano: 0712345678).');
      return;
    }

    const pinToUse = overridePin ?? pinDigits;
    if ((paymentMethod === 'papowallet' || paymentMethod === 'card') && !/^\d{4,6}$/.test(pinToUse)) {
      setCheckoutError('Ingiza PIN yako ya tarakimu 4 hadi 6.');
      return;
    }

    setSubmitting(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/payments/papopay-whatsapp-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(meta.amount || 0),
          method: paymentMethod,
          buyerPhone: phoneToUse,
          payerName: activeAddr?.name || 'Mteja wa PapoPay',
          recipientName: meta.merchantName,
          recipientPhone: meta.merchantPhone,
          title: meta.itemTitle,
          purpose: meta.purpose || 'pay_vendor',
          orderId: meta.orderId,
          referenceId: meta.referenceId,
          pin: pinToUse || undefined,
          shippingAddress: activeAddr?.address || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCheckoutError(data.error || 'Malipo hayakukamilika. Tafadhali jaribu tena.');
        return;
      }

      setCompletedResult(data);
      if (typeof data.newBalance === 'number') {
        setWalletBalance(data.newBalance);
      }
      setSheet({ kind: 'checkout', step: 'success', meta });

      const receiptPayload = {
        type: 'order_status',
        body: {
          text: `💚 Imelipwa Kwenda ${meta.merchantName} • TZS ${Number(meta.amount || 0).toLocaleString()}/=`,
        },
        action: {
          name: 'send_order_status',
          parameters: {
            reference_id: data.referenceId || meta.referenceId,
            order: {
              status: data.status === 'paid' ? 'completed' : 'pending',
              description: `${meta.itemTitle} — TZS ${Number(meta.amount || 0).toLocaleString()}`,
            },
          },
        },
        papopayMeta: {
          orderId: data.orderId || meta.orderId,
          referenceId: data.referenceId || meta.referenceId,
          merchantName: meta.merchantName,
          itemTitle: meta.itemTitle,
          amount: Number(meta.amount || 0),
          methodLabel: data.methodLabel || PAYMENT_OPTIONS.find((p) => p.id === paymentMethod)?.label || 'PapoPay',
          newBalance: data.newBalance,
          token: data.token || null,
          cashbackPoints: data.cashbackPoints || 0,
          paidAt: data.paidAt || new Date().toISOString(),
        },
      };
      onPaymentCompleted?.(receiptPayload);
    } catch {
      setCheckoutError('Mtandao unasumbua kidogo. Jaribu tena.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
  const activePaymentOption = PAYMENT_OPTIONS.find((o) => o.id === paymentMethod) || PAYMENT_OPTIONS[0];

  const renderThumbnail = (imageUrl?: string, fallbackTitle?: string) => {
    const cleanUrl = String(imageUrl || '').trim();
    const isBroken = !cleanUrl || brokenImages[cleanUrl];
    const initials = (fallbackTitle || 'PP')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'PP';

    if (isBroken) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#00a884]/25 to-emerald-900/40 flex flex-col items-center justify-center text-[#00a884]">
          <Store className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-black tracking-wider">{initials}</span>
        </div>
      );
    }

    return (
      <img
        src={cleanUrl}
        alt={fallbackTitle || 'PapoPay'}
        referrerPolicy="no-referrer"
        onError={() => setBrokenImages((prev) => ({ ...prev, [cleanUrl]: true }))}
        className="w-full h-full object-cover"
      />
    );
  };

  return (
    <>
      {/* 1. INTERACTIVE REPLY BUTTONS */}
      {interactive.type === 'button' && Array.isArray(interactive?.action?.buttons) && (
        <div className="mt-2 flex flex-col gap-1.5">
          {interactive.action.buttons.map((b: any, idx: number) => (
            <button
              key={b?.reply?.id || idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectReply(String(b?.reply?.id || ''), String(b?.reply?.title || ''));
              }}
              className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer border ${
                isDark
                  ? 'bg-[#182229] hover:bg-[#1f2c34] text-[#25d366] border-white/10'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
            >
              <span>{b?.reply?.title || 'Chagua'}</span>
            </button>
          ))}
        </div>
      )}

      {/* 2. INTERACTIVE LIST LAUNCH BUTTON */}
      {interactive.type === 'list' && Array.isArray(interactive?.action?.sections) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSheet({ kind: 'list', payload: interactive });
          }}
          className={`mt-2 w-full min-h-[40px] px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer border ${
            isDark
              ? 'bg-[#182229] hover:bg-[#1f2c34] text-[#25d366] border-white/10'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
          }`}
        >
          <List className="w-3.5 h-3.5 shrink-0" />
          <span>{interactive?.action?.button || 'Chagua Kwenye Orodha'}</span>
        </button>
      )}

      {/* 3. LOCATION PIN REQUEST BUTTON */}
      {interactive.type === 'location_request_message' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  onSelectReply(
                    `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
                    '📍 Eneo Langu (GPS)'
                  );
                },
                () => onSelectReply('Posta, Dar es Salaam', '📍 Posta, Dar es Salaam'),
                { timeout: 3500 }
              );
            } else {
              onSelectReply('Posta, Dar es Salaam', '📍 Posta, Dar es Salaam');
            }
          }}
          className={`mt-2 w-full min-h-[40px] px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer border ${
            isDark
              ? 'bg-[#182229] hover:bg-[#1f2c34] text-[#25d366] border-white/10'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Send Location (GPS)</span>
        </button>
      )}

      {/* 4. CTA URL LINK */}
      {interactive.type === 'cta_url' && interactive?.action?.parameters?.url && (
        <a
          href={interactive.action.parameters.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`mt-2 w-full min-h-[40px] px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border ${
            isDark
              ? 'bg-[#182229] hover:bg-[#1f2c34] text-[#53bdeb] border-white/10'
              : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{interactive.action.parameters.display_text || 'Fungua Kiungo'}</span>
        </a>
      )}

      {/* 5. CAROUSEL CARDS */}
      {interactive.type === 'carousel' && Array.isArray(interactive?.action?.cards) && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
          {interactive.action.cards.map((card: any, idx: number) => {
            const imgLink = card?.header?.image?.link;
            const btns = Array.isArray(card?.action?.buttons) ? card.action.buttons : [];
            return (
              <div
                key={idx}
                className={`snap-start shrink-0 w-[196px] rounded-xl overflow-hidden border ${
                  isDark ? 'bg-[#182229] border-white/10 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
                }`}
              >
                <div className="h-24 w-full overflow-hidden">
                  {renderThumbnail(imgLink, card?.body?.text)}
                </div>
                <div className="p-2.5 space-y-2">
                  <p className="text-[11px] leading-snug line-clamp-2 font-medium">{card?.body?.text || 'Bidhaa'}</p>
                  <div className="flex flex-col gap-1">
                    {btns.map((b: any, bIdx: number) => (
                      <button
                        key={bIdx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReply(String(b?.reply?.id || ''), String(b?.reply?.title || ''));
                        }}
                        className={`w-full min-h-[34px] px-2 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#202c33] hover:bg-[#2a3942] text-[#25d366] border-white/10'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {b?.reply?.title || 'Chagua'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5B. NATIVE WHATSAPP FLOWS LAUNCH CARD */}
      {interactive.type === 'flow' && (() => {
        const flowCta = interactive?.action?.parameters?.flow_cta || 'Fungua Huduma';
        const fallbackList = interactive?.fallbackInteractive;
        return (
          <div className="mt-2 space-y-1.5 w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => openWhatsAppFlowDrawer(interactive)}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl text-[11.5px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer border ${
                isDark
                  ? 'bg-[#00a884] hover:bg-[#009675] text-white border-emerald-400/20 shadow-sm'
                  : 'bg-[#008069] hover:bg-[#006b57] text-white border-emerald-700/20 shadow-sm'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{flowCta}</span>
            </button>

            {fallbackList?.type === 'list' && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'list', payload: fallbackList })}
                className={`w-full min-h-[34px] px-3 py-1 rounded-xl text-[10.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-[#182229] hover:bg-[#1f2c34] text-emerald-300 border-white/10'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                <List className="w-3 h-3 shrink-0" />
                <span>{fallbackList?.action?.button || 'Orodha ya Haraka'}</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* 6. NATIVE ORDER DETAILS CARD (Review & Pay) */}
      {interactive.type === 'order_details' && (() => {
        const meta = extractOrderMeta(interactive);
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-2 rounded-2xl overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-sm w-full"
          >
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10.5px]">
              <span className="font-semibold text-slate-600">Order #{meta.referenceId}</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <Clock className="w-3 h-3" />
                Order pending
              </span>
            </div>

            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                  {renderThumbnail(undefined, meta.merchantName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold text-slate-900 truncate">{meta.itemTitle}</p>
                  <p className="text-[10px] text-slate-500 truncate">{meta.merchantName} · Quantity 1</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 font-medium">Total</span>
                <span className="font-black text-slate-900 tabular-nums">
                  TZS {Number(meta.amount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openCheckoutFlow(meta)}
              className="w-full min-h-[44px] border-t border-slate-200 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-[#008069] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Review and pay</span>
            </button>
          </div>
        );
      })()}

      {/* 7. NATIVE ORDER STATUS PAID RECEIPT BUBBLE + CARD */}
      {interactive.type === 'order_status' && (() => {
        const meta = extractOrderMeta(interactive);
        return (
          <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-1.5 w-full">
            {/* Green In-Chat Payment Bubble */}
            <div className="rounded-2xl overflow-hidden bg-[#d9fdd3] text-slate-900 border border-emerald-300/70 shadow-sm p-3">
              <div className="text-center py-1.5">
                <p className="text-xl font-black tracking-tight tabular-nums text-slate-950">
                  TZS {Number(meta.amount || 0).toLocaleString()}
                </p>
              </div>
              <div className="mt-1 pt-2 border-t border-emerald-900/10 flex items-center justify-between gap-2 text-[10.5px]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">Sent to {meta.merchantName}</p>
                    <p className="text-emerald-800 font-semibold">Completed</p>
                  </div>
                </div>
                <CheckCheck className="w-4 h-4 text-[#008069] shrink-0" />
              </div>
            </div>

            {/* Order # PAID Summary Card */}
            <div className="rounded-2xl overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-sm">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-slate-600">Order #{meta.referenceId}</span>
                <span className="inline-flex items-center gap-1 text-[#008069] font-extrabold uppercase tracking-wide">
                  <Check className="w-3 h-3 stroke-[3]" />
                  PAID
                </span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                    {renderThumbnail(undefined, meta.merchantName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-bold text-slate-900 truncate">{meta.itemTitle}</p>
                    <p className="text-[10px] text-slate-500">1 item · {meta.methodLabel}</p>
                  </div>
                </div>
                {meta.token && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10.5px] font-mono font-bold text-amber-900 flex items-center justify-between gap-2">
                    <span className="truncate">⚡ {meta.token}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(String(meta.token));
                        toast.success('Tokeni ya LUKU imenakiliwa!');
                      }}
                      className="text-amber-700 hover:text-amber-950 shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Total</span>
                  <span className="font-black text-slate-900 tabular-nums">
                    TZS {Number(meta.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheet({ kind: 'receipt', meta })}
                className="w-full min-h-[42px] border-t border-slate-200 bg-white hover:bg-slate-50 text-[#008069] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>View details</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============================================================
          SLIDE-UP SHEET MODAL (List Picker / Checkout / PIN / Receipt)
         ============================================================ */}
      {sheet && (
        <div
          className="fixed inset-0 z-[1000000] bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !submitting && setSheet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white text-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* A. INTERACTIVE LIST SHEET */}
            {sheet.kind === 'list' && (
              <>
                <div className="px-4 py-3.5 bg-[#008069] text-white flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-bold text-sm">{sheet.payload?.header?.text || 'Chagua Huduma'}</h4>
                    {sheet.payload?.footer?.text && (
                      <p className="text-[11px] text-emerald-100">{sheet.payload.footer.text}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet(null)}
                    className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {(sheet.payload?.action?.sections || []).map((sec: any, sIdx: number) => (
                    <div key={sIdx}>
                      {sec.title && (
                        <div className="px-4 py-2 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                          {sec.title}
                        </div>
                      )}
                      {(sec.rows || []).map((row: any) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => {
                            setSheet(null);
                            onSelectReply(String(row.id), String(row.title));
                          }}
                          className="w-full min-h-[52px] px-4 py-2.5 text-left hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{row.title}</p>
                            {row.description && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{row.description}</p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* A2. NATIVE WHATSAPP FLOWS v6.0 DRAWER (Papo Hapo Super Hub / PapoPay Digital Wallet / Registration) */}
            {sheet.kind === 'flow' && (() => {
              const flowMeta = sheet.payload?.papopayFlowMeta || {};
              const flowKind = String(flowMeta?.flowKind || '').toLowerCase();

              // FLOW 1: PAPO HAPO SUPER APP HUB (Matches Screenshot 2)
              if (flowKind === 'papo_hub') {
                const hubServices = Array.isArray(flowMeta.services) && flowMeta.services.length > 0
                  ? flowMeta.services
                  : DEFAULT_HUB_SERVICES;

                return (
                  <div className="flex flex-col max-h-[90vh] bg-[#111b21] text-white">
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSheet(null)}
                          className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
                          aria-label="Funga"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <h4 className="font-bold text-base tracking-tight">Papo Hapo</h4>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                      {/* Illustrated Super App Top Banner */}
                      <div className="rounded-2xl bg-gradient-to-r from-[#f59e0b] via-[#fbbf24] to-[#10b981] p-3.5 flex items-center justify-between gap-3 text-slate-950 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-white/95 shadow-sm flex items-center justify-center text-[#f97316] shrink-0">
                            <Car className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 block">
                              Papo Hapo Super App
                            </span>
                            <p className="text-sm font-black leading-tight text-slate-950 truncate">
                              Huduma zote, papo hapo!
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-white/90 flex items-center justify-center text-[#1fa855]">
                            <Wallet className="w-5 h-5" />
                          </div>
                          <div className="w-9 h-9 rounded-xl bg-white/90 flex items-center justify-center text-[#ea580c]">
                            <Package className="w-5 h-5" />
                          </div>
                        </div>
                      </div>

                      <div className="text-center pb-1">
                        <h5 className="text-lg font-extrabold tracking-tight text-white">Huduma zote, papo hapo!</h5>
                        <p className="text-xs text-slate-300 mt-0.5">Chagua huduma unayotaka.</p>
                      </div>

                      {/* Vertical Service List */}
                      <div className="divide-y divide-white/10">
                        {hubServices.map((srv: any) => {
                          const style = HUB_SERVICE_STYLE[srv.key] || { bg: 'bg-emerald-600', icon: ShoppingBag };
                          const IconComp = style.icon;
                          const isOpen = srv.isAvailable !== false && srv.statusTone !== 'red';
                          return (
                            <button
                              key={srv.key}
                              type="button"
                              onClick={() =>
                                submitInstantPapoPayFlow(
                                  { flow_type: 'papo_hub', selected_service: srv.key },
                                  srv.title
                                )
                              }
                              className="w-full min-h-[64px] py-2.5 px-1 flex items-center justify-between gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-xl ${style.bg} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                                  <IconComp className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white truncate">{srv.title}</span>
                                    {srv.badgePill && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#1fa855] text-white text-[10px] font-black leading-none">
                                        {srv.badgePill}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5 truncate">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        isOpen ? 'bg-emerald-400' : 'bg-rose-500'
                                      }`}
                                    />
                                    <span className={isOpen ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                                      {srv.statusLabel || (isOpen ? 'Wazi' : 'Imefungwa')}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-300 truncate">{srv.desc}</span>
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              // FLOW 2: PAPOPAY SUPER WALLET (Matches Screenshot 1 & 3)
              if (flowKind === 'papopay_home') {
                const parsedAmt = Math.max(0, Math.round(Number(String(flowAmount || '0').replace(/\D/g, '')) || 0));
                const feeAmt = computeFlowFeePreview(flowActionId, flowChannel, parsedAmt);
                const totalAmt = parsedAmt + feeAmt;

                const actionLabelMap: Record<string, string> = {
                  topup: 'Weka Pesa (Top Up)',
                  send_p2p: 'Tuma Pesa',
                  send_bulk: 'Tuma kwa Wengi (Bulk)',
                  withdraw: 'Toa Pesa',
                  bill_luku: 'Lipa Bili',
                  pay_target: 'Lipa Dereva / Duka',
                  split_bill: 'Gawana Bili',
                  create_link: 'Link ya Malipo',
                };

                const requiresPin =
                  (flowActionId === 'send_p2p' && flowChannel !== 'BANK') ||
                  (flowActionId === 'withdraw' && flowChannel !== 'WAKALA') ||
                  (flowActionId === 'send_bulk' && flowChannel === 'PAPOWALLET');

                return (
                  <div className="flex flex-col max-h-[90vh] bg-[#f7f9f8] text-slate-900">
                    {/* Top Navigation Bar */}
                    <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (flowScreen === 'summary') {
                              setFlowScreen('inputs');
                            } else if (flowScreen === 'inputs') {
                              setFlowScreen('home');
                            } else {
                              setSheet(null);
                            }
                          }}
                          className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                          aria-label="Rudi nyuma"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <h4 className="font-bold text-base text-slate-950 leading-tight">
                            {flowScreen === 'home' ? 'PapoPay' : actionLabelMap[flowActionId] || 'PapoPay'}
                          </h4>
                          {flowScreen === 'home' && walletBalance > 0 && (
                            <p className="text-[11px] font-bold text-[#1fa855] tabular-nums">
                              Salio: TZS {walletBalance.toLocaleString()}/=
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSheet(null)}
                        className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
                        aria-label="Funga"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SCREEN 1: PAPOPAY HOME (Screenshot 1) */}
                    {flowScreen === 'home' && (
                      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
                        {/* Hero Illustration & Subtext */}
                        <div className="text-center space-y-2.5">
                          <div className="mx-auto w-24 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/80 border border-emerald-200/60 flex items-center justify-center gap-2 shadow-2xs">
                            <div className="w-10 h-10 rounded-xl bg-[#1fa855] text-white flex items-center justify-center shadow-xs">
                              <Wallet className="w-5 h-5" />
                            </div>
                            <div className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] flex items-center justify-center border border-amber-300">
                              TSh
                            </div>
                          </div>
                          <div>
                            <h5 className="text-lg font-black tracking-tight text-slate-950">
                              Lipa popote kwa PapoPay
                            </h5>
                            <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                              Weka pesa, tuma, na lipa bili kupitia WhatsApp.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startPapoPayFlowAction('topup', 'MONGIKE_USSD')}
                            className="w-full min-h-[44px] rounded-full bg-[#1fa855] hover:bg-[#199349] active:scale-[0.99] text-white font-bold text-sm shadow-sm transition-all cursor-pointer"
                          >
                            Weka Pesa (Top Up)
                          </button>
                        </div>

                        {/* Section: Tuma Pesa */}
                        <div className="space-y-2">
                          <h6 className="text-xs font-extrabold text-slate-900">Tuma Pesa</h6>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'send_p2p', ch: 'PAPOWALLET', label: 'Tuma MoMo / Benki', icon: Send },
                              { id: 'send_bulk', ch: 'PAPOWALLET', label: 'Tuma kwa Wengi', icon: Users },
                              { id: 'withdraw', ch: 'MPESA', label: 'Toa Pesa', icon: Banknote },
                            ].map((tile) => {
                              const TileIcon = tile.icon;
                              return (
                                <button
                                  key={tile.id}
                                  type="button"
                                  onClick={() => startPapoPayFlowAction(tile.id, tile.ch)}
                                  className="min-h-[82px] p-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5 text-center shadow-2xs transition-colors cursor-pointer"
                                >
                                  <TileIcon className="w-5 h-5 text-[#1fa855]" />
                                  <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                                    {tile.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section: Salio na Historia */}
                        <div className="space-y-1.5">
                          <h6 className="text-xs font-extrabold text-slate-900">Salio na Historia</h6>
                          <button
                            type="button"
                            onClick={() =>
                              submitInstantPapoPayFlow(
                                { flow_type: 'papopay_action', action_id: 'balance_history' },
                                'Salio & Historia'
                              )
                            }
                            className="w-full min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] flex items-center justify-between gap-2.5 text-left shadow-2xs transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#1fa855] flex items-center justify-center shrink-0">
                                <Wallet className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-semibold text-slate-800 truncate">
                                Salio, pointi na miamala 8 ya mwisho
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </div>

                        {/* Section: Lipa Bili */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h6 className="text-xs font-extrabold text-slate-900">Lipa Bili</h6>
                            <button
                              type="button"
                              onClick={() => startPapoPayFlowAction('bill_luku', 'LUKU')}
                              className="text-[11px] font-bold text-[#1fa855] hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Ona zote</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                              { label: 'LUKU', ch: 'LUKU', icon: Zap },
                              { label: 'Maji', ch: 'MAJI', icon: Droplet },
                              { label: 'Airtime', ch: 'AIRTIME', icon: Phone },
                              { label: 'Kadi', ch: 'CARD', icon: CreditCard },
                            ].map((bill) => {
                              const BIcon = bill.icon;
                              return (
                                <button
                                  key={bill.label}
                                  type="button"
                                  onClick={() => startPapoPayFlowAction('bill_luku', bill.ch)}
                                  className="flex flex-col items-center gap-1.5 py-1 cursor-pointer group"
                                >
                                  <div className="w-12 h-12 rounded-full bg-emerald-100/90 group-hover:bg-[#1fa855] text-[#1fa855] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                                    <BIcon className="w-5 h-5" />
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-800">{bill.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section: Zaidi */}
                        <div className="space-y-2 pb-1">
                          <h6 className="text-xs font-extrabold text-slate-900">Zaidi</h6>
                          <div className="grid grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => startPapoPayFlowAction('pay_target', 'PAPOWALLET')}
                              className="min-h-[74px] p-2 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                            >
                              <Car className="w-5 h-5 text-[#1fa855]" />
                              <span className="text-[10px] font-semibold text-slate-800 leading-tight">Lipa Dereva / Duka</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startPapoPayFlowAction('split_bill', 'PAPOWALLET')}
                              className="min-h-[74px] p-2 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                            >
                              <Users className="w-5 h-5 text-[#1fa855]" />
                              <span className="text-[10px] font-semibold text-slate-800 leading-tight">Gawana Bili</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startPapoPayFlowAction('create_link', 'PAPOWALLET')}
                              className="min-h-[74px] p-2 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                            >
                              <Link2 className="w-5 h-5 text-[#1fa855]" />
                              <span className="text-[10px] font-semibold text-slate-800 leading-tight">Link ya Malipo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                submitInstantPapoPayFlow(
                                  { flow_type: 'papopay_action', action_id: 'student_card' },
                                  'Kadi ya Mwanafunzi'
                                )
                              }
                              className="min-h-[74px] p-2 rounded-2xl bg-white border border-slate-200/80 hover:border-[#1fa855] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                            >
                              <GraduationCap className="w-5 h-5 text-[#1fa855]" />
                              <span className="text-[10px] font-semibold text-slate-800 leading-tight">Kadi ya Mwanafunzi</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SCREEN 2: INPUTS FORM */}
                    {flowScreen === 'inputs' && (
                      <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {/* Channel Pills */}
                          {flowActionId === 'send_p2p' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Mtandao / Njia</label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: 'PAPOWALLET', label: 'PapoWallet (0%)' },
                                  { id: 'MPESA', label: 'M-Pesa' },
                                  { id: 'TIGOPESA', label: 'Mixx / Tigo' },
                                  { id: 'AIRTEL', label: 'Airtel' },
                                  { id: 'HALOPESA', label: 'HaloPesa' },
                                  { id: 'BANK', label: 'Benki' },
                                ].map((ch) => (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => {
                                      setFlowChannel(ch.id);
                                      setFlowError('');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      flowChannel === ch.id
                                        ? 'bg-[#1fa855] text-white border-[#1fa855]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {ch.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {flowActionId === 'withdraw' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Chagua Mahali pa Kutoa</label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: 'MPESA', label: 'M-Pesa' },
                                  { id: 'TIGOPESA', label: 'Mixx / Tigo' },
                                  { id: 'AIRTEL', label: 'Airtel Money' },
                                  { id: 'HALOPESA', label: 'HaloPesa' },
                                  { id: 'WAKALA', label: 'Wakala (Kioski)' },
                                ].map((ch) => (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => {
                                      setFlowChannel(ch.id);
                                      setFlowError('');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      flowChannel === ch.id
                                        ? 'bg-[#1fa855] text-white border-[#1fa855]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {ch.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {flowActionId === 'bill_luku' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Aina ya Bili</label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: 'LUKU', label: 'Umeme (LUKU)' },
                                  { id: 'MAJI', label: 'Maji (DAWASA)' },
                                  { id: 'AIRTIME', label: 'Vocha / Airtime' },
                                  { id: 'CARD', label: 'Kadi / Bili' },
                                ].map((ch) => (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => setFlowChannel(ch.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      flowChannel === ch.id
                                        ? 'bg-[#1fa855] text-white border-[#1fa855]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {ch.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {flowActionId === 'topup' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 block">Njia ya Kuweka Pesa</label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { id: 'MONGIKE_USSD', label: 'Simu (USSD Push)' },
                                  { id: 'LIPA_NAMBA', label: 'Lipa Namba / Wakala' },
                                ].map((ch) => (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => setFlowChannel(ch.id)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      flowChannel === ch.id
                                        ? 'bg-[#1fa855] text-white border-[#1fa855]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {ch.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Target / Recipient / Account / Count Field */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">
                              {flowActionId === 'send_p2p'
                                ? flowChannel === 'BANK'
                                  ? 'Namba ya Akaunti ya Benki'
                                  : flowChannel === 'PAPOWALLET'
                                  ? '@Username, Wallet ID (PP...) au Simu'
                                  : 'Namba ya Simu ya Mpokeaji'
                                : flowActionId === 'send_bulk'
                                ? 'Namba au @Usernames (tenganisha kwa koma)'
                                : flowActionId === 'withdraw'
                                ? flowChannel === 'WAKALA'
                                  ? 'Namba ya Wakala (Hiari)'
                                  : 'Namba ya Simu ya Kupokea Pesa'
                                : flowActionId === 'bill_luku'
                                ? `Namba ya Mita / Akaunti (${flowChannel})`
                                : flowActionId === 'split_bill'
                                ? 'Idadi ya Watu wa Kugawana (mf. 3)'
                                : flowActionId === 'create_link'
                                ? 'Jina la Huduma / Bidhaa (mf. Oda ya Chakula)'
                                : flowActionId === 'topup'
                                ? 'Namba ya Simu ya Kulipa (mf. 0712345678)'
                                : 'Namba ya Dereva / Duka au Msimbo'}
                            </label>
                            <input
                              type="text"
                              value={flowRecipient}
                              onChange={(e) => {
                                setFlowRecipient(e.target.value);
                                setFlowError('');
                              }}
                              placeholder={
                                flowActionId === 'send_p2p'
                                  ? flowChannel === 'PAPOWALLET'
                                    ? '@jumamohamed au PP7225353 au 0712...'
                                    : flowChannel === 'BANK'
                                    ? 'Mf. 0150123456700'
                                    : 'Mf. 0712345678'
                                  : flowActionId === 'send_bulk'
                                  ? '0712345678, @amour, PP998811'
                                  : flowActionId === 'split_bill'
                                  ? '3'
                                  : flowActionId === 'create_link'
                                  ? 'Mf. Malipo ya Viatu / Usafiri'
                                  : 'Andika hapa...'
                              }
                              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#1fa855]"
                            />

                            {/* Live Verified PapoPay Recipient Badge */}
                            {flowActionId === 'send_p2p' && flowChannel === 'PAPOWALLET' && flowLookingUp && (
                              <p className="text-[11px] text-slate-500">Inahakiki akaunti ya PapoPay...</p>
                            )}
                            {flowActionId === 'send_p2p' &&
                              flowChannel === 'PAPOWALLET' &&
                              flowVerifiedProfile?.found && (
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ShieldCheck className="w-4 h-4 text-[#1fa855] shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-bold text-emerald-950 truncate">
                                        {flowVerifiedProfile.fullName || 'Mteja wa PapoPay'}
                                      </p>
                                      <p className="text-[10.5px] text-emerald-800 truncate">
                                        {flowVerifiedProfile.username ? `${flowVerifiedProfile.username} · ` : ''}
                                        {flowVerifiedProfile.maskedWalletId || flowVerifiedProfile.phone}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-[#1fa855] uppercase shrink-0">Verified</span>
                                </div>
                              )}
                          </div>

                          {/* Amount Field */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">
                              {flowActionId === 'split_bill' ? 'Jumla ya Bili (TZS)' : 'Kiasi (TZS)'}
                            </label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={flowAmount}
                              onChange={(e) => {
                                setFlowAmount(e.target.value);
                                setFlowError('');
                              }}
                              placeholder="Mf. 10000"
                              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-black tabular-nums text-slate-900 focus:outline-none focus:border-[#1fa855]"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              {[5000, 10000, 25000, 50000].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setFlowAmount(String(preset))}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#1fa855] text-[11px] font-bold text-slate-700 tabular-nums cursor-pointer"
                                >
                                  {preset.toLocaleString()}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Note / Bank Name */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 block">
                              {flowActionId === 'send_p2p' && flowChannel === 'BANK'
                                ? 'Jina la Benki (Mf. CRDB / NMB / NBC)'
                                : 'Maelezo / Sababu (Hiari)'}
                            </label>
                            <input
                              type="text"
                              value={flowNote}
                              onChange={(e) => setFlowNote(e.target.value)}
                              placeholder={
                                flowActionId === 'send_p2p' && flowChannel === 'BANK'
                                  ? 'Mf. CRDB Bank'
                                  : 'Mf. Malipo ya bidhaa'
                              }
                              className="w-full min-h-[40px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#1fa855]"
                            />
                          </div>

                          {flowError && (
                            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                              {flowError}
                            </p>
                          )}
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (!flowRecipient.trim() && flowActionId !== 'topup' && flowChannel !== 'WAKALA') {
                                setFlowError('Tafadhali jaza mpokeaji, akaunti au maelezo yanayohitajika.');
                                return;
                              }
                              if (parsedAmt < 100) {
                                setFlowError('Weka kiasi kuanzia TZS 100.');
                                return;
                              }
                              setFlowError('');
                              setFlowScreen('summary');
                            }}
                            className="w-full min-h-[44px] rounded-full bg-[#1fa855] hover:bg-[#199349] text-white font-bold text-sm cursor-pointer"
                          >
                            Endelea (Continue)
                          </button>
                        </div>
                      </>
                    )}

                    {/* SCREEN 3: SUMMARY & PIN CONFIRMATION (Screenshot 3) */}
                    {flowScreen === 'summary' && (
                      <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs">
                            <h6 className="font-black text-sm text-slate-950 pb-2 border-b border-slate-100">
                              Muhtasari wa Muamala
                            </h6>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Huduma</span>
                              <span className="font-bold text-slate-900">{actionLabelMap[flowActionId]}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Njia</span>
                              <span className="font-bold text-slate-900">{flowChannel}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Mpokeaji / Akaunti</span>
                              <span className="font-bold text-slate-900 text-right truncate max-w-[60%]">
                                {flowVerifiedProfile?.found && flowVerifiedProfile.fullName
                                  ? `${flowVerifiedProfile.fullName} (${flowRecipient})`
                                  : flowRecipient || payerPhone || 'PapoWallet'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Kiasi</span>
                              <span className="font-bold text-slate-900 tabular-nums">
                                TZS {parsedAmt.toLocaleString()}/=
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500">Ada ya Muamala</span>
                              <span className="font-bold text-[#1fa855] tabular-nums">
                                TZS {feeAmt.toLocaleString()}/=
                              </span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between text-sm">
                              <span className="font-black text-slate-900">Jumla Kuu</span>
                              <span className="font-black text-slate-950 tabular-nums">
                                TZS {totalAmt.toLocaleString()}/=
                              </span>
                            </div>
                          </div>

                          {requiresPin && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-[#1fa855]" />
                                <span>Ingiza Transaction PIN yako (Tarakimu 4–6)</span>
                              </label>
                              <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={flowPin}
                                onChange={(e) => {
                                  setFlowPin(e.target.value.replace(/\D/g, ''));
                                  setFlowError('');
                                }}
                                placeholder="••••"
                                className="w-full min-h-[44px] px-4 rounded-xl border border-slate-300 text-center text-lg font-black tracking-[0.5em] text-slate-900 focus:outline-none focus:border-[#1fa855]"
                              />
                            </div>
                          )}

                          {flowError && (
                            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                              {flowError}
                            </p>
                          )}
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (requiresPin && !/^\d{4,6}$/.test(flowPin)) {
                                setFlowError('Weka Transaction PIN sahihi (tarakimu 4 hadi 6).');
                                return;
                              }
                              submitInstantPapoPayFlow(
                                {
                                  flow_type: 'papopay_action',
                                  action_id: flowActionId,
                                  channel: flowChannel,
                                  recipient_or_account: flowRecipient.trim() || payerPhone,
                                  amount: parsedAmt,
                                  pin: flowPin || undefined,
                                  note: flowNote.trim() || undefined,
                                },
                                `${actionLabelMap[flowActionId]} • TZS ${parsedAmt.toLocaleString()}`
                              );
                            }}
                            className="w-full min-h-[46px] rounded-full bg-[#1fa855] hover:bg-[#199349] text-white font-bold text-sm shadow-sm cursor-pointer"
                          >
                            Thibitisha & Tuma
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              // FLOW 3: GENERIC / CUSTOMER REGISTRATION FLOW
              return (
                <div className="flex flex-col max-h-[90vh] bg-white text-slate-900">
                  <div className="px-4 py-3.5 bg-[#008069] text-white flex items-center justify-between shrink-0">
                    <div>
                      <h4 className="font-bold text-sm">{sheet.payload?.header?.text || 'Papo Hapo WhatsApp Flow'}</h4>
                      <p className="text-[11px] text-emerald-100">Kamilisha taarifa zako hapa chini</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheet(null)}
                      className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3 overflow-y-auto">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Jina Kamili</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Mf. Juma Mohamed"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Namba ya Simu</label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0712345678"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Lugha</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'sw', label: '🇹🇿 Kiswahili' },
                          { id: 'en', label: '🇬🇧 English' },
                        ].map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setRegLang(l.id as 'sw' | 'en')}
                            className={`min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                              regLang === l.id ? 'bg-[#008069] text-white border-[#008069]' : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        submitInstantPapoPayFlow(
                          { flow_type: 'register', name: regName.trim(), phone: regPhone.trim(), lang: regLang },
                          regName.trim() || 'Thibitisha Taarifa'
                        )
                      }
                      className="w-full min-h-[44px] rounded-full bg-[#008069] hover:bg-[#006b57] text-white font-bold text-sm cursor-pointer"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* B. CHECKOUT FLOW STEP 1: ORDER DETAILS */}
            {sheet.kind === 'checkout' && sheet.step === 'order_details' && (
              <>
                <div className="px-4 py-3.5 bg-[#008069] text-white flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSheet(null)}
                    className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h4 className="font-bold text-sm">Order details</h4>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="text-center pt-1 pb-2 space-y-1.5">
                    <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-[#00a884] to-emerald-700 text-white font-black text-lg flex items-center justify-center shadow-sm">
                      {(sheet.meta.merchantName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-bold text-slate-800">{sheet.meta.merchantName}</p>
                    <p className="text-2xl font-black text-slate-950 tabular-nums">
                      TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Order pending · Order #{sheet.meta.referenceId}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                        {renderThumbnail(undefined, sheet.meta.itemTitle)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{sheet.meta.itemTitle}</p>
                        <p className="text-[11px] text-slate-500">Quantity 1</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-800 tabular-nums shrink-0">
                      TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, step: 'address' })}
                    className="w-full min-h-[54px] rounded-2xl border border-slate-200 hover:bg-slate-50 px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">Delivery / Account details</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {activeAddress ? `${activeAddress.name}, ${activeAddress.address}` : 'Not added'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>

                <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">Total</span>
                    <span className="font-black text-slate-950 tabular-nums">
                      TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, step: 'review' })}
                    className="w-full min-h-[46px] rounded-full bg-[#008069] hover:bg-[#006b57] text-white font-bold text-sm transition-colors cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* B2. PROVIDE ADDRESS STEP */}
            {sheet.kind === 'checkout' && sheet.step === 'address' && (
              <>
                <div className="px-4 py-3.5 bg-[#008069] text-white flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, step: 'order_details' })}
                    className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h4 className="font-bold text-sm">Provide address</h4>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAddAddress((v) => !v)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-dashed border-[#008069]/50 text-[#008069] font-bold text-xs flex items-center gap-2 hover:bg-emerald-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add an address</span>
                  </button>

                  {showAddAddress && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <input
                        type="text"
                        value={newAddrName}
                        onChange={(e) => setNewAddrName(e.target.value)}
                        placeholder="Jina kamili"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={newAddrPhone}
                        onChange={(e) => setNewAddrPhone(e.target.value)}
                        placeholder="Namba ya simu (0712...)"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={newAddrStreet}
                        onChange={(e) => setNewAddrStreet(e.target.value)}
                        placeholder="Mtaa / Eneo (Mf. Sinza Kumekucha)"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                      {checkoutError && <p className="text-[11px] text-red-600 font-semibold">{checkoutError}</p>}
                      <button
                        type="button"
                        onClick={handleSaveNewAddress}
                        className="w-full min-h-[40px] rounded-xl bg-[#008069] text-white font-bold text-xs cursor-pointer"
                      >
                        Hifadhi Anwani
                      </button>
                    </div>
                  )}

                  {addresses.map((addr) => {
                    const active = addr.id === selectedAddressId;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-colors cursor-pointer ${
                          active ? 'border-[#008069] bg-emerald-50/70' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            active ? 'border-[#008069]' : 'border-slate-400'
                          }`}
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-[#008069]" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">{addr.name}</p>
                          <p className="text-[11px] text-slate-600 font-mono">{addr.phone}</p>
                          <p className="text-[11px] text-slate-600 mt-1">{addr.address}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, step: 'order_details' })}
                    className="w-full min-h-[46px] rounded-full bg-[#008069] hover:bg-[#006b57] text-white font-bold text-sm cursor-pointer"
                  >
                    Use this address
                  </button>
                </div>
              </>
            )}

            {/* B3. REVIEW AND PAY & CONFIRM PAYMENT */}
            {sheet.kind === 'checkout' && sheet.step === 'review' && (
              <>
                <div className="px-4 py-3.5 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSheet({ ...sheet, step: 'order_details' })}
                    className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5 text-slate-700" />
                  </button>
                  <h4 className="font-bold text-sm text-slate-900">Review and pay</h4>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">Customer & Delivery</p>
                      <button
                        type="button"
                        onClick={() => setSheet({ ...sheet, step: 'address' })}
                        className="text-[11px] font-bold text-[#008069] hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {activeAddress?.name} · {activeAddress?.address}
                    </p>
                  </div>

                  {/* Payer Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 block">Namba ya Simu ya Mlipaji</label>
                    <input
                      type="tel"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="Mf. 0712345678"
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900"
                    />
                  </div>

                  {/* Payment Method Chooser */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-900">Choose payment method</p>
                    <div className="space-y-1.5">
                      {PAYMENT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = paymentMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPaymentMethod(opt.id)}
                            className={`w-full min-h-[48px] px-3 py-2 rounded-2xl border text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                              active ? 'border-[#008069] bg-emerald-50/70' : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-[#008069] text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{opt.label}</p>
                                <p className="text-[10.5px] text-slate-500 truncate">
                                  {opt.id === 'papowallet'
                                    ? `Salio: TZS ${walletBalance.toLocaleString()}`
                                    : opt.sub}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                active ? 'border-[#008069]' : 'border-slate-300'
                              }`}
                            >
                              {active && <span className="w-2 h-2 rounded-full bg-[#008069]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm Payment Summary Card */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Sent to</span>
                      <span className="font-bold text-slate-900">{sheet.meta.merchantName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Using</span>
                      <span className="font-bold text-slate-900">{activePaymentOption.label}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
                      <span className="font-bold text-slate-800">Total</span>
                      <span className="font-black text-slate-950 tabular-nums">
                        TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {checkoutError && (
                    <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      {checkoutError}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 justify-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#008069]" />
                    <span>Malipo ya PapoPay kupitia WhatsApp ni salama 100%</span>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setCheckoutError('');
                      if (paymentMethod === 'papowallet' || paymentMethod === 'card') {
                        setPinDigits('');
                        setSheet({ ...sheet, step: 'pin' });
                      } else {
                        submitCheckoutPayment();
                      }
                    }}
                    className="w-full min-h-[46px] rounded-full bg-[#008069] hover:bg-[#006b57] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer"
                  >
                    {submitting
                      ? 'Inatuma...'
                      : paymentMethod === 'papowallet' || paymentMethod === 'card'
                      ? 'Send payment'
                      : `Tuma Ombi la ${activePaymentOption.label}`}
                  </button>
                </div>
              </>
            )}

            {/* B4. 4-DIGIT PAPOPAY PIN KEYPAD */}
            {sheet.kind === 'checkout' && sheet.step === 'pin' && (
              <>
                <div className="px-4 py-3 bg-[#0e2a66] text-white flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{sheet.meta.merchantName}</p>
                    <p className="text-[10.5px] text-blue-200">PapoPay Secure PIN</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tabular-nums">
                      TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSheet({ ...sheet, step: 'review' })}
                      className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-white flex flex-col items-center space-y-5">
                  <div className="w-full flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>ENTER PAPOPAY PIN (4–6 DIGITS)</span>
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      className="inline-flex items-center gap-1 text-[#0e2a66] cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPin ? 'HIDE' : 'SHOW'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 py-2">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const char = pinDigits[idx];
                      if (idx >= 4 && pinDigits.length <= 4) return null;
                      return (
                        <div
                          key={idx}
                          className="w-10 h-12 border-b-2 border-slate-400 flex items-center justify-center text-2xl font-black text-slate-900 tabular-nums"
                        >
                          {char ? (showPin ? char : '•') : ''}
                        </div>
                      );
                    })}
                  </div>

                  {checkoutError && (
                    <p className="text-xs text-red-600 font-semibold text-center">{checkoutError}</p>
                  )}

                  {/* Numeric Keypad */}
                  <div className="w-full grid grid-cols-3 gap-2 pt-2 bg-slate-50 p-3 rounded-2xl">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          if (pinDigits.length < 6) {
                            const next = pinDigits + digit;
                            setPinDigits(next);
                            setCheckoutError('');
                          }
                        }}
                        className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-lg font-bold text-[#0e2a66] shadow-xs cursor-pointer"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setPinDigits((p) => p.slice(0, -1))}
                      className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 flex items-center justify-center text-[#0e2a66] shadow-xs cursor-pointer"
                      aria-label="Futa"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        if (pinDigits.length < 6) setPinDigits((p) => p + '0');
                      }}
                      className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-lg font-bold text-[#0e2a66] shadow-xs cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={submitting || pinDigits.length < 4}
                      onClick={() => submitCheckoutPayment(pinDigits)}
                      className="h-12 rounded-xl bg-[#0e2a66] hover:bg-[#143b8c] disabled:opacity-40 active:scale-95 flex items-center justify-center text-white shadow-sm cursor-pointer"
                      aria-label="Thibitisha PIN"
                    >
                      <Check className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* B5. GREEN FULLSCREEN PAID CONFIRMATION */}
            {sheet.kind === 'checkout' && sheet.step === 'success' && (
              <div className="bg-[#00a884] text-white p-6 flex flex-col items-center text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-white text-[#00a884] flex items-center justify-center shadow-lg">
                  <Check className="w-9 h-9 stroke-[3]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-widest font-bold text-emerald-100">
                    {completedResult?.status === 'pending' ? 'USSD Push Sent' : 'Paid successfully'}
                  </p>
                  <p className="text-3xl font-black tabular-nums">
                    TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-50">
                    {completedResult?.status === 'pending'
                      ? `Ingiza PIN kwenye simu ${payerPhone} kukamilisha`
                      : `Paid to ${sheet.meta.merchantName} · #${completedResult?.referenceId || sheet.meta.referenceId}`}
                  </p>
                </div>

                {completedResult?.token && (
                  <div className="w-full rounded-2xl bg-white/15 border border-white/25 p-3 text-xs space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-100">Tokeni ya LUKU</p>
                    <p className="font-mono font-black text-sm tracking-wider">{completedResult.token}</p>
                  </div>
                )}

                {typeof completedResult?.newBalance === 'number' && (
                  <p className="text-xs text-emerald-100 tabular-nums">
                    Salio Jipya la PapoWallet: <strong className="text-white">TZS {completedResult.newBalance.toLocaleString()}</strong>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="w-full min-h-[46px] rounded-full bg-white text-[#008069] font-black text-sm shadow-md hover:bg-emerald-50 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* C. COMPLETED ORDER RECEIPT SHEET ("View details") */}
            {sheet.kind === 'receipt' && (
              <>
                <div className="px-4 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSheet(null)}
                      className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-5 h-5 text-slate-700" />
                    </button>
                    <h4 className="font-bold text-sm text-slate-900">Order details</h4>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#008069]" />
                      <div>
                        <p className="font-bold text-sm text-slate-900">Order completed</p>
                        <p className="text-[11px] text-slate-500">ID #{sheet.meta.referenceId}</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                      {(sheet.meta.merchantName || 'P').slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                    <Wallet className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">Payment details</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Completed via {sheet.meta.methodLabel} · {new Date(sheet.meta.paidAt || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900">Merchant / Service</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{sheet.meta.merchantName}</p>
                    </div>
                  </div>

                  {sheet.meta.token && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-amber-800">Tokeni ya LUKU</p>
                        <p className="font-mono font-black text-sm text-amber-950">{sheet.meta.token}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(String(sheet.meta.token));
                          toast.success('Tokeni imenakiliwa!');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-200/70 text-amber-900 font-bold text-[11px] cursor-pointer"
                      >
                        Nakili
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <p className="font-bold text-slate-900">Order summary (1 item)</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          {renderThumbnail(undefined, sheet.meta.itemTitle)}
                        </div>
                        <span className="font-semibold text-slate-800 truncate">{sheet.meta.itemTitle}</span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0">
                        TZS {Number(sheet.meta.amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span className="tabular-nums">TZS {Number(sheet.meta.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>PapoPay Fee</span>
                        <span className="text-[#008069] font-semibold">FREE</span>
                      </div>
                      <div className="flex justify-between font-black text-xs text-slate-950 pt-1">
                        <span>Total</span>
                        <span className="tabular-nums">TZS {Number(sheet.meta.amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSheet(null);
                      onSelectReply('msaada', 'Need help with my order');
                    }}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Need help with your order?</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
