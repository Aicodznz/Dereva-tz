import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Delete,
  Eye,
  EyeOff,
  ExternalLink,
  HelpCircle,
  List,
  MapPin,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Wallet,
  X,
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
  | { kind: 'checkout'; step: 'order_details' | 'address' | 'review' | 'pin' | 'success'; meta: PapoPayOrderMeta }
  | { kind: 'receipt'; meta: PapoPayOrderMeta };

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

  useEffect(() => {
    if (defaultPhone && (!payerPhone || payerPhone === '0712345678')) {
      setPayerPhone(defaultPhone);
    }
  }, [defaultPhone]);

  if (!interactive || typeof interactive !== 'object') return null;

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
    if ((paymentMethod === 'papowallet' || paymentMethod === 'card') && !/^\d{4}$/.test(pinToUse)) {
      setCheckoutError('Ingiza PIN yako ya tarakimu 4.');
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
                    <span>ENTER PAPOPAY 4-DIGIT PIN</span>
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      className="inline-flex items-center gap-1 text-[#0e2a66] cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPin ? 'HIDE' : 'SHOW'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    {[0, 1, 2, 3].map((idx) => {
                      const char = pinDigits[idx];
                      return (
                        <div
                          key={idx}
                          className="w-11 h-12 border-b-2 border-slate-400 flex items-center justify-center text-2xl font-black text-slate-900 tabular-nums"
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
                          if (pinDigits.length < 4) {
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
                        if (pinDigits.length < 4) setPinDigits((p) => p + '0');
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
