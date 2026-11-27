import React, { useState, useEffect } from 'react';
import { 
  Wallet, QrCode, CreditCard, ArrowUpRight, ArrowDownLeft, 
  Send, Users, Receipt, Zap, ShieldCheck, History, Bus, 
  CheckCircle2, AlertCircle, Copy, Check, ChevronRight, 
  Phone, Sparkles, Lock, RefreshCw, Eye, EyeOff, Plus, 
  Search, ExternalLink, ArrowLeft, Smartphone, Radio, 
  GraduationCap, Bell, Download, Share2, Info, ChevronDown,
  Utensils, Store, Banknote, ShoppingBag, Scissors, Pill, Building2, 
  Flame, MapPin, Coffee, LayoutGrid, Calendar, ArrowLeftRight, 
  Layers, TrendingUp, Gift, Tag, Link2, MessageSquare, Trophy, 
  UserCheck, X, FileText, Globe, Clock, Shield, Sliders, ScanFace, Smile,
  Scan, Activity, UserX, UserPlus, Delete
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { FacePaymentModal } from '../tegex/FacePaymentModal';
import { PapoPayKioskTerminal } from './PapoPayKioskTerminal';
import { PysourceVisionCheckout } from './PysourceVisionCheckout';
import { FaceRegistrationModal } from './FaceRegistrationModal';
import { PapoPayWakalaPOS } from './PapoPayWakalaPOS';
import WhatsAppAIAssistantModal from '../common/WhatsAppAIAssistantModal';
import { PAPO_LIPA_NAMBA, PAPO_LIPA_NAMBA_NAME } from '../../constants/lipaNamba';

export type PapoPayNavSection = 
  | 'overview' 
  | 'add_withdraw' 
  | 'p2p' 
  | 'virtual_cards' 
  | 'subscriptions' 
  | 'wallet_earn' 
  | 'transfer_exchange' 
  | 'remittance' 
  | 'make_payment' 
  | 'vouchers' 
  | 'gift_cards' 
  | 'mobile_recharge' 
  | 'payment_links' 
  | 'history' 
  | 'support';

interface StudentCard {
  id: string;
  studentName: string;
  schoolName: string;
  cardNumber: string;
  balance: number;
  dailyLimit: number;
  status: 'active' | 'frozen';
  avatarColor: string;
  recentTrips: {
    id: string;
    route: string;
    busPlate: string;
    fare: number;
    time: string;
    date: string;
    status: 'completed';
  }[];
}

interface TransactionItem {
  id: string;
  transactionId?: string;
  title: string;
  subtitle: string;
  amount: number;
  fee?: number;
  type: 'debit' | 'credit';
  txType?: string;
  typeLabel?: string;
  category: 'transit' | 'student' | 'bill' | 'transfer' | 'topup' | 'merchant' | 'restaurant' | 'withdraw' | 'deposit' | 'service';
  date: string;
  time: string;
  refCode: string;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  sender?: string;
  recipient?: string;
  paymentMethod?: string;
  externalReference?: string | null;
  meta?: any;
}

interface VerifiedRecipientCard {
  found: boolean;
  uid: string | null;
  displayName: string;
  username: string | null;
  photoURL: string | null;
  walletId: string | null;
  maskedWalletId: string | null;
  phone: string | null;
  verified: boolean;
  matchedBy?: 'username' | 'walletId' | 'phone';
}

interface WalletSettingsPayload {
  transferFeePercent: number;
  transferFeeFlat: number;
  transferFeeMin: number;
  withdrawalFeePercent: number;
  withdrawalFeeMin: number;
  withdrawalMinAmount: number;
  withdrawalMaxAmount: number;
  enabledNetworks: Record<'MPESA' | 'TIGO' | 'AIRTEL' | 'HALOPESA', boolean>;
  b2cProvider?: string;
  daliPayDisbursementApiDisabled?: boolean;
}

export default function PapoPayHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const { language } = useLanguage();

  // Navigation state (supports ?tab=bills alias cleanly)
  const rawTabParam = searchParams.get('tab');
  const initialSection: PapoPayNavSection =
    rawTabParam === 'bills' || rawTabParam === 'luku' || rawTabParam === 'vocha'
      ? 'mobile_recharge'
      : ((rawTabParam as PapoPayNavSection) || 'overview');
  const [activeSection, setActiveSection] = useState<PapoPayNavSection>(initialSection);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    add_withdraw: false,
    p2p: false,
    virtual_cards: false,
    subscriptions: false,
    wallet_earn: false,
    transfer_exchange: false,
    remittance: false,
  });

  // Currency toggle (TZS / USD)
  const [currency, setCurrency] = useState<'TZS' | 'USD'>('TZS');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Linked WhatsApp / Guest phone from ?phone= query param or sessionStorage
  const rawPhoneParam = (searchParams.get('phone') || '').trim();
  const [linkedPhone, setLinkedPhone] = useState<string>(() => {
    const cleanParam = rawPhoneParam.replace(/\D/g, '');
    if (cleanParam.length >= 9) return `+255${cleanParam.slice(-9)}`;
    try {
      const saved = sessionStorage.getItem('papopay_linked_phone') || '';
      if (saved.replace(/\D/g, '').length >= 9) return saved;
    } catch {}
    return '';
  });
  const [linkedPhoneInput, setLinkedPhoneInput] = useState('');
  const [isSyncingLinkedWallet, setIsSyncingLinkedWallet] = useState(false);
  const [linkedWalletInfo, setLinkedWalletInfo] = useState<{
    found: boolean;
    uid?: string | null;
    walletId?: string;
    displayName?: string | null;
    phone?: string | null;
  } | null>(null);

  useEffect(() => {
    const cleanParam = rawPhoneParam.replace(/\D/g, '');
    if (cleanParam.length >= 9) {
      const canonical = `+255${cleanParam.slice(-9)}`;
      setLinkedPhone(canonical);
      try {
        sessionStorage.setItem('papopay_linked_phone', canonical);
      } catch {}
    }
  }, [rawPhoneParam]);

  // Balance state synced with Firestore profile or live API (never fake stale localStorage when unauthenticated)
  const [balanceTZS, setBalanceTZS] = useState<number>(() => {
    if (typeof profile?.walletBalance === 'number') return profile.walletBalance;
    return 0;
  });
  const [reservedBalanceTZS, setReservedBalanceTZS] = useState<number>(() => {
    if (typeof profile?.reservedBalance === 'number') return profile.reservedBalance;
    return 0;
  });
  const [usernameHandle, setUsernameHandle] = useState<string | null>(() =>
    profile?.username ? `@${String(profile.username).replace(/^@+/, '')}` : null
  );
  const [hasPinSet, setHasPinSet] = useState<boolean>(() => Boolean(profile?.hasPinSet));
  const [walletSettings, setWalletSettings] = useState<WalletSettingsPayload>({
    transferFeePercent: 0,
    transferFeeFlat: 0,
    transferFeeMin: 0,
    withdrawalFeePercent: 0.2,
    withdrawalFeeMin: 100,
    withdrawalMinAmount: 1000,
    withdrawalMaxAmount: 5000000,
    enabledNetworks: { MPESA: true, TIGO: true, AIRTEL: true, HALOPESA: true },
  });

  const [coinsBalance, setCoinsBalance] = useState<number>(() => {
    if (typeof profile?.points === 'number') return profile.points;
    return 0;
  });

  const [showBalance, setShowBalance] = useState(true);
  const [isKycBannerVisible, setIsKycBannerVisible] = useState(true);

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityUsernameInput, setSecurityUsernameInput] = useState('');
  const [securityNewPin, setSecurityNewPin] = useState('');
  const [securityCurrentPin, setSecurityCurrentPin] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Clear legacy fake demo balance/transactions cache if user is not authenticated
  useEffect(() => {
    if (!user?.uid) {
      try {
        localStorage.removeItem('papopay_wallet_balance');
        localStorage.removeItem('papopay_coins_balance');
        localStorage.removeItem('papopay_transactions');
      } catch {}
    }
  }, [user?.uid]);

  const syncWalletFromServer = React.useCallback(
    async (phoneStr: string, uidStr?: string) => {
      const digits = String(phoneStr || '').replace(/\D/g, '');
      if (digits.length < 9 && !uidStr) return;
      setIsSyncingLinkedWallet(true);
      try {
        const qs = new URLSearchParams();
        if (digits.length >= 9) qs.set('phone', digits);
        if (uidStr) qs.set('uid', uidStr);
        const resp = await fetch(`/api/payments/papopay-wallet-balance?${qs.toString()}`);
        const json = await resp.json().catch(() => null);
        if (!json) return;

        setLinkedWalletInfo({
          found: Boolean(json.found),
          uid: json.uid || null,
          walletId: json.walletId || (digits.length >= 9 ? `PP${digits.slice(-7)}` : ''),
          displayName: json.displayName || null,
          phone: json.phone || (digits.length >= 9 ? `+255${digits.slice(-9)}` : null),
        });

        if (typeof json.reservedBalance === 'number') {
          setReservedBalanceTZS(Number(json.reservedBalance || 0));
        }
        if (json.username) {
          setUsernameHandle(String(json.username));
        }
        if (typeof json.hasPinSet === 'boolean') {
          setHasPinSet(json.hasPinSet);
        }

        if (!uidStr || (Number(json.walletBalance || 0) > 0 && Number(profile?.walletBalance || 0) === 0)) {
          setBalanceTZS(Number(json.walletBalance || 0));
          setCoinsBalance(Number(json.points || 0));
        }

        // Fetch unified 8-type ledger alongside summary
        const txResp = await fetch(`/api/wallet/transactions?${qs.toString()}&limit=60`).catch(() => null);
        const txJson = txResp ? await txResp.json().catch(() => null) : null;
        const serverRows = Array.isArray(txJson?.transactions) && txJson.transactions.length > 0
          ? txJson.transactions
          : Array.isArray(json.transactions)
          ? json.transactions
          : [];

        if (serverRows.length > 0) {
          const mapped: TransactionItem[] = serverRows.map((t: any) => {
            const ms = Number(t.createdAtMs || Date.parse(String(t.createdAt || '')) || 0);
            const dt = ms ? new Date(ms) : new Date();
            return {
              id: String(t.id || `tx_${ms}`),
              transactionId: String(t.transactionId || t.refCode || t.id),
              title: String(t.title || t.typeLabel || 'Muamala wa PapoPay'),
              subtitle: String(t.subtitle || 'PAPOWALLET • COMPLETED'),
              amount: Number(t.amount || 0),
              fee: Number(t.fee || 0),
              type: t.direction === 'credit' || t.type === 'credit' ? 'credit' : 'debit',
              txType: t.type && typeof t.type === 'string' && t.type !== 'credit' && t.type !== 'debit' ? t.type : t.txType,
              typeLabel: t.typeLabel || undefined,
              category: t.txType === 'WALLET_DEPOSIT' ? 'deposit' : t.txType?.includes('WITHDRAWAL') ? 'withdraw' : 'transfer',
              date: dt.toLocaleDateString(),
              time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              refCode: t.transactionId || t.refCode ? `TRX: ${t.transactionId || t.refCode}` : 'TRX: PAPO',
              status:
                t.status === 'failed'
                  ? 'failed'
                  : t.status === 'processing'
                  ? 'processing'
                  : t.status === 'pending'
                  ? 'pending'
                  : 'completed',
              sender: t.sender || undefined,
              recipient: t.recipient || undefined,
              paymentMethod: t.paymentMethod || 'PapoPay Wallet',
              externalReference: t.externalReference || null,
              meta: { createdMs: ms },
            };
          });
          setTransactions((prev) => {
            const seen = new Set(mapped.map((r) => r.transactionId || r.id));
            return [...mapped, ...prev.filter((p) => !seen.has(p.transactionId || p.id))]
              .sort((a, b) => Number(b.meta?.createdMs || 0) - Number(a.meta?.createdMs || 0))
              .slice(0, 80);
          });
        } else if (!uidStr) {
          setTransactions([]);
        }
      } catch {
      } finally {
        setIsSyncingLinkedWallet(false);
      }
    },
    [profile?.walletBalance]
  );

  // Load Treasury settings (fees & enabled mobile money networks)
  useEffect(() => {
    fetch('/api/wallet/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json?.settings) {
          setWalletSettings(json.settings);
        }
      })
      .catch(() => {});
  }, []);

  // Sync WhatsApp / phone wallet when not signed in with Firebase Auth
  useEffect(() => {
    if (user?.uid) return;
    if (linkedPhone.replace(/\D/g, '').length >= 9) {
      syncWalletFromServer(linkedPhone);
    } else {
      setBalanceTZS(0);
      setReservedBalanceTZS(0);
      setCoinsBalance(0);
      setLinkedWalletInfo(null);
      setTransactions([]);
    }
  }, [user?.uid, linkedPhone, syncWalletFromServer]);

  // Live Firestore sync for logged-in user's PapoWallet, reservedBalance, username, PIN & points
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as any;
        const bal = typeof d.walletBalance === 'number' ? d.walletBalance : 0;
        setBalanceTZS(bal);
        setReservedBalanceTZS(typeof d.reservedBalance === 'number' ? d.reservedBalance : 0);
        if (d.username) {
          setUsernameHandle(`@${String(d.username).replace(/^@+/, '')}`);
        }
        setHasPinSet(Boolean(d.walletPinHash || d.walletPin || d.pin));
        if (typeof d.points === 'number') {
          setCoinsBalance(d.points);
        }
        const phoneToCheck = d.phoneNumber || d.phone || linkedPhone;
        syncWalletFromServer(phoneToCheck || '', user.uid);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid, linkedPhone, syncWalletFromServer]);

  // Modals state
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionItem | null>(null);
  const [isRegisterStudentModalOpen, setIsRegisterStudentModalOpen] = useState(false);

  // Top Up form state
  const [topUpAmount, setTopUpAmount] = useState('25000');
  const [topUpMethod, setTopUpMethod] = useState<'lipanamba' | 'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | 'card'>('lipanamba');
  const [topUpPhone, setTopUpPhone] = useState(
    profile?.phoneNumber || profile?.phone || linkedPhone || ''
  );
  const [topUpLipaRef, setTopUpLipaRef] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [topUpStatusNote, setTopUpStatusNote] = useState('');

  useEffect(() => {
    const p = profile?.phoneNumber || profile?.phone || linkedPhone;
    if (p && !topUpPhone) {
      setTopUpPhone(p);
    }
  }, [profile?.phoneNumber, profile?.phone, linkedPhone]);

  // NFC & Face Payment Interactive state
  const [nfcSubCategory, setNfcSubCategory] = useState<'restaurant' | 'services' | 'transit' | 'face' | 'vision_checkout'>('restaurant');
  const [isFacePayModalOpen, setIsFacePayModalOpen] = useState(false);
  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);
  const [isVisionCheckoutOpen, setIsVisionCheckoutOpen] = useState(false);
  const [isWakalaModalOpen, setIsWakalaModalOpen] = useState(false);
  const [isFaceIdActive, setIsFaceIdActive] = useState(true);
  const [isFaceRegistered, setIsFaceRegistered] = useState(() => {
    if (profile?.hasFaceEnrolled) return true;
    try {
      const stored = localStorage.getItem('papopay_registered_face');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed.isEnrolled);
      }
    } catch {}
    return false;
  });
  const [isFaceRegisterModalOpen, setIsFaceRegisterModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.hasFaceEnrolled) {
      setIsFaceRegistered(true);
    }
  }, [profile?.hasFaceEnrolled]);

  // WhatsApp Assistant & Express /pay Deep-Link Checkout State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [expressCheckoutOpen, setExpressCheckoutOpen] = useState(false);
  const [expressStep, setExpressStep] = useState<'review' | 'pin' | 'paid'>('review');
  const [expressRecipientPhone, setExpressRecipientPhone] = useState('');
  const [expressRecipientName, setExpressRecipientName] = useState('PapoPay Merchant');
  const [expressAmount, setExpressAmount] = useState<number>(0);
  const [expressRef, setExpressRef] = useState('');
  const [expressOrderId, setExpressOrderId] = useState('');
  const [expressTitle, setExpressTitle] = useState('Malipo ya PapoPay');
  const [expressPurpose, setExpressPurpose] = useState('pay_vendor');
  const [expressBuyerPhone, setExpressBuyerPhone] = useState(
    profile?.phoneNumber || profile?.phone || user?.phoneNumber || linkedPhone || ''
  );
  const [expressMethod, setExpressMethod] = useState<
    'papowallet' | 'lipanamba' | 'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | 'card'
  >('papowallet');
  const [expressLipaRef, setExpressLipaRef] = useState('');
  const [expressPin, setExpressPin] = useState('');
  const [expressSubmitting, setExpressSubmitting] = useState(false);
  const [expressError, setExpressError] = useState('');
  const [expressReceipt, setExpressReceipt] = useState<{
    referenceId: string;
    amount: number;
    merchantName: string;
    methodLabel: string;
    status: 'paid' | 'pending' | 'pending_admin_confirm';
    token?: string | null;
    cashbackPoints?: number;
    message?: string;
  } | null>(null);

  // Enhanced Payment Link Creator & WhatsApp Checkout Template State
  const [isPayLinkModalOpen, setIsPayLinkModalOpen] = useState(false);
  const [payLinkTitle, setPayLinkTitle] = useState('');
  const [payLinkAmount, setPayLinkAmount] = useState('15000');
  const [payLinkCustomerPhone, setPayLinkCustomerPhone] = useState('');
  const [payLinkCreating, setPayLinkCreating] = useState(false);
  const [createdPayLink, setCreatedPayLink] = useState<{
    refCode: string;
    checkoutUrl: string;
    title: string;
    amount: number;
    whatsappSent?: boolean;
  } | null>(null);

  useEffect(() => {
    const p = profile?.phoneNumber || profile?.phone || user?.phoneNumber || linkedPhone || '';
    if (p && !expressBuyerPhone) {
      setExpressBuyerPhone(p);
    }
  }, [profile?.phoneNumber, profile?.phone, user?.phoneNumber, linkedPhone, expressBuyerPhone]);

  useEffect(() => {
    const amountRaw = Number(searchParams.get('amount') || 0);
    const toParam = (searchParams.get('to') || '').trim();
    const nameParam = (searchParams.get('name') || '').trim();
    const refParam = (searchParams.get('ref') || '').trim();
    const orderIdParam = (searchParams.get('orderId') || '').trim();
    const titleParam = (searchParams.get('title') || '').trim();
    const purposeParam = (searchParams.get('purpose') || '').trim();
    const modeParam = (searchParams.get('mode') || '').trim();

    let cancelled = false;

    if (
      Number.isFinite(amountRaw) &&
      amountRaw >= 100 &&
      (toParam || nameParam || refParam || modeParam === 'whatsapp')
    ) {
      setExpressAmount(Math.round(amountRaw));
      setExpressRecipientPhone(toParam);
      setExpressRecipientName(nameParam || toParam || 'PapoPay Merchant');
      setExpressRef(refParam || `PP-${Math.floor(100000 + Math.random() * 899999)}`);
      setExpressOrderId(orderIdParam);
      setExpressTitle(titleParam || `Malipo kwenda ${nameParam || toParam || 'PapoPay'}`);
      setExpressPurpose(purposeParam || 'pay_vendor');
      setExpressStep('review');
      setExpressPin('');
      setExpressError('');
      setExpressReceipt(null);
      setExpressCheckoutOpen(true);
    }

    // Resolve Enhanced Payment Link by ?ref=... (works even without ?amount= in query string)
    if (refParam) {
      fetch(`/api/payments/payment-link/${encodeURIComponent(refParam)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok || !data?.link) return;
          const link = data.link;
          setExpressAmount(Number(link.amount || amountRaw || 0));
          setExpressRecipientPhone(link.merchantPhone || toParam || '');
          setExpressRecipientName(link.merchantName || nameParam || 'PapoPay Merchant');
          setExpressRef(link.refCode || refParam);
          setExpressOrderId(link.orderId || orderIdParam || '');
          setExpressTitle(link.title || titleParam || 'Malipo ya PapoPay');
          setExpressPurpose(link.purpose || purposeParam || 'payment_request');
          setExpressError('');
          if (link.status === 'paid') {
            setExpressReceipt({
              referenceId: link.refCode || refParam,
              amount: Number(link.amount || 0),
              merchantName: link.merchantName || 'PapoPay Merchant',
              methodLabel: link.paidMethod || 'PapoPay',
              status: 'paid',
              message: 'Link hii ya malipo imeshalipwa tayari ✅',
            });
            setExpressStep('paid');
          } else {
            setExpressReceipt(null);
            setExpressStep('review');
          }
          setExpressCheckoutOpen(true);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleCreateEnhancedPaymentLink = async (sendToWhatsApp: boolean) => {
    const cleanAmt = Math.max(0, Math.round(Number(String(payLinkAmount || '0').replace(/\D/g, '')) || 0));
    if (cleanAmt < 100) {
      toast.error('Weka kiasi kuanzia TZS 100.');
      return;
    }
    const cleanTitle = payLinkTitle.trim() || 'Ombi la Malipo PapoPay';
    const merchantName = profile?.displayName || profile?.fullName || user?.displayName || 'Mteja wa PapoPay';
    const merchantPhone = profile?.phoneNumber || profile?.phone || user?.phoneNumber || linkedPhone || '';
    const custPhone = payLinkCustomerPhone.trim();

    if (sendToWhatsApp && custPhone.replace(/\D/g, '').length < 9) {
      toast.error('Weka namba ya WhatsApp ya mteja unayemtumia ombi.');
      return;
    }

    setPayLinkCreating(true);
    try {
      if (sendToWhatsApp) {
        const res = await fetch('/api/payments/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTitle,
            amount: cleanAmt,
            merchantName,
            merchantPhone,
            purpose: 'payment_request',
            sendToWhatsapp: custPhone,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data.error || 'Imeshindikana kutuma link kwenda WhatsApp.');
          return;
        }
        setCreatedPayLink({
          refCode: data.link?.refCode || '',
          checkoutUrl: data.link?.checkoutUrl || '',
          title: cleanTitle,
          amount: cleanAmt,
          whatsappSent: Boolean(data.whatsappDispatched),
        });
        toast.success(
          data.whatsappDispatched
            ? 'Enhanced Payment Link imeundwa na kutumwa WhatsApp!'
            : 'Enhanced Payment Link imeundwa! Nakili link hapa chini.'
        );
      } else {
        const res = await fetch('/api/payments/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTitle,
            amount: cleanAmt,
            merchantName,
            merchantPhone,
            purpose: 'payment_request',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(data.error || 'Imeshindikana kuunda link ya malipo.');
          return;
        }
        setCreatedPayLink({
          refCode: data.link.refCode,
          checkoutUrl: data.link.checkoutUrl,
          title: cleanTitle,
          amount: cleanAmt,
        });
        toast.success(`Link ya malipo #${data.link.refCode} imeundwa!`);
      }
    } catch {
      toast.error('Hitilafu ya mtandao wakati wa kuunda link.');
    } finally {
      setPayLinkCreating(false);
    }
  };

  const handleExpressCheckoutSubmit = async (pinOverride?: string) => {
    const cleanPhone = expressBuyerPhone.trim();
    if (cleanPhone.replace(/\D/g, '').length < 9) {
      setExpressError('Weka namba sahihi ya simu ya mlipaji (mf. 0712345678).');
      return;
    }

    const needsPin = expressMethod === 'papowallet' || expressMethod === 'card';
    const activePin = (pinOverride ?? expressPin).trim();
    if (needsPin && !/^\d{4,6}$/.test(activePin)) {
      setExpressError('Ingiza PIN yako ya tarakimu 4 hadi 6.');
      return;
    }

    setExpressSubmitting(true);
    setExpressError('');
    try {
      const resp = await fetch('/api/payments/papopay-whatsapp-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: expressAmount,
          method: expressMethod,
          buyerPhone: cleanPhone,
          payerName: profile?.displayName || profile?.fullName || user?.displayName || 'Mteja wa PapoPay',
          recipientName: expressRecipientName,
          recipientPhone: expressRecipientPhone,
          title: expressTitle,
          purpose: expressPurpose,
          orderId: expressOrderId,
          referenceId: expressRef,
          pin: needsPin ? activePin : undefined,
          transactionRef: expressMethod === 'lipanamba' ? expressLipaRef.trim() || undefined : undefined,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        setExpressError(json?.error || json?.message || 'Malipo yameshindikana. Hakiki taarifa zako.');
        setExpressSubmitting(false);
        return;
      }

      if (typeof json.newBalance === 'number' && !user?.uid) {
        setBalanceTZS(json.newBalance);
      } else if (json.status === 'paid' && !user?.uid) {
        setBalanceTZS((prev) => Math.max(0, prev - expressAmount));
      }
      if (typeof json.cashbackPoints === 'number' && !user?.uid) {
        setCoinsBalance((prev) => prev + json.cashbackPoints);
      }

      const mappedStatus: 'paid' | 'pending' | 'pending_admin_confirm' =
        json.status === 'paid'
          ? 'paid'
          : json.status === 'pending_admin_confirm'
          ? 'pending_admin_confirm'
          : 'pending';

      const newTx: TransactionItem = {
        id: `tx_wa_${Date.now()}`,
        title: `${expressTitle} (${json.merchantName || expressRecipientName})`,
        subtitle: json.token
          ? `TOKEN: ${json.token} • ${json.methodLabel || expressMethod.toUpperCase()}`
          : `${json.methodLabel || expressMethod.toUpperCase()} • ${
              mappedStatus === 'paid'
                ? 'COMPLETED'
                : mappedStatus === 'pending_admin_confirm'
                ? `INASUBIRI ADMIN (Lipa Namba ${PAPO_LIPA_NAMBA})`
                : 'PENDING USSD'
            }`,
        amount: expressAmount,
        type: 'debit',
        category: expressPurpose === 'pay_bill' ? 'bill' : 'merchant',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: ${json.referenceId || expressRef}`,
        status: mappedStatus === 'paid' ? 'completed' : 'pending',
      };
      setTransactions((prev) => [newTx, ...prev]);

      setExpressReceipt({
        referenceId: json.referenceId || expressRef,
        amount: expressAmount,
        merchantName: json.merchantName || expressRecipientName,
        methodLabel: json.methodLabel || expressMethod.toUpperCase(),
        status: mappedStatus,
        token: json.token || null,
        cashbackPoints: json.cashbackPoints || 0,
        message: json.message,
      });
      setExpressStep('paid');
      toast.success(
        mappedStatus === 'paid'
          ? `TZS ${expressAmount.toLocaleString()} zimelipwa kikamilifu!`
          : mappedStatus === 'pending_admin_confirm'
          ? `Taarifa ya Lipa Namba ${PAPO_LIPA_NAMBA} imetumwa kwa Admin kuthibitishwa!`
          : 'Ombi la malipo limetumwa kwenye simu yako!'
      );
    } catch (err: any) {
      setExpressError('Hitilafu ya mtandao: ' + (err?.message || 'Jaribu tena.'));
    } finally {
      setExpressSubmitting(false);
    }
  };
  const [faceDailyLimit, setFaceDailyLimit] = useState(500000);
  const [facePayTarget, setFacePayTarget] = useState<{ amount: number; recipient: string; service: string }>({
    amount: 25500,
    recipient: 'Papo Hapo Ocean View Grill',
    service: 'Meza No. 04 - Chakula'
  });

  const speakVoicePrompt = (text: string) => {
    if (typeof window === 'undefined') return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'sw-TZ';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  const handleTriggerFacePayment = (target: { amount: number; recipient: string; service: string }) => {
    setFacePayTarget(target);
    if (!isFaceRegistered) {
      speakVoicePrompt("Uso wako haujasajiliwa kwenye PapoPay. Tafadhali jisajili uso wako kwanza.");
      toast.error("Uso haujasajiliwa! Tafadhali sajili uso wako kwenye PapoPay kwanza ili kulipa.", { icon: '⚠️' });
      setIsFaceRegisterModalOpen(true);
      return;
    }
    setIsFacePayModalOpen(true);
  };
  const [isNfcPayingRestaurant, setIsNfcPayingRestaurant] = useState(false);
  const [isNfcWithdrawing, setIsNfcWithdrawing] = useState(false);
  const [isNfcDepositing, setIsNfcDepositing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('50000');
  const [withdrawPhone, setWithdrawPhone] = useState(profile?.phoneNumber || profile?.phone || '');
  const [withdrawMode, setWithdrawMode] = useState<'mobile_money' | 'wakala'>('mobile_money');
  const [withdrawNetwork, setWithdrawNetwork] = useState<'MPESA' | 'TIGO' | 'AIRTEL' | 'HALOPESA'>('MPESA');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [isMobileWithdrawing, setIsMobileWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('Wakala Mussa Telecomm (Kariakoo Sokoni)');

  // Transfer & P2P State ("Send Money to PapoPay User")
  const [transferRecipient, setTransferRecipient] = useState('');
  const [lookupResult, setLookupResult] = useState<VerifiedRecipientCard | null>(null);
  const [isLookingUpRecipient, setIsLookingUpRecipient] = useState(false);
  const [transferAmount, setTransferAmount] = useState('10000');
  const [transferNote, setTransferNote] = useState('');
  const [transferPin, setTransferPin] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Split Fare Calculator state
  const [splitTotal, setSplitTotal] = useState('12000');
  const [splitPeople, setSplitPeople] = useState('4');

  // LUKU, Bills (DAWASA / King'amuzi) & Vocha Unified State
  const [savedBillAccounts, setSavedBillAccounts] = useState<Array<{ label: string; kind: 'luku' | 'dawasa' | 'tv' | 'vocha'; account: string }>>(() => {
    try {
      const raw = localStorage.getItem('papopay_saved_bills');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { label: '⚡ Mita Nyumbani', kind: 'luku', account: '14285930219' },
      { label: '💧 Maji DAWASA', kind: 'dawasa', account: 'DW-4409128' },
      { label: '📺 AzamTV', kind: 'tv', account: '402918374' },
    ];
  });
  const saveBillAccountToMemory = (kind: 'luku' | 'dawasa' | 'tv' | 'vocha', account: string, label: string) => {
    const clean = account.trim();
    if (!clean) return;
    setSavedBillAccounts((prev) => {
      const next = [
        { label, kind, account: clean },
        ...prev.filter((item) => !(item.kind === kind && item.account === clean)),
      ].slice(0, 6);
      try {
        localStorage.setItem('papopay_saved_bills', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [lukuMeter, setLukuMeter] = useState('14285930219');
  const [lukuAmount, setLukuAmount] = useState('20000');
  const [generatedLukuToken, setGeneratedLukuToken] = useState<string | null>(null);
  const [isBuyingLuku, setIsBuyingLuku] = useState(false);

  const [utilityProvider, setUtilityProvider] = useState<'DAWASA' | 'AzamTV' | 'DStv' | 'StarTimes'>('DAWASA');
  const [utilityAccount, setUtilityAccount] = useState('DW-4409128');
  const [utilityAmount, setUtilityAmount] = useState('15000');
  const [isPayingUtility, setIsPayingUtility] = useState(false);
  const [lastUtilityReceipt, setLastUtilityReceipt] = useState<TransactionItem | null>(null);

  const [vochaNetwork, setVochaNetwork] = useState<'Vodacom' | 'Tigo' | 'Airtel' | 'Halotel'>('Vodacom');
  const [vochaPhone, setVochaPhone] = useState(profile?.phoneNumber || profile?.phone || '0754123456');
  const [vochaAmount, setVochaAmount] = useState('2000');
  const [isBuyingVocha, setIsBuyingVocha] = useState(false);
  const [lastVochaMsg, setLastVochaMsg] = useState<string | null>(null);

  // Virtual Card State
  const [isCardFrozen, setIsCardFrozen] = useState(false);
  const [showCardCvv, setShowCardCvv] = useState(false);
  const [cardDailyLimit, setCardDailyLimit] = useState(500000);

  // Student Smart Cards State
  const [studentCards, setStudentCards] = useState<StudentCard[]>(() => {
    try {
      const saved = localStorage.getItem('papopay_student_cards');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'std_01',
        studentName: 'Baraka Juma Mkuki',
        schoolName: 'Shule ya Sekondari Azania (Form 3)',
        cardNumber: 'TZ-STD-99042',
        balance: 4200,
        dailyLimit: 800,
        status: 'active',
        avatarColor: 'from-blue-600 to-indigo-700',
        recentTrips: [
          {
            id: 'trip_1',
            route: 'Mbagala Rangi Tatu ➔ Posta Mpya',
            busPlate: 'T 342 DFP (Daladala)',
            fare: 200,
            time: 'Leo, Saa 07:15 Asubuhi',
            date: '09 Okt 2026',
            status: 'completed'
          },
          {
            id: 'trip_2',
            route: 'Posta Mpya ➔ Mbagala Rangi Tatu',
            busPlate: 'T 512 EBB (Daladala)',
            fare: 200,
            time: 'Jana, Saa 04:30 Jioni',
            date: '08 Okt 2026',
            status: 'completed'
          }
        ]
      },
      {
        id: 'std_02',
        studentName: 'Fatma Ally Rashid',
        schoolName: 'Shule ya Msingi Bunge (Dar)',
        cardNumber: 'TZ-STD-77819',
        balance: 2600,
        dailyLimit: 600,
        status: 'active',
        avatarColor: 'from-pink-600 to-rose-700',
        recentTrips: [
          {
            id: 'trip_3',
            route: 'Kariakoo Gerezani ➔ Buguruni Rozana',
            busPlate: 'T 119 CSG (Daladala)',
            fare: 200,
            time: 'Leo, Saa 06:50 Asubuhi',
            date: '09 Okt 2026',
            status: 'completed'
          }
        ]
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('papopay_student_cards', JSON.stringify(studentCards));
    } catch {}
  }, [studentCards]);

  // Transactions State (live Firestore only; no fake hardcoded demo history)
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Subscribe to live Firestore payment history for current user (syncs WhatsApp & App top-ups/payments)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'payments'), where('uid', '==', user.uid), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) return;
        const dbRows: TransactionItem[] = snap.docs
          .map((d) => {
            const p = d.data() as any;
            const createdMs =
              Number(p.createdAtMs || 0) ||
              (typeof p.createdAt?.toMillis === 'function' ? p.createdAt.toMillis() : Date.parse(String(p.createdAt || '')) || 0);
            const dt = createdMs ? new Date(createdMs) : new Date();
            return {
              id: d.id,
              title: p.title || 'Muamala wa PapoPay',
              subtitle: p.subtitle || 'PAPOWALLET • COMPLETED',
              amount: Number(p.amount || 0),
              type: p.type === 'debit' ? 'debit' : 'credit',
              category: p.category || 'topup',
              date: dt.toLocaleDateString(),
              time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              refCode: p.refCode ? `TRX: ${p.refCode}` : `TRX: ${d.id.slice(-8).toUpperCase()}`,
              status: p.status === 'pending' ? 'pending' : 'completed',
              meta: { createdMs },
            } as TransactionItem;
          })
          .sort((a, b) => Number(b.meta?.createdMs || 0) - Number(a.meta?.createdMs || 0));

        setTransactions((prev) => {
          const seen = new Set(dbRows.map((r) => r.id));
          const merged = [...dbRows, ...prev.filter((p) => !seen.has(p.id))];
          return merged.slice(0, 60);
        });
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid]);

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  // Currency Converter helper
  const formatAmount = (amtTZS: number) => {
    if (currency === 'USD') {
      const inUSD = (amtTZS / 2600).toFixed(2);
      return `$${Number(inUSD).toLocaleString()}`;
    }
    return `TZS ${amtTZS.toLocaleString()}`;
  };

  // Top Up Handler via Lipa Namba 5656565 (Admin Confirm) or Mongike Mobile Money USSD Push
  const handleExecuteTopUp = async () => {
    const val = Math.round(Number(topUpAmount));
    const cleanPhone = topUpPhone.trim();
    if (!val || val < 500) {
      toast.error('Tafadhali ingiza kiasi sahihi kuanzia TZS 500.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 9) {
      toast.error('Tafadhali weka namba sahihi ya simu ya Tanzania (mf. 0712345678).');
      return;
    }

    const isLipaNamba = topUpMethod === 'lipanamba';
    const cleanLipaRef = topUpLipaRef.trim();
    const depositCode = `WT-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsProcessingTopUp(true);
    setTopUpStatusNote(
      isLipaNamba
        ? `Inatuma taarifa ya Lipa Namba ${PAPO_LIPA_NAMBA} kwa Admin kuthibitisha...`
        : 'Inatuma ombi la Mongike USSD Push kwenye simu yako...'
    );

    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        bookingCode: depositCode,
        customerId: user?.uid || `web-${cleanPhone.replace(/\D/g, '')}`,
        payerUid: user?.uid || null,
        customerName: profile?.displayName || profile?.fullName || user?.displayName || 'Mteja wa PapoPay',
        customerPhone: cleanPhone,
        vendorId: 'papopay-wallet',
        vendorName: 'PapoWallet Deposit',
        service: 'PapoWallet TopUp',
        orderType: 'wallet_topup',
        paymentPurpose: 'wallet_topup',
        paymentMethod: isLipaNamba ? 'lipanamba' : topUpMethod === 'card' ? 'mongike' : topUpMethod,
        paymentMethodLabel: isLipaNamba
          ? `Lipa Namba ${PAPO_LIPA_NAMBA} (${PAPO_LIPA_NAMBA_NAME})`
          : `Mongike (${topUpMethod.toUpperCase()})`,
        ...(isLipaNamba
          ? {
              lipaNambaNumber: PAPO_LIPA_NAMBA,
              lipaNambaName: PAPO_LIPA_NAMBA_NAME,
              lipaNambaRef: cleanLipaRef || null,
              customerReportedPaid: true,
              paymentPushStatus: 'awaiting_admin_confirm',
              skipAutoMongikePush: true,
            }
          : {}),
        paymentStatus: 'pending',
        status: 'pending',
        totalAmount: val,
        subtotal: val,
        items: [{ name: 'Weka Pesa PapoWallet', price: val, quantity: 1 }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (isLipaNamba) {
        await addDoc(collection(db, 'notifications'), {
          type: 'lipa_namba_confirm',
          title: `Lipa Namba ${PAPO_LIPA_NAMBA}: TZS ${val.toLocaleString()} (#${depositCode})`,
          message: `${profile?.displayName || cleanPhone} ametuma taarifa za kuweka TZS ${val.toLocaleString()}/= kupitia Lipa Namba ${PAPO_LIPA_NAMBA}.${cleanLipaRef ? ` Kumbukumbu: ${cleanLipaRef}` : ''}`,
          orderId: orderRef.id,
          bookingCode: depositCode,
          amount: val,
          customerPhone: cleanPhone,
          lipaNambaRef: cleanLipaRef || null,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});

        setTopUpStatusNote(
          `Taarifa #${depositCode} imetumwa! Inasubiri Admin athibitishe malipo ya Lipa Namba ${PAPO_LIPA_NAMBA}...`
        );
        toast.info(`Taarifa #${depositCode} imepokelewa! Admin anathibitisha malipo yako.`);
      } else {
        const resp = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderRef.id,
            amount: val,
            buyer_phone: cleanPhone,
            fee_payer: 'CUSTOMER',
            collection: 'orders',
          }),
        });
        const json = await resp.json().catch(() => ({}));

        if (!resp.ok || json.status === 'error') {
          setIsProcessingTopUp(false);
          setTopUpStatusNote('');
          toast.error(json?.message || 'Mongike imekataa ombi la malipo. Tumia Lipa Namba 5656565.');
          return;
        }

        setTopUpStatusNote(
          json.sandbox
            ? 'Ombi la majaribio (Sandbox) limetumwa! Inasubiri uthibitisho wa malipo...'
            : 'USSD Push imetumwa! Ingiza PIN kwenye simu yako kukamilisha.'
        );
        toast.info('Ombi la malipo limetumwa kwenye simu yako! Ingiza PIN kukamilisha.');
      }

      let unsubWatch: (() => void) | null = null;
      const timeoutHandle = window.setTimeout(() => {
        if (unsubWatch) unsubWatch();
        setIsProcessingTopUp(false);
        setTopUpStatusNote('');
      }, isLipaNamba ? 180000 : 90000);

      unsubWatch = onSnapshot(
        doc(db, 'orders', orderRef.id),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data() as any;
          if (String(d.paymentStatus || '').toLowerCase() === 'paid') {
            window.clearTimeout(timeoutHandle);
            if (unsubWatch) unsubWatch();
            if (!user?.uid) {
              const cleanDigits = cleanPhone.replace(/\D/g, '');
              if (cleanDigits.length >= 9) {
                const canonical = `+255${cleanDigits.slice(-9)}`;
                setLinkedPhone(canonical);
                try {
                  sessionStorage.setItem('papopay_linked_phone', canonical);
                } catch {}
                syncWalletFromServer(canonical);
              }
            }
            setIsProcessingTopUp(false);
            setTopUpStatusNote('');
            setTopUpLipaRef('');
            setIsTopUpModalOpen(false);
            toast.success(
              isLipaNamba
                ? `🎉 TZS ${val.toLocaleString()} zimeongezwa baada ya uthibitisho wa Lipa Namba ${PAPO_LIPA_NAMBA}!`
                : `🎉 TZS ${val.toLocaleString()} zimewekwa kwenye PapoWallet yako kupitia Mongike!`
            );
          }
        },
        () => {}
      );
    } catch (err: any) {
      setIsProcessingTopUp(false);
      setTopUpStatusNote('');
      toast.error('Hitilafu ya mtandao: ' + (err?.message || 'Jaribu tena.'));
    }
  };

  // Restaurant NFC Table Tap Handler
  const handleNfcRestaurantPay = (restaurantName: string, tableNumber: string, itemsDesc: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error(`Salio lako halitoshi (Una TZS ${balanceTZS.toLocaleString()}).`);
      setIsTopUpModalOpen(true);
      return;
    }

    setIsNfcPayingRestaurant(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amount);
      const earnedCoins = Math.floor(amount / 1000) * 8;
      setCoinsBalance(prev => prev + earnedCoins);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Malipo ya Mgahawa (${restaurantName})`,
        subtitle: `${tableNumber} • ${itemsDesc}`,
        amount: amount,
        type: 'debit',
        category: 'restaurant',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: PAPO-REST-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsNfcPayingRestaurant(false);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(`🍽️ Bili ya ${tableNumber} (TZS ${amount.toLocaleString()}) imelipwa kikamilifu! Waiter na jikoni wamepata taarifa.`);
    }, 1200);
  };

  // Auto-search verified PapoPay recipient by @username, Wallet ID, or Phone
  useEffect(() => {
    const q = transferRecipient.trim();
    if (q.length < 2) {
      setLookupResult(null);
      setIsLookingUpRecipient(false);
      return;
    }
    setIsLookingUpRecipient(true);
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/wallet/recipient-lookup?q=${encodeURIComponent(q)}`);
        const json = await resp.json().catch(() => null);
        if (json && json.found) {
          setLookupResult(json as VerifiedRecipientCard);
        } else {
          setLookupResult({
            found: false,
            uid: null,
            displayName: '',
            username: null,
            photoURL: null,
            walletId: null,
            maskedWalletId: null,
            phone: null,
            verified: false,
          });
        }
      } catch {
        setLookupResult(null);
      } finally {
        setIsLookingUpRecipient(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [transferRecipient]);

  // Save @username & Transaction PIN securely on backend
  const handleSaveSecurityProfile = async () => {
    setIsSavingSecurity(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const phoneForReq = profile?.phoneNumber || profile?.phone || linkedPhone || linkedWalletInfo?.phone || '';
      const resp = await fetch('/api/wallet/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: user?.uid || linkedWalletInfo?.uid || undefined,
          phone: phoneForReq || undefined,
          username: securityUsernameInput.trim() || undefined,
          newPin: securityNewPin.trim() || undefined,
          currentPin: securityCurrentPin.trim() || undefined,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        toast.error(json?.error || 'Imeshindikana kuhifadhi mipangilio ya usalama.');
        return;
      }
      if (json.username) setUsernameHandle(json.username);
      if (typeof json.hasPinSet === 'boolean') setHasPinSet(json.hasPinSet);
      setSecurityNewPin('');
      setSecurityCurrentPin('');
      setIsSecurityModalOpen(false);
      toast.success('Mipangilio ya @username na Transaction PIN imehifadhiwa salama!');
      if (user?.uid || phoneForReq) {
        syncWalletFromServer(phoneForReq || '', user?.uid);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Hitilafu ya mtandao.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  // Server-computed fees for preview
  const transferAmtNum = Math.max(0, Math.round(Number(transferAmount || 0)));
  const computedP2PFee = React.useMemo(() => {
    if (!transferAmtNum || transferAmtNum < 100) return 0;
    const pct = Number(walletSettings.transferFeePercent || 0);
    const flat = Number(walletSettings.transferFeeFlat || 0);
    const minFee = Number(walletSettings.transferFeeMin || 0);
    if (pct <= 0 && flat <= 0) return 0;
    return Math.max(minFee, Math.round((transferAmtNum * pct) / 100) + flat);
  }, [transferAmtNum, walletSettings]);

  const withdrawAmtNum = Math.max(0, Math.round(Number(withdrawAmount || 0)));
  const computedWithdrawFee = React.useMemo(() => {
    if (!withdrawAmtNum || withdrawAmtNum <= 0) return 0;
    const pct = Number(walletSettings.withdrawalFeePercent ?? 0.2);
    const minFee = Number(walletSettings.withdrawalFeeMin ?? 100);
    return Math.max(minFee, Math.round((withdrawAmtNum * pct) / 100));
  }, [withdrawAmtNum, walletSettings]);

  // Wakala Cash-Out Handler
  const handleNfcWithdrawCash = (agentName: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error(`Salio lako halitoshi kutoa TZS ${amount.toLocaleString()}.`);
      return;
    }

    setIsNfcWithdrawing(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amount);
      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Toa Pesa kwa Wakala (NFC POS)`,
        subtitle: `${agentName} • Fedha Taslimu Mkononi`,
        amount: amount,
        type: 'debit',
        txType: 'MOBILE_MONEY_WITHDRAWAL',
        typeLabel: 'Wakala Withdrawal',
        category: 'withdraw',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: PAPO-WDR-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed',
        paymentMethod: 'Wakala Cash-Out',
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsNfcWithdrawing(false);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(`TZS ${amount.toLocaleString()} zimetolewa kwa ufanisi! Wakala amekukabidhi fedha taslimu.`);
    }, 1000);
  };

  // Real Backend Mobile Money Withdrawal Handler (M-Pesa / Tigo Pesa / Airtel Money / HaloPesa)
  const handleExecuteMobileWithdrawal = async () => {
    setWithdrawError(null);
    const amt = Math.round(Number(withdrawAmount || 0));
    if (!amt || amt < Number(walletSettings.withdrawalMinAmount || 1000)) {
      const msg = `Kiwango cha chini cha kutoa kwenda mtandao wa simu ni TZS ${Number(walletSettings.withdrawalMinAmount || 1000).toLocaleString()}.`;
      setWithdrawError(msg);
      toast.error(msg);
      return;
    }
    if (!withdrawPhone || withdrawPhone.replace(/\D/g, '').length < 9) {
      const msg = 'Weka namba sahihi ya simu ya mpokeaji (mf. 0712345678).';
      setWithdrawError(msg);
      toast.error(msg);
      return;
    }
    if (!/^\d{4,6}$/.test(withdrawPin.trim())) {
      const msg = hasPinSet
        ? 'Weka Transaction PIN yako (tarakimu 4 hadi 6) kuthibitisha.'
        : 'Tafadhali weka Transaction PIN yako kwanza kwenye "PIN & @username".';
      setWithdrawError(msg);
      toast.error(msg);
      if (!hasPinSet) setIsSecurityModalOpen(true);
      return;
    }
    if (balanceTZS < amt + computedWithdrawFee) {
      const msg = `Salio halitoshi (Una TZS ${balanceTZS.toLocaleString()}, unahitaji TZS ${(amt + computedWithdrawFee).toLocaleString()} pamoja na ada).`;
      setWithdrawError(msg);
      toast.error(msg);
      return;
    }

    setIsMobileWithdrawing(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `wth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const senderPhone = profile?.phoneNumber || profile?.phone || linkedPhone || linkedWalletInfo?.phone || '';
      const resp = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderUid: user?.uid || linkedWalletInfo?.uid || undefined,
          senderPhone: senderPhone || undefined,
          network: withdrawNetwork,
          recipientPhone: withdrawPhone.trim(),
          amount: amt,
          pin: withdrawPin.trim(),
          idempotencyKey,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        const errMsg = json?.reason || json?.error || 'Imeshindikana kuanzisha ombi la kutoa pesa.';
        setWithdrawError(errMsg);
        toast.error(errMsg);
        return;
      }

      if (typeof json.newAvailableBalance === 'number') setBalanceTZS(json.newAvailableBalance);
      if (typeof json.newReservedBalance === 'number') setReservedBalanceTZS(json.newReservedBalance);
      setWithdrawPin('');

      const newTx: TransactionItem = {
        id: json.transactionId || `tx_${Date.now()}`,
        transactionId: json.refCode || json.transactionId,
        title:
          json.status === 'pending'
            ? `Pending Withdrawal (${json.networkLabel || withdrawNetwork})`
            : `Mobile Money Withdrawal (${json.networkLabel || withdrawNetwork})`,
        subtitle: `${json.recipientPhone || withdrawPhone} • ${String(json.status || 'pending').toUpperCase()}`,
        amount: Number(json.amount || amt),
        fee: Number(json.fee || computedWithdrawFee),
        type: 'debit',
        txType: json.status === 'completed' ? 'MOBILE_MONEY_WITHDRAWAL' : 'PENDING_WITHDRAWAL',
        typeLabel: json.status === 'completed' ? 'Mobile Money Withdrawal' : 'Pending Withdrawal',
        category: 'withdraw',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: ${json.refCode || 'WTH'}`,
        status: json.status === 'completed' ? 'completed' : 'pending',
        sender: profile?.displayName || linkedWalletInfo?.displayName || 'PapoPay Wallet',
        recipient: json.recipientPhone || withdrawPhone,
        paymentMethod: `${json.networkLabel || withdrawNetwork}`,
      };

      setTransactions((prev) => [newTx, ...prev]);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      toast.success(
        json.status === 'completed'
          ? `TZS ${amt.toLocaleString()} zimetumwa kwenda ${json.networkLabel}!`
          : `Ombi #${json.refCode} limehifadhiwa (PENDING) na fedha zimetengwa salama kusubiri utumaji.`
      );
      syncWalletFromServer(senderPhone || '', user?.uid || linkedWalletInfo?.uid || undefined);
    } catch (err: any) {
      const msg = err?.message || 'Hitilafu ya mtandao.';
      setWithdrawError(msg);
      toast.error(msg);
    } finally {
      setIsMobileWithdrawing(false);
    }
  };

  // Real Backend PapoPay-to-PapoPay Transfer Handler (@username, Wallet ID, or Phone + PIN)
  const handleExecuteTransfer = async () => {
    setTransferError(null);
    const amt = Math.round(Number(transferAmount || 0));
    if (!amt || amt < 100) {
      const msg = 'Kiasi cha chini cha kutuma ni TZS 100.';
      setTransferError(msg);
      toast.error(msg);
      return;
    }
    if (!transferRecipient.trim()) {
      const msg = 'Weka @username, Wallet ID, au namba ya simu ya mpokeaji.';
      setTransferError(msg);
      toast.error(msg);
      return;
    }
    if (lookupResult && !lookupResult.found) {
      const msg = 'Mpokeaji hakupatikana kwenye PapoPay. Hakiki @username, Wallet ID, au namba ya simu.';
      setTransferError(msg);
      toast.error(msg);
      return;
    }
    if (!/^\d{4,6}$/.test(transferPin.trim())) {
      const msg = hasPinSet
        ? 'Weka Transaction PIN yako (tarakimu 4 hadi 6) kuthibitisha.'
        : 'Weka Transaction PIN yako kwanza kwenye "PIN & @username" kabla ya kutuma pesa.';
      setTransferError(msg);
      toast.error(msg);
      if (!hasPinSet) setIsSecurityModalOpen(true);
      return;
    }
    if (balanceTZS < amt + computedP2PFee) {
      const msg = `Salio lako halitoshi (Una TZS ${balanceTZS.toLocaleString()}, unahitaji TZS ${(amt + computedP2PFee).toLocaleString()}).`;
      setTransferError(msg);
      toast.error(msg);
      return;
    }

    setIsTransferring(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `trf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const senderPhone = profile?.phoneNumber || profile?.phone || linkedPhone || linkedWalletInfo?.phone || '';
      const resp = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderUid: user?.uid || linkedWalletInfo?.uid || undefined,
          senderPhone: senderPhone || undefined,
          recipientQuery: transferRecipient.trim(),
          amount: amt,
          pin: transferPin.trim(),
          idempotencyKey,
          note: transferNote.trim() || 'PapoPay Transfer',
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        const errMsg = json?.reason || json?.error || 'Imeshindikana kutuma pesa.';
        setTransferError(errMsg);
        toast.error(errMsg);
        return;
      }

      if (typeof json.newSenderBalance === 'number') {
        setBalanceTZS(json.newSenderBalance);
      }

      const recName = json.recipient?.displayName || lookupResult?.displayName || transferRecipient.trim();
      const recHandle = json.recipient?.username || lookupResult?.username || json.recipient?.maskedWalletId || '';
      const newTx: TransactionItem = {
        id: json.transactionId || `tx_${Date.now()}`,
        transactionId: json.refCode || json.transactionId,
        title: `Money Sent to ${recName}`,
        subtitle: `${recHandle ? `${recHandle} • ` : ''}PapoPay Wallet`,
        amount: Number(json.amount || amt),
        fee: Number(json.fee || 0),
        type: 'debit',
        txType: 'MONEY_SENT',
        typeLabel: 'Money Sent',
        category: 'transfer',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: ${json.refCode || 'TRF'}`,
        status: 'completed',
        sender: json.sender?.displayName || userDisplayName,
        recipient: `${recName}${recHandle ? ` (${recHandle})` : ''}`,
        paymentMethod: 'PapoPay Wallet',
      };

      setTransactions((prev) => [newTx, ...prev]);
      setSelectedReceipt(newTx);
      setIsReceiptModalOpen(true);
      setTransferPin('');
      setTransferRecipient('');
      setLookupResult(null);
      toast.success(`TZS ${amt.toLocaleString()} zimetumwa kwa ${recName}!`);
      syncWalletFromServer(senderPhone || '', user?.uid || linkedWalletInfo?.uid || undefined);
    } catch (err: any) {
      const msg = err?.message || 'Hitilafu ya mtandao.';
      setTransferError(msg);
      toast.error(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  // LUKU Purchase Handler
  const handleBuyLuku = () => {
    const amt = Number(lukuAmount);
    if (!lukuMeter.trim() || lukuMeter.trim().length < 6) {
      toast.error('Weka namba sahihi ya mita ya LUKU.');
      return;
    }
    if (!amt || amt < 2000) {
      toast.error('Kiwango cha chini cha LUKU ni TZS 2,000.');
      return;
    }
    if (balanceTZS < amt) {
      toast.error('Salio lako halitoshi kununua LUKU.');
      return;
    }

    setIsBuyingLuku(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amt);
      const token = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      setGeneratedLukuToken(token);
      saveBillAccountToMemory('luku', lukuMeter, `⚡ Mita ${lukuMeter.slice(-4)}`);

      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `LUKU Umeme (Mita: ${lukuMeter})`,
        subtitle: `TOKEN: ${token} • Units: ${(amt / 350).toFixed(1)} kWh`,
        amount: amt,
        type: 'debit',
        category: 'bill',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: `TRX: LUKU-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsBuyingLuku(false);
      toast.success('⚡ Token ya LUKU imezalishwa kikamilifu!');
    }, 900);
  };

  // DAWASA & King'amuzi (AzamTV / DStv / StarTimes) Handler
  const handlePayUtilityBill = () => {
    const amt = Number(utilityAmount);
    if (!utilityAccount.trim() || utilityAccount.trim().length < 4) {
      toast.error(`Weka namba sahihi ya akaunti ya ${utilityProvider}.`);
      return;
    }
    if (!amt || amt < 1000) {
      toast.error('Kiwango cha chini cha malipo ya bili ni TZS 1,000.');
      return;
    }
    if (balanceTZS < amt) {
      toast.error(`Salio lako halitoshi kulipa ${utilityProvider}.`);
      return;
    }

    setIsPayingUtility(true);
    setTimeout(() => {
      setBalanceTZS(prev => prev - amt);
      const kind = utilityProvider === 'DAWASA' ? 'dawasa' : 'tv';
      const emoji = utilityProvider === 'DAWASA' ? '💧' : '📺';
      saveBillAccountToMemory(kind, utilityAccount, `${emoji} ${utilityProvider}`);

      const ref = `TRX: ${utilityProvider.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Bili ya ${utilityProvider} (${utilityAccount})`,
        subtitle: utilityProvider === 'DAWASA' ? 'Malipo ya Maji Yamethibitishwa' : `Kifurushi cha ${utilityProvider} Kimewashwa`,
        amount: amt,
        type: 'debit',
        category: 'bill',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: ref,
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      setLastUtilityReceipt(newTx);
      setIsPayingUtility(false);
      toast.success(`✅ Malipo ya ${utilityProvider} (TZS ${amt.toLocaleString()}) yamekamilika!`);
    }, 900);
  };

  // Vocha & Vifurushi Handler (with 5% Cashback to PapoPoints)
  const handleBuyVochaBundle = () => {
    const amt = Number(vochaAmount);
    const digits = vochaPhone.replace(/\D/g, '');
    if (digits.length < 9) {
      toast.error('Weka namba sahihi ya simu (mf. 0754123456).');
      return;
    }
    if (!amt || amt < 500) {
      toast.error('Kiasi cha chini cha vocha ni TZS 500.');
      return;
    }
    if (balanceTZS < amt) {
      toast.error('Salio lako halitoshi kununua vocha.');
      return;
    }

    setIsBuyingVocha(true);
    setTimeout(() => {
      const cashbackPts = Math.max(25, Math.round(amt * 0.05));
      setBalanceTZS(prev => prev - amt);
      setCoinsBalance(prev => prev + cashbackPts);
      saveBillAccountToMemory('vocha', vochaPhone, `📱 ${vochaNetwork}`);

      const ref = `TRX: VOCHA-${Math.floor(100000 + Math.random() * 900000)}`;
      const newTx: TransactionItem = {
        id: `tx_${Date.now()}`,
        title: `Vocha ${vochaNetwork} (${vochaPhone})`,
        subtitle: `Salio/Kifurushi kimetumwa • +${cashbackPts} PapoPoints (5% Cashback)`,
        amount: amt,
        type: 'debit',
        category: 'bill',
        date: 'Leo',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        refCode: ref,
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      setLastVochaMsg(`Vocha ya ${vochaNetwork} TZS ${amt.toLocaleString()} imetumwa kwenda ${vochaPhone}. Umepata +${cashbackPts} pts!`);
      setIsBuyingVocha(false);
      toast.success(`📱 Vocha ya ${vochaNetwork} imetumwa! (+${cashbackPts} pts)`);
    }, 850);
  };

  // Student Card Balance Top up
  const handleStudentCardTopUp = (cardId: string, amount: number) => {
    if (balanceTZS < amount) {
      toast.error('Salio lako halitoshi kujaza kadi ya mwanafunzi.');
      return;
    }
    setBalanceTZS(prev => prev - amount);
    setStudentCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, balance: c.balance + amount };
      }
      return c;
    }));
    toast.success(`💳 Kadi ya mwanafunzi imeongezewa TZS ${amount.toLocaleString()}!`);
  };

  // User display metadata & real Wallet ID (synced across WhatsApp & Web)
  const resolvedPhoneDigits = String(
    linkedWalletInfo?.phone || profile?.phoneNumber || profile?.phone || linkedPhone || ''
  ).replace(/\D/g, '');
  const activeWalletId =
    linkedWalletInfo?.walletId ||
    profile?.walletId ||
    (resolvedPhoneDigits.length >= 9
      ? `PP${resolvedPhoneDigits.slice(-7)}`
      : user?.uid
      ? `PP${user.uid.slice(-7).toUpperCase()}`
      : '');
  const userDisplayName =
    linkedWalletInfo?.displayName ||
    profile?.displayName ||
    profile?.fullName ||
    user?.email?.split('@')[0] ||
    (resolvedPhoneDigits.length >= 9 ? `Mteja ${resolvedPhoneDigits.slice(-4)}` : 'PapoPay');
  const userInitials = (userDisplayName || 'PP').slice(0, 2).toUpperCase();

  // Filtered transactions for search
  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q) || t.refCode.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f8f9fd] dark:bg-[#0b0f19] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* ========================================================================= */}
      {/* DESKTOP TOP BAR (WEB VIEW HEADER BAR) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111625]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 px-4 lg:px-8 py-3 transition-colors">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          
          {/* Left: Back Link & PapoPay Brand Badge */}
          <div className="flex items-center gap-3 xl:gap-5 min-w-0">
            <button
              onClick={() => navigate('/services')}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 shrink-0 transition-all"
              title="Rudi kwenye Super Services Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Rudi Hub</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#1f4fe4] to-[#3b66f5] text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-neutral-900 dark:text-white">PapoPay</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                    BOT 🇹🇿
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-medium hidden sm:inline">
                  Super Fintech &amp; NFC Tap Ecosystem
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live FX & Market Ticker (Desktop Web View Exclusive) */}
          <div className="hidden xl:flex items-center gap-4 px-4 py-1.5 rounded-full bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-mono font-medium">
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">USD/TZS:</span>
              <span className="text-emerald-600 font-bold">2,610.50</span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <span className="font-bold">KES/TZS:</span>
              <span className="text-blue-600 font-bold">20.25</span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <Bus className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-amber-600">Daladala &amp; BRT NFC:</span>
              <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.2 rounded text-[10px] font-bold">0% ADA</span>
            </div>
          </div>

          {/* Right: Quick Action Ribbon & User Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Currency Toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl text-xs font-mono font-bold">
              <button
                onClick={() => setCurrency('TZS')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currency === 'TZS'
                    ? 'bg-white dark:bg-neutral-900 text-[#3b66f5] shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                TZS
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-neutral-900 text-[#3b66f5] shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                USD
              </button>
            </div>

            {/* Tumia PapoPay Kwenye WhatsApp Button */}
            <button
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wide flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              title="Tumia PapoPay Kwenye WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">PapoPay WhatsApp</span>
            </button>

            {/* Quick Deposit Button */}
            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#3b66f5] hover:bg-[#2f55e0] text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Weka Salio</span>
            </button>

            {/* User Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3b66f5] to-[#703bf5] text-white font-black text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-61px)]">
        
        {/* ========================================================================= */}
        {/* LEFT SIDEBAR (STICKY ON WEB VIEW) */}
        {/* ========================================================================= */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-white dark:bg-[#111625] border-r border-neutral-200/80 dark:border-neutral-800/80 p-4 xl:p-5 flex flex-col justify-between space-y-6 lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] lg:overflow-y-auto">
          
          <div className="space-y-5">
            
            {/* 1. TOP FLOATING BLUE GRADIENT WALLET CARD */}
            <div className="rounded-3xl bg-gradient-to-br from-[#2f65f6] via-[#1f4fe4] to-[#1239c8] text-white p-5 shadow-[0_12px_28px_-6px_rgba(31,79,228,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 space-y-3.5">
                {/* Top Badge + Currency Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{currency === 'TZS' ? 'TZS Personal Wallet' : 'USD Personal Wallet'}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrency(currency === 'TZS' ? 'USD' : 'TZS')}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs transition-colors"
                      title="Badili Sarafu"
                    >
                      ⇄
                    </button>
                  </div>
                </div>

                {/* Wallet ID & @username with Security Setup */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-blue-100 font-mono">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="opacity-80">ID:</span>
                      <span className="font-bold truncate">{activeWalletId || 'Haijaunganishwa'}</span>
                      {activeWalletId && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(activeWalletId);
                            toast.success(`Wallet ID ${activeWalletId} imenakiliwa!`);
                          }}
                          className="p-1 hover:text-white transition-colors"
                          title="Copy ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSecurityUsernameInput(usernameHandle ? usernameHandle.replace(/^@+/, '') : '');
                        setIsSecurityModalOpen(true);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-sans font-bold text-white shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>{hasPinSet ? 'PIN & @user' : 'Weka PIN'}</span>
                    </button>
                  </div>
                  {usernameHandle && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200">
                      <span>{usernameHandle}</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-[9px] uppercase">Verified</span>
                    </div>
                  )}
                </div>

                {/* Available Balance + Reserved Escrow Balance */}
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 block">
                      AVAILABLE BALANCE
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl xl:text-3xl font-black font-mono tracking-tight">
                        {showBalance
                          ? (currency === 'TZS' ? `TZS ${(balanceTZS).toLocaleString()}` : `$${(balanceTZS / 2600).toFixed(2)}`)
                          : '••••••••'}
                      </span>
                      <button
                        onClick={() => setShowBalance(!showBalance)}
                        className="p-1 hover:text-white transition-colors opacity-90"
                      >
                        {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                    {reservedBalanceTZS > 0 && showBalance && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-100 text-[10px] font-bold font-mono">
                        <Clock className="w-3 h-3" />
                        <span>Reserved Pending: {formatAmount(reservedBalanceTZS)}</span>
                      </div>
                    )}
                  </div>

                  {/* Holographic Card Chip Graphic */}
                  <div className="w-8 h-6 rounded-md bg-white/25 border border-white/40 flex items-center justify-center">
                    <div className="w-5 h-3.5 border border-white/40 rounded-sm" />
                  </div>
                </div>

                {/* Two Action Buttons: Deposit & Make Payment */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsTopUpModalOpen(true)}
                    className="py-2 px-3 rounded-xl bg-white text-[#1f4fe4] hover:bg-blue-50 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Deposit</span>
                  </button>

                  <button
                    onClick={() => setActiveSection('make_payment')}
                    className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 backdrop-blur-md active:scale-95 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-300" />
                    <span>NFC Tap</span>
                  </button>
                </div>

                {/* WhatsApp / Phone Wallet Sync Status when not logged in via Firebase */}
                {!user?.uid && (
                  <div className="pt-2 border-t border-white/15">
                    {resolvedPhoneDigits.length >= 9 ? (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-blue-100">
                        <span className="truncate font-mono">
                          🟢 WhatsApp: +255{resolvedPhoneDigits.slice(-9)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => syncWalletFromServer(resolvedPhoneDigits)}
                            disabled={isSyncingLinkedWallet}
                            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white font-bold transition-colors"
                            title="Sasisha Salio"
                          >
                            {isSyncingLinkedWallet ? '...' : '🔄'}
                          </button>
                          <button
                            onClick={() => {
                              setLinkedPhone('');
                              setLinkedWalletInfo(null);
                              setBalanceTZS(0);
                              setCoinsBalance(0);
                              setTransactions([]);
                              try {
                                sessionStorage.removeItem('papopay_linked_phone');
                              } catch {}
                            }}
                            className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold"
                          >
                            Badili
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-blue-100/90 leading-tight">
                          Ingia au weka namba yako ya WhatsApp kuona salio lako halisi:
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="tel"
                            placeholder="07xx / 06xx..."
                            value={linkedPhoneInput}
                            onChange={(e) => setLinkedPhoneInput(e.target.value)}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white placeholder:text-blue-100/70 text-xs font-mono focus:outline-none focus:bg-white/25"
                          />
                          <button
                            onClick={() => {
                              const d = linkedPhoneInput.replace(/\D/g, '');
                              if (d.length < 9) {
                                toast.error('Weka namba sahihi ya simu (mf. 0687225353).');
                                return;
                              }
                              const canonical = `+255${d.slice(-9)}`;
                              setLinkedPhone(canonical);
                              try {
                                sessionStorage.setItem('papopay_linked_phone', canonical);
                              } catch {}
                              setLinkedPhoneInput('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white text-[#1f4fe4] hover:bg-blue-50 text-[11px] font-black shrink-0"
                          >
                            Fungua
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* 2. ACCORDION NAVIGATION ITEMS */}
            <nav className="space-y-1 text-sm font-semibold">
              
              {/* Dashboard Overview */}
              <button
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'overview'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Dashboard Overview</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Add & Withdraw Funds */}
              <button
                onClick={() => setActiveSection('add_withdraw')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'add_withdraw'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Banknote className="w-4 h-4" />
                  <span>Add &amp; Withdraw Funds</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Make Payment (NFC Tap & Nauli) */}
              <button
                onClick={() => setActiveSection('make_payment')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'make_payment'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-emerald-500" />
                  <span>NFC Tap &amp; Mgahawani</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  TAP
                </span>
              </button>

              {/* Express Kiosk Terminal (Murtaza AI) */}
              <button
                onClick={() => setIsKioskModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
              >
                <div className="flex items-center gap-3">
                  <ScanFace className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                  <span>Kiosk &amp; Mageti ya BRT</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-400/30">
                  KIOSK
                </span>
              </button>

              {/* Smart Shopping Cart / Kaunta ya Vitu (Pysource YOLO Vision) */}
              <button
                onClick={() => setIsVisionCheckoutOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
              >
                <div className="flex items-center gap-3">
                  <Scan className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Kaunta ya Vitu (YOLO)</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                  YOLO
                </span>
              </button>

              {/* Dedicated Wakala Panel */}
              <Link
                to="/wakala"
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
              >
                <div className="flex items-center gap-3">
                  <Banknote className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Portal ya Wakala (Cash-In/Out)</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                  WAKALA
                </span>
              </Link>

              {/* Dedicated Merchant POS Panel */}
              <Link
                to="/merchant"
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
              >
                <div className="flex items-center gap-3">
                  <ScanFace className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                  <span>Merchant POS (Maduka &amp; Hotel)</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-400/30">
                  POS
                </span>
              </Link>

              {/* Tumia PapoPay Kwenye WhatsApp */}
              <button
                onClick={() => setIsWhatsAppModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/40 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="font-bold">PapoPay Kwenye WhatsApp</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* My Virtual Cards & Student NFC */}
              <button
                onClick={() => setActiveSection('virtual_cards')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'virtual_cards'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4" />
                  <span>Virtual Cards &amp; Student</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Transfer & Exchange */}
              <button
                onClick={() => setActiveSection('transfer_exchange')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'transfer_exchange'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-4 h-4" />
                  <span>Transfer &amp; Gawana Nauli</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Mobile Recharge (LUKU & Vocha) */}
              <button
                onClick={() => setActiveSection('mobile_recharge')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'mobile_recharge'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4" />
                  <span>LUKU &amp; Mobile Recharge</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* P2P Marketplace */}
              <button
                onClick={() => setActiveSection('p2p')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'p2p'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>P2P Marketplace</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>

              {/* Transaction History */}
              <button
                onClick={() => setActiveSection('history')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all ${
                  activeSection === 'history'
                    ? 'bg-[#3b66f5] text-white shadow-md font-bold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4" />
                  <span>Transaction History</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75" />
              </button>
            </nav>

          </div>

          {/* 3. BOTTOM REFERRAL CARD */}
          <div className="p-4 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  REFERRAL BOOST
                </span>
                <h5 className="text-xs font-black text-neutral-900 dark:text-white mt-1">
                  Alika marafiki ujipatie TZS 2,500
                </h5>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Kila rafiki akilipa nauli ya kwanza kwa PapoPay unazawadiwa.
                </p>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText('https://papo.tz/invite/' + (user?.uid || 'user'));
                  toast.success('Kiunganishi cha mwaliko kimenakiliwa!');
                }}
                className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

        </aside>

        {/* ========================================================================= */}
        {/* MAIN DASHBOARD CONTENT AREA */}
        {/* ========================================================================= */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          
          {/* TOP USER GREETING & SEARCH BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3b66f5] to-[#703bf5] text-white font-black text-base flex items-center justify-center shadow-md">
                {userInitials}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
                  HABARI YA LEO
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                  Karibu, {userDisplayName}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {activeSection === 'overview' && "Tazama muhtasari wa akaunti na miamala yako ya leo."}
                  {activeSection === 'add_withdraw' && "Weka au toa fedha kwa mawakala wa Papo na mitandao ya simu."}
                  {activeSection === 'make_payment' && "Lipa bila chenji mgahawani, kwenye daladala na madukani kwa NFC Tap."}
                  {activeSection === 'virtual_cards' && "Simamia kadi yako ya mtandaoni na Kadi za NFC za Wanafunzi."}
                  {activeSection === 'transfer_exchange' && "Tuma pesa papo kwa papo bila makato au gawana bili na marafiki."}
                  {activeSection === 'mobile_recharge' && "Nunua LUKU, vifurushi vya simu na lipia ankara za serikali."}
                  {activeSection === 'p2p' && "Soko la P2P la kubadilishana sarafu kwa ulinzi wa BOT."}
                  {activeSection === 'history' && "Kumbukumbu na stakabadhi za EFD za miamala yako yote."}
                </p>
              </div>
            </div>

            {/* Desktop Search Bar & Fast Nav Buttons */}
            <div className="flex items-center gap-2.5">
              <div className="relative min-w-[220px] sm:min-w-[280px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tafuta muamala au huduma..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-[#3b66f5]"
                />
              </div>

              <button
                onClick={() => setActiveSection('history')}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#111625] hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
              >
                <Receipt className="w-4 h-4 text-[#3b66f5]" />
                <span className="hidden sm:inline">Stakabadhi</span>
              </button>
            </div>

          </div>

          {/* IDENTITY VERIFIED / BOT COMPLIANT ALERT */}
          {isKycBannerVisible && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111625] border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                    Uthibitisho wa NIDA &amp; BOT Umekamilika
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    Akaunti yako imethibitishwa na inaruhusiwa kufanya miamala ya hadi TZS 10,000,000 kwa siku.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Imethibitishwa</span>
                </span>

                <button
                  onClick={() => setIsKycBannerVisible(false)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW (WEB VIEW DASHBOARD COCKPIT) */}
          {/* ========================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              
              {/* EIGHT STAT CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                
                {/* Card 1: Deposit */}
                <div 
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(14102000)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Deposit (Weka Salio)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-[#3b66f5] flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 2: Withdraw */}
                <div 
                  onClick={() => setActiveSection('add_withdraw')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shadow-xs">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(7956000)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Withdraw (Toa Pesa)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-rose-500 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 3: Send Money */}
                <div 
                  onClick={() => setActiveSection('transfer_exchange')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] flex items-center justify-center shadow-xs">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(14021530)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Tuma Pesa (0% Ada)</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-[#3b66f5] flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4: Make Payment (NFC Tap) */}
                <div 
                  onClick={() => setActiveSection('make_payment')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shadow-xs">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        NFC Tap &amp; Pay
                      </h3>
                      <span className="text-xs text-emerald-600 font-semibold">Mgahawa &amp; Daladala</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4b: Face Payment (Smile to Pay) */}
                <div 
                  onClick={() => {
                    setActiveSection('make_payment');
                    setNfcSubCategory('face');
                  }}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-cyan-300/80 dark:border-cyan-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-xs">
                      <ScanFace className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        Face Payment
                      </h3>
                      <span className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">Smile-to-Pay ⚡</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4c: Express Terminal Kiosk (Murtaza AI) */}
                <div 
                  onClick={() => setIsKioskModalOpen(true)}
                  className="p-4 rounded-3xl bg-gradient-to-r from-cyan-950/10 via-blue-950/10 to-indigo-950/10 dark:bg-[#0f172a] border border-cyan-400/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 flex items-center justify-center shadow-xs border border-cyan-400/30">
                      <Store className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                          Kiosk Terminal
                        </h3>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-600 dark:text-cyan-300 text-[9px] font-black uppercase">
                          AI
                        </span>
                      </div>
                      <span className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">Kaunta &amp; Mageti ya BRT</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-xs transition-transform group-hover:translate-x-0.5">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4d: Smart Kaunta ya Vitu (Pysource YOLO Vision) */}
                <div 
                  onClick={() => setIsVisionCheckoutOpen(true)}
                  className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/15 via-teal-950/10 to-cyan-950/15 dark:bg-[#061817] border border-emerald-400/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shadow-xs border border-emerald-400/30">
                      <Scan className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                          Kaunta ya Vitu
                        </h3>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-600 dark:text-emerald-300 text-[9px] font-black uppercase">
                          YOLO
                        </span>
                      </div>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Pysource Smart Checkout</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-xs transition-transform group-hover:translate-x-0.5 font-black">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 4e: Wakala & Merchant POS (Maduka, Migahawa & Hoteli) */}
                <div 
                  onClick={() => setIsWakalaModalOpen(true)}
                  className="p-4 rounded-3xl bg-gradient-to-r from-teal-950/20 via-emerald-950/20 to-cyan-950/20 dark:bg-[#061f1c] border border-emerald-400/60 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-xs border border-emerald-400/30">
                      <Store className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                          Wakala &amp; POS
                        </h3>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-600 dark:text-emerald-300 text-[9px] font-black uppercase">
                          CASH-IN
                        </span>
                      </div>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Weka/Toa Pesa kwa Uso</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center shadow-xs transition-transform group-hover:translate-x-0.5 font-black">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 5: Exchange Money */}
                <div 
                  onClick={() => setActiveSection('transfer_exchange')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shadow-xs">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {formatAmount(12155120)}
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Sarafu &amp; Exchange</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 6: Kadi ya Mwanafunzi */}
                <div 
                  onClick={() => setActiveSection('virtual_cards')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shadow-xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        2 Kadi Wanafunzi
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Student NFC Transit</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-teal-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 7: Reward Coins */}
                <div 
                  onClick={() => toast.success(`Una pointi ${coinsBalance} za zawadi za PapoPay!`)}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shadow-xs">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        {coinsBalance} Coins
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Papo CashBack Rewards</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-amber-500 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 8: LUKU & Bili */}
                <div 
                  onClick={() => setActiveSection('mobile_recharge')}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shadow-xs">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-mono text-neutral-900 dark:text-white">
                        LUKU &amp; Bili
                      </h3>
                      <span className="text-xs text-neutral-500 font-medium">Umeme, Maji, Vocha</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card 9: Tumia PapoPay Kwenye WhatsApp */}
                <div
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="sm:col-span-2 lg:col-span-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#075E54] via-[#0d7367] to-[#128C7E] text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm text-white flex items-center justify-center shrink-0">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black tracking-tight">
                        Tumia PapoPay Kwenye WhatsApp (In-Chat Checkout)
                      </h3>
                      <p className="text-xs text-emerald-100 mt-0.5">
                        Angalia salio, tuma pesa 0% ada, lipa LUKU, toa pesa kwa Wakala, gawana bili na tuma kadi za Review &amp; Pay moja kwa moja ndani ya WhatsApp.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreatedPayLink(null);
                        setIsPayLinkModalOpen(true);
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold text-xs flex items-center justify-center gap-1.5 backdrop-blur-xs cursor-pointer"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>Unda Link ya Malipo</span>
                    </button>
                    <div className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white text-[#075E54] font-black text-xs flex items-center justify-center gap-2 group-hover:bg-emerald-50 transition-colors">
                      <span>Fungua PapoPay WhatsApp</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

              </div>

              {/* ANALYTICS CHARTS & SPARKLINE CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Deposits Chart Card */}
                <div className="p-5 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <Download className="w-4 h-4" />
                        <span className="text-sm font-black text-neutral-900 dark:text-white">Deposits</span>
                      </div>
                      <span className="text-xs text-neutral-400">Siku 7 zilizopita</span>
                    </div>
                    <span className="text-lg font-black font-mono text-emerald-600">
                      TZS 255,000
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-28 w-full flex items-end justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2 relative">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                      </div>
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 100">
                        <path
                          d="M 10 80 Q 150 20 300 60 T 690 10"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-bold text-neutral-400 mt-2">
                      <span>Jpili</span>
                      <span>Jtatu</span>
                      <span>Jnne</span>
                      <span>Ttano</span>
                      <span>Alh</span>
                      <span>Iju</span>
                      <span>Jmosi</span>
                    </div>
                  </div>
                </div>

                {/* Withdrawals Chart Card */}
                <div className="p-5 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-rose-500">
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="text-sm font-black text-neutral-900 dark:text-white">Matumizi &amp; Nauli</span>
                      </div>
                      <span className="text-xs text-neutral-400">Siku 7 zilizopita</span>
                    </div>
                    <span className="text-lg font-black font-mono text-rose-500">
                      TZS 56,100
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="pt-4 pb-2">
                    <div className="h-28 w-full flex items-end justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2 relative">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-700 w-full" />
                      </div>
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 100">
                        <path
                          d="M 10 90 Q 200 40 400 80 T 690 30"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="3"
                        />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-bold text-neutral-400 mt-2">
                      <span>Jpili</span>
                      <span>Jtatu</span>
                      <span>Jnne</span>
                      <span>Ttano</span>
                      <span>Alh</span>
                      <span>Iju</span>
                      <span>Jmosi</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* QUICK NFC TAP HIGHLIGHT ON WEB VIEW */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-neutral-900 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2 z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>NFC Tap &amp; Pay Tanzania 🇹🇿</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                    Lipa Bili ya Mgahawa au Nauli ya Daladala kwa Kugusa Simu
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300">
                    Huna haja ya kubeba fedha taslimu au kusubiri chenji. Gusa simu yako au kadi ya PapoPay kwenye meza ya mgahawa au kwa konda kulipa papo hapo.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 z-10">
                  <button
                    onClick={() => {
                      setActiveSection('make_payment');
                      setNfcSubCategory('restaurant');
                    }}
                    className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Utensils className="w-4 h-4" />
                    <span>Mgahawani (Mezani)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection('make_payment');
                      setNfcSubCategory('transit');
                    }}
                    className="px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs uppercase tracking-wider backdrop-blur-md flex items-center gap-2 transition-transform active:scale-95"
                  >
                    <Bus className="w-4 h-4" />
                    <span>Nauli ya Daladala</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ADD & WITHDRAW FUNDS (WEB VIEW COMPLETE SUITE) */}
          {/* ========================================================================= */}
          {activeSection === 'add_withdraw' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Weka Salio (Deposit) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Weka Salio (Deposit Funds)
                    </h3>
                    <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, Halopesa, Visa</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                      Chagua Mtandao / Njia ya Malipo
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'lipanamba', name: `Lipa Namba ${PAPO_LIPA_NAMBA}`, color: 'border-emerald-500 text-emerald-700' },
                        { id: 'mpesa', name: 'M-Pesa', color: 'border-red-500 text-red-600' },
                        { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500 text-blue-600' },
                        { id: 'airtel', name: 'Airtel Money', color: 'border-red-600 text-red-600' },
                        { id: 'halopesa', name: 'HaloPesa', color: 'border-orange-500 text-orange-600' },
                        { id: 'card', name: 'Kadi ya Benki', color: 'border-indigo-500 text-indigo-600' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setTopUpMethod(m.id as any)}
                          className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                            topUpMethod === m.id
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-700 dark:text-emerald-300 shadow-xs'
                              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {topUpMethod === 'lipanamba' && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Lipa Namba Rasmi • {PAPO_LIPA_NAMBA_NAME}
                          </p>
                          <p className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100">
                            {PAPO_LIPA_NAMBA}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(PAPO_LIPA_NAMBA);
                            toast.success(`Lipa Namba ${PAPO_LIPA_NAMBA} imenakiliwa!`);
                          }}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Nakili</span>
                        </button>
                      </div>
                      <p className="text-xs text-emerald-800 dark:text-emerald-200">
                        Lipa kwenda <strong>{PAPO_LIPA_NAMBA}</strong> ({PAPO_LIPA_NAMBA_NAME}) kisha weka namba ya muamala (SMS) hapa chini na ubonyeze kitufe ili Admin athibitishe:
                      </p>
                      <input
                        type="text"
                        value={topUpLipaRef}
                        onChange={(e) => setTopUpLipaRef(e.target.value)}
                        placeholder="Namba ya Muamala / SMS (mf. BH82K9...)"
                        className="w-full bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-700 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                      Kiasi cha Kuweka (TZS)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {['10000', '25000', '50000', '100000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopUpAmount(amt)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                            topUpAmount === amt
                              ? 'bg-[#3b66f5] text-white border-[#3b66f5]'
                              : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {Number(amt).toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold focus:outline-none focus:border-[#3b66f5]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Namba ya Simu ya Malipo
                    </label>
                    <input
                      type="tel"
                      value={topUpPhone}
                      onChange={(e) => setTopUpPhone(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                    />
                  </div>

                  {topUpStatusNote && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{topUpStatusNote}</span>
                    </div>
                  )}

                  <button
                    disabled={isProcessingTopUp}
                    onClick={handleExecuteTopUp}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    {isProcessingTopUp ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>
                      {topUpMethod === 'lipanamba'
                        ? `Nimelipa TZS ${Number(topUpAmount || 0).toLocaleString()} (Lipa Namba ${PAPO_LIPA_NAMBA})`
                        : `Weka TZS ${Number(topUpAmount || 0).toLocaleString()} Kwenye PapoPay`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Withdraw Money (Mobile Money & Wakala Cash-Out) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                        Withdraw Money (Toa Pesa)
                      </h3>
                      <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, HaloPesa au Wakala</p>
                    </div>
                  </div>
                </div>

                {/* Channel Toggle: Mobile Money Networks vs Wakala Cash-Out */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setWithdrawMode('mobile_money')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      withdrawMode === 'mobile_money'
                        ? 'bg-white dark:bg-neutral-900 text-rose-600 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    📱 Mobile Money (M-Pesa / Tigo...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMode('wakala')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      withdrawMode === 'wakala'
                        ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    🏪 Wakala Cash-Out (NFC)
                  </button>
                </div>

                {withdrawMode === 'mobile_money' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                        Chagua Mtandao wa Simu
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'MPESA' as const, label: 'M-Pesa (Vodacom)' },
                          { id: 'TIGO' as const, label: 'Tigo Pesa (Mixx)' },
                          { id: 'AIRTEL' as const, label: 'Airtel Money' },
                          { id: 'HALOPESA' as const, label: 'HaloPesa' },
                        ].map((net) => {
                          const enabled = walletSettings.enabledNetworks?.[net.id] !== false;
                          return (
                            <button
                              key={net.id}
                              type="button"
                              disabled={!enabled}
                              onClick={() => setWithdrawNetwork(net.id)}
                              className={`p-3 rounded-2xl border text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                                !enabled
                                  ? 'opacity-45 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400'
                                  : withdrawNetwork === net.id
                                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs'
                                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                              }`}
                            >
                              <span>{net.label}</span>
                              {!enabled && <span className="text-[9px] uppercase text-red-500">Zimwa</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Namba ya Simu ya Mpokeaji
                      </label>
                      <input
                        type="tel"
                        placeholder="Mfano: 0754123456"
                        value={withdrawPhone}
                        onChange={(e) => setWithdrawPhone(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Kiasi cha Kutoa (TZS)
                      </label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* Fee & Total Summary */}
                    <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Kiasi cha Kutoa:</span>
                        <span className="font-mono font-bold">TZS {withdrawAmtNum.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Ada ya Mtandao ({walletSettings.withdrawalFeePercent}%):</span>
                        <span className="font-mono font-bold text-amber-600">TZS {computedWithdrawFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-neutral-200 dark:border-neutral-700 font-black">
                        <span>Jumla Itakayotengwa:</span>
                        <span className="font-mono text-rose-600">TZS {(withdrawAmtNum + computedWithdrawFee).toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold uppercase text-neutral-400">
                          Transaction PIN (Tarakimu 4–6)
                        </label>
                        {!hasPinSet && (
                          <button
                            type="button"
                            onClick={() => setIsSecurityModalOpen(true)}
                            className="text-[11px] font-bold text-[#3b66f5] underline cursor-pointer"
                          >
                            Weka PIN Kwanza
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••"
                        value={withdrawPin}
                        onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold tracking-widest focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    {withdrawError && (
                      <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{withdrawError}</span>
                      </div>
                    )}

                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Kwa usalama wa fedha zako, kiasi kinachotolewa kinahifadhiwa kwenye <strong>Reserved Escrow (PENDING)</strong> hadi malipo yatakapothibitishwa kukamilika na mtandao. Kikishindikana, kinarudishwa kiotomatiki.
                      </span>
                    </div>

                    <button
                      disabled={isMobileWithdrawing}
                      onClick={handleExecuteMobileWithdrawal}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-60 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      {isMobileWithdrawing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                      <span>Thibitisha &amp; Toa TZS {withdrawAmtNum.toLocaleString()}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">
                        Mawakala wa PapoPay Walio Karibu (Dar es Salaam)
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {[
                          { name: 'Wakala Mussa Telecomm (Kariakoo Sokoni)', dist: '120m', status: 'Inapatikana' },
                          { name: 'Papo Agent Mary (Posta Mpya Mnara)', dist: '250m', status: 'Inapatikana' },
                          { name: 'Kivukoni Ferry Point Wakala', dist: '400m', status: 'Inapatikana' },
                          { name: 'Mwenge Stendi Papo Hub', dist: '1.2km', status: 'Inapatikana' },
                          { name: 'Ubungo Simu 2000 Wakala', dist: '2.5km', status: 'Inapatikana' }
                        ].map((ag) => (
                          <div
                            key={ag.name}
                            onClick={() => setSelectedAgent(ag.name)}
                            className={`p-3 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                              selectedAgent === ag.name
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-[#3b66f5] font-bold text-neutral-900 dark:text-white'
                                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-500" />
                              <span>{ag.name}</span>
                            </div>
                            <span className="font-mono text-[11px] text-blue-600">{ag.dist}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Kiasi cha Kutoa (TZS)
                      </label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Ada ya kutoa kwa wakala wa PapoPay ni 0.2% pekee (Nusu ya makato ya kawaida ya mawakala wa mitandao).</span>
                    </div>

                    <button
                      disabled={isNfcWithdrawing}
                      onClick={() => handleNfcWithdrawCash(selectedAgent, Number(withdrawAmount || 0))}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      {isNfcWithdrawing ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Radio className="w-5 h-5" />
                      )}
                      <span>Gusisha Simu / Toa TZS {Number(withdrawAmount || 0).toLocaleString()}</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MAKE PAYMENT (NFC TAP IN RESTAURANTS, DALADALA & SHOPS) */}
          {/* ========================================================================= */}
          {activeSection === 'make_payment' && (
            <div className="space-y-6">
              
              {/* Category Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                    <span>NFC Tap &amp; Pay Ecosystem 🇹🇿</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Chagua aina ya huduma kisha gusisha simu au kadi mezani au kwa konda
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'restaurant', label: '🍽️ Migahawani & Cafe' },
                    { id: 'transit', label: '🚌 Daladala & BRT' },
                    { id: 'services', label: '🛍️ Maduka & Saluni' },
                    { id: 'face', label: '✨ Lipa kwa Uso (Face Pay)' },
                    { id: 'vision_checkout', label: '🛒 Kaunta ya Vitu (YOLO)' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNfcSubCategory(cat.id as any)}
                      className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                        nfcSubCategory === cat.id
                          ? (cat.id === 'face' 
                              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md' 
                              : cat.id === 'vision_checkout'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                                : 'bg-[#3b66f5] text-white shadow-md')
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. RESTAURANT TABLE TAP */}
              {nfcSubCategory === 'restaurant' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left: Table Bill Overview */}
                  <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-md">
                          MEZA NO. 04 • TERRACE VIEW
                        </span>
                        <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2">
                          Papo Hapo Ocean View Grill &amp; Cafe
                        </h3>
                        <p className="text-xs text-neutral-500">Kivukoni Front, Dar es Salaam • Waiter: Kelvin M.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-400 block">Jumla ya Bili</span>
                        <span className="text-2xl font-black font-mono text-emerald-600">TZS 25,500</span>
                      </div>
                    </div>

                    {/* Order items breakdown */}
                    <div className="border border-neutral-200/80 dark:border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Samaki wa Kupaka Mzima</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Changu wa nazi, kachumbari pembeni</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 18,000</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Chips Kavu Kubwa</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Pamoja na pilipili manga</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 4,000</span>
                      </div>
                      <div className="p-3.5 flex items-center justify-between text-xs font-bold">
                        <div>
                          <span className="text-neutral-900 dark:text-white">1x Juisi Safi ya Embe Baridi</span>
                          <span className="text-[11px] text-neutral-400 block font-normal">Fresh blended juice</span>
                        </div>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">TZS 3,500</span>
                      </div>
                    </div>

                    {/* NFC Tap Action Box */}
                    <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <Radio className="w-4 h-4 animate-ping" />
                        <span>Kiguso cha NFC Mezani Kipo Tayari!</span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Gusa simu yako au kadi ya PapoPay kwenye stika ya NFC ya Meza No. 04. Mfumo utakusanya bili, kuwajulisha jikoni kuwa umelipa, na kukupatia Stakabadhi ya EFD ya TRA papo hapo.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          disabled={isNfcPayingRestaurant}
                          onClick={() => handleNfcRestaurantPay('Papo Hapo Ocean View Grill', 'Meza No. 04', 'Samaki wa Kupaka + Chips + Juice', 25500)}
                          className="py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          {isNfcPayingRestaurant ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Radio className="w-4 h-4" />
                          )}
                          <span>Gusisha NFC (TZS 25,500)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFacePayTarget({
                              amount: 25500,
                              recipient: 'Papo Hapo Ocean View Grill',
                              service: 'Meza No. 04 - Bili ya Chakula'
                            });
                            setIsFacePayModalOpen(true);
                          }}
                          className="py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                          <ScanFace className="w-4 h-4 animate-pulse" />
                          <span>Lipa kwa Uso (Face Pay) ⚡</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Split Table Bill & QR Code */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5 text-center flex flex-col justify-between">
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                        Skani QR ya Meza No. 04
                      </h4>
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 inline-block mx-auto border border-neutral-200 dark:border-neutral-700">
                        <QRCodeSVG value="https://papo.tz/restaurant/table/04?bill=25500" size={140} />
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Kama huna NFC, skani QR hii kwa kamera au app yoyote ya benki.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">
                        Mko wengi mezani? Gawana bili:
                      </span>
                      <button
                        onClick={() => {
                          setActiveSection('transfer_exchange');
                          setSplitTotal('25500');
                        }}
                        className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] font-black text-xs uppercase hover:bg-blue-100 transition-colors"
                      >
                        Gawana Bili ya Meza (Split)
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* 2. TRANSIT DALADALA & BRT TAP */}
              {nfcSubCategory === 'transit' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Daladala Kivukoni ➔ Mwenge */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-neutral-900 dark:text-white">
                          Daladala T 482 DFP
                        </h4>
                        <p className="text-xs text-neutral-500">Ruti: Kivukoni ➔ Morocco ➔ Mwenge</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-600 dark:text-neutral-300">Nauli ya Mtu Mzima:</span>
                        <span className="font-mono text-neutral-900 dark:text-white font-black">TZS 600</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>Nauli ya Mwanafunzi (Smart NFC):</span>
                        <span className="font-mono font-black">TZS 200 (50% Off)</span>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-400">
                        <span>Konda: Juma Omari</span>
                        <span>POS ID: DALA-POS-902</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNfcRestaurantPay('Daladala T 482 DFP', 'Kiti No. 12', 'Kivukoni - Mwenge', 600)}
                      className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Gusisha kwa Konda (Lipa Nauli TZS 600)</span>
                    </button>
                  </div>

                  {/* BRT Mwendokasi Kimara ➔ Kivukoni */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-neutral-900 dark:text-white">
                          BRT Mwendokasi Express
                        </h4>
                        <p className="text-xs text-neutral-500">Kituo: Kimara Terminal ➔ Kivukoni</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-600 dark:text-neutral-300">Nauli ya BRT:</span>
                        <span className="font-mono text-neutral-900 dark:text-white font-black">TZS 750</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>PapoPay Turnstile Tap:</span>
                        <span className="font-mono font-black">Mlango unafunguka papo hapo</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleNfcRestaurantPay('BRT Mwendokasi', 'Turnstile Gate 3', 'Kimara - Kivukoni', 750)}
                      className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Gusisha Kwenye Geti (Lipa TZS 750)</span>
                    </button>
                  </div>

                </div>
              )}

              {/* 3. SHOPS & SALONS */}
              {nfcSubCategory === 'services' && (
                <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
                  <h4 className="text-base font-black text-neutral-900 dark:text-white">
                    Maduka, Saluni na Vinyozi Vinavyotumia PapoPay NFC
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'Kipepeo Beauty Saloon', loc: 'Sinza Mori', price: 15000, desc: 'Kusuka na Kusafisha Kucha' },
                      { name: 'Executive Kinyozi & Spa', loc: 'Mikocheni', price: 7000, desc: 'Kunyoa & Steaming' },
                      { name: 'Afya Bora Pharmacy', loc: 'Kariakoo', price: 12000, desc: 'Dawa na Huduma ya Kwanza' }
                    ].map((s) => (
                      <div key={s.name} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-neutral-200 dark:border-neutral-700">
                        <h5 className="text-sm font-black text-neutral-900 dark:text-white">{s.name}</h5>
                        <p className="text-[11px] text-neutral-400">{s.desc} • {s.loc}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-mono font-black text-emerald-600">TZS {s.price.toLocaleString()}</span>
                          <button
                            onClick={() => handleNfcRestaurantPay(s.name, 'Kaunta', s.desc, s.price)}
                            className="px-3 py-1.5 rounded-xl bg-[#3b66f5] text-white text-xs font-bold"
                          >
                            Lipa kwa NFC
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. DEDICATED FACE PAYMENT SHOWCASE & QUICK PAY (NICHOLAS RENOTTE & MURTAZA AI) */}
              {nfcSubCategory === 'face' && (
                <div className="space-y-6">
                  {/* Hero Banner for Face Pay */}
                  <div className="p-8 rounded-[36px] bg-gradient-to-br from-[#0b162c] via-[#102447] to-[#0d121f] text-white border border-cyan-500/30 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 max-w-2xl space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-black uppercase tracking-wider">
                        <ScanFace className="w-3.5 h-3.5 animate-pulse" />
                        <span>Smile-to-Pay Biometric Revolution ⚡</span>
                      </div>

                      <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                        Lipa kwa Tabasamu: Hakuna Simu ya Mkononi, Hakuna Kadi wala PIN!
                      </h3>

                      <p className="text-sm text-cyan-100/80 leading-relaxed">
                        Teknolojia ya kisasa ya Computer Vision &amp; Deep Learning (Face Biometrics yenye 468 facial mesh points na liveness detection). Unaangalia kamera ya muuzaji au dereva, unatabasamu, na malipo yanapita papo hapo kwa sekunde 2.
                      </p>

                      <div className="pt-2 flex flex-wrap gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            handleTriggerFacePayment({
                              amount: 5000,
                              recipient: 'PapoPay Demo Checkout',
                              service: 'Jaribio la Biometric Liveness Scan'
                            });
                          }}
                          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center gap-2 active:scale-95 transition-all"
                        >
                          <ScanFace className="w-4 h-4" />
                          <span>Jaribu Kulipa kwa Uso Sasa (Demo)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsFaceRegisterModalOpen(true)}
                          className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all"
                        >
                          <UserPlus className="w-4 h-4 text-cyan-300" />
                          <span>{isFaceRegistered ? 'Sasisha Uso Wako' : 'Sajili Uso Wako Sasa'}</span>
                        </button>

                        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono">
                          {isFaceRegistered ? (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="font-bold">Uso Umesajiliwa</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-400">
                              <UserX className="w-4 h-4" />
                              <span className="font-bold">Haujasajiliwa (Unregistered)</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Test Toggle for Registered vs Unregistered Face */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsFaceRegistered(prev => !prev);
                            toast.info(`Hali ya majaribio ya uso imebadilishwa kuwa: ${!isFaceRegistered ? 'Umesajiliwa' : 'Haujasajiliwa'}`);
                          }}
                          className="px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-[11px] font-mono text-neutral-300 flex items-center gap-1.5 transition-colors"
                          title="Bofya kubadili hali ya usajili ili kupima utambuzi wa mtu asiyesajiliwa"
                        >
                          <span>Majaribio:</span>
                          <span className={isFaceRegistered ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                            {isFaceRegistered ? '✓ Aliyesajiliwa' : '⚠️ Asiyesajiliwa'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3 Quick Face-Payment Merchant Presets */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                      {
                        title: 'Kahawa & Pastry (Cafe)',
                        merchant: 'Kariakoo Specialty Coffee',
                        amount: 6500,
                        tag: 'SMILE TO PAY',
                        desc: 'Cappuccino kubwa + Croissant'
                      },
                      {
                        title: 'Supermarket Express Check-out',
                        merchant: 'Shoppers Plaza Mikocheni',
                        amount: 32000,
                        tag: 'FACE KIOSK',
                        desc: 'Bila kusubiri foleni kaunta'
                      },
                      {
                        title: 'Nauli ya Bolt / Papo Hapo',
                        merchant: 'Dereva Hamisi (Toyota Crown)',
                        amount: 14500,
                        tag: 'RIDE PAY',
                        desc: 'Masaki ➔ Uwanja wa Ndege (JNIA)'
                      }
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-cyan-500/20 dark:border-cyan-500/10 shadow-xs hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                              {item.tag}
                            </span>
                            <span className="font-mono text-base font-black text-neutral-900 dark:text-white">
                              TZS {item.amount.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-neutral-900 dark:text-white">
                            {item.title}
                          </h4>
                          <p className="text-xs text-neutral-500">
                            {item.merchant} &bull; {item.desc}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleTriggerFacePayment({
                              amount: item.amount,
                              recipient: item.merchant,
                              service: item.title
                            });
                          }}
                          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                        >
                          <ScanFace className="w-4 h-4" />
                          <span>Lipa TZS {item.amount.toLocaleString()} kwa Uso</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* KIOSK TERMINAL LAUNCHER BANNER (MURTAZA'S WORKSHOP) */}
                  <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900/40 via-cyan-900/30 to-indigo-900/40 border border-cyan-400/40 flex flex-col md:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                        <Store className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-white">
                            PapoPay Express Terminal (Kiosk &amp; Mageti ya BRT)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-bold">
                            Murtaza AI
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300">
                          Mfumo wa Skrini ya Kaunta, Self-Checkout na Mageti ya Moja kwa Moja ya Treni/BRT (Turnstile Auto Gate Passage).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsKioskModalOpen(true)}
                      className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>Fungua Kiosk Terminal Hapa</span>
                    </button>
                  </div>

                  {/* WAKALA & MERCHANT POS BANNER (DEDICATED PANELS) */}
                  <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-cyan-950/60 border border-emerald-400/50 flex flex-col lg:flex-row items-center justify-between gap-5 shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                        <Building2 className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-white">
                            Portals za Wakala &amp; Merchant POS (Panel Zao Maalum)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                            PANEL ZA KUJITEGEMEA
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300">
                          Mawakala na Wamiliki wa Maduka, Migahawa &amp; Hoteli wana paneli zao maalum za kujisajili, kulogin, na kusimamia malipo ya uso bila kuwa sawa na watumiaji wa kawaida!
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
                      <Link
                        to="/wakala"
                        className="flex-1 lg:flex-initial px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Fungua Panel ya Wakala</span>
                      </Link>

                      <Link
                        to="/merchant"
                        className="flex-1 lg:flex-initial px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <ScanFace className="w-4 h-4" />
                        <span>Fungua Merchant POS</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setIsWakalaModalOpen(true)}
                        className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
                        title="Fungua terminal ya haraka hapa"
                      >
                        <Store className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* BIOMETRIC ENROLLMENT & ANTI-SPOOFING MANAGEMENT (MURTAZA SECURITY ENGINE) */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                            Usimamizi wa Face ID &amp; Anti-Spoofing Profile
                          </h4>
                          <p className="text-xs text-neutral-400">
                            Usalama wa kibayometriki &bull; Murtaza OpenCV + MediaPipe Engine
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                          isFaceRegistered 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isFaceRegistered ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {isFaceRegistered ? 'Uso: Umesajiliwa' : 'Uso: Bado Haujasajiliwa'}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                          isFaceIdActive 
                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30' 
                            : 'bg-neutral-500/10 text-neutral-500'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isFaceIdActive ? 'bg-cyan-500' : 'bg-neutral-400'}`} />
                          {isFaceIdActive ? 'Face ID: Active' : 'Face ID: Imesitishwa'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-400">Mesh Landmarks</span>
                        <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                          468 Points
                        </div>
                        <p className="text-[10px] text-neutral-500">Murtaza cvzone Vector</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-400">Anti-Spoofing Rating</span>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          99.8% Genuine Live
                        </div>
                        <p className="text-[10px] text-neutral-500">Ulinzi wa Picha Feki / Video</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-400">Kikomo kwa Siku</span>
                        <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                          TZS {faceDailyLimit.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-neutral-500">Max Face Transaction</p>
                      </div>
                    </div>

                    {/* Limit Selector & Quick Controls */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-600 dark:text-neutral-400">Kikomo cha Siku:</span>
                        {[100000, 250000, 500000, 1000000].map(limit => (
                          <button
                            key={limit}
                            type="button"
                            onClick={() => {
                              setFaceDailyLimit(limit);
                              toast.success(`Kikomo cha Face Pay kimewekwa kuwa TZS ${limit.toLocaleString()}`);
                            }}
                            className={`px-2.5 py-1 rounded-xl font-mono font-bold transition-all ${
                              faceDailyLimit === limit 
                                ? 'bg-cyan-500 text-white shadow-xs' 
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                            }`}
                          >
                            {limit >= 1000000 ? `${limit/1000000}M` : `${limit/1000}k`}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Simulation Toggle: Test Registered vs Unregistered */}
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = !isFaceRegistered;
                            setIsFaceRegistered(newStatus);
                            if (!newStatus) {
                              toast.warning("Hali imebadilishwa kuwa: Mtu Asiyesajiliwa. Jaribu kulipa kwa uso sasa uone jinsi mfumo unavyomwambia ajisajili!");
                            } else {
                              toast.success("Hali imebadilishwa kuwa: Uso Umesajiliwa!");
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-all border text-xs flex items-center gap-1.5 ${
                            !isFaceRegistered
                              ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                              : 'bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-neutral-300/40 dark:border-neutral-700'
                          }`}
                          title="Jaribu mwitikio wa mfumo wakati mtu asiyesajiliwa anapojaribu kulipa"
                        >
                          <UserX className="w-3.5 h-3.5 text-amber-500" />
                          <span>{!isFaceRegistered ? 'Hali: Asiyesajiliwa (Inajaribiwa)' : 'Jaribu Mtu Asiyesajiliwa'}</span>
                        </button>

                        {/* Open Face Registration Modal */}
                        <button
                          type="button"
                          onClick={() => setIsFaceRegisterModalOpen(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isFaceRegistered ? 'Sajili / Badili Uso' : 'Sajili Uso Wako Sasa'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsFaceIdActive(!isFaceIdActive);
                            toast(isFaceIdActive ? 'Face Pay imesitishwa kwa muda' : 'Face Pay imewashwa tena!');
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                            isFaceIdActive 
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30' 
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                          }`}
                        >
                          {isFaceIdActive ? 'Sitisha' : 'Washa'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleTriggerFacePayment({
                              amount: 2500,
                              recipient: 'PapoPay Biometric Health Test',
                              service: 'Uhakiki wa Uhai & Kupepesa Macho'
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold text-xs"
                        >
                          Jaribio la Liveness
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SMART SHOPPING CART & KAUNTA YA VITU (PYSOURCE YOLO VISION) */}
              {nfcSubCategory === 'vision_checkout' && (
                <div className="space-y-6">
                  {/* Hero Showcase Banner */}
                  <div className="p-8 rounded-[36px] bg-gradient-to-br from-[#061817] via-[#092b28] to-[#0c1f2e] text-white border border-emerald-500/40 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 max-w-2xl space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                        <Scan className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                        <span>Teknolojia ya Pysource &bull; Sergio Canu Computer Vision</span>
                      </div>

                      <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                        Kaunta ya Vitu &amp; Smart Shopping Cart <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                          Bila Kuchanganua Barcode Moja Moja!
                        </span>
                      </h3>

                      <p className="text-sm text-neutral-300 leading-relaxed">
                        Mteja anapoweka bidhaa zake mezani au kwenye trei ya kaunta ya supermarket, kamera ya juu (Top-down Camera) inazitambua zote kwa wakati mmoja kwa kutumia <strong>YOLO Instance Detection</strong>, kuhesabu bili kamili, na kutoa fursa ya kulipa kwa uso au kadi kwa sekunde 1 tu.
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsVisionCheckoutOpen(true)}
                          className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-500/30 flex items-center gap-2.5 active:scale-95 transition-all"
                        >
                          <Scan className="w-4 h-4" />
                          <span>Fungua Kaunta ya Vitu Sasa (Live YOLO Scanner)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsKioskModalOpen(true)}
                          className="px-5 py-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          Fungua Kiosk Terminal Mode
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-black">
                        <Zap className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-black text-neutral-900 dark:text-white">
                        Multi-Object YOLOv11 Tracking
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Inatambua bidhaa zaidi ya 10 zikiwa zimerundikwa au kupangwa pamoja mezani kwa chini ya milisekunde 18 bila kuhitaji kugeuza bidhaa kutafuta barcode.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center font-black">
                        <Activity className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-black text-neutral-900 dark:text-white">
                        Uhesabuji wa Bili Kiotomatiki
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Bili inajisasisha mara moja kitu kinapowekwa au kuondolewa mezani, ikiwemo Kodi ya Ongezeko la Thamani (TRA VAT 18%) na punguzo la ofa.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-black">
                        <ScanFace className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-black text-neutral-900 dark:text-white">
                        Malipo ya Uso (Face Pay) Kauntani
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Baada ya YOLO kukokotoa vitu, mteja anatazama tu skrini ya kaunta, anathibitisha kwa kupepesa macho, na kiasi kinakatwa kutoka mkoba wa PapoPay papo hapo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: VIRTUAL CARDS & STUDENT SMART CARDS */}
          {/* ========================================================================= */}
          {activeSection === 'virtual_cards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Virtual Mastercard Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-6">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                    PapoPay Virtual Mastercard 💳
                  </h3>
                  <p className="text-xs text-neutral-500">Kadi ya mtandaoni kwa ajili ya manunuzi, Netflix, Spotify &amp; Ads</p>
                </div>

                {/* 3D-effect Mastercard Graphic */}
                <div className={`p-6 rounded-3xl text-white shadow-2xl relative overflow-hidden transition-all ${
                  isCardFrozen 
                    ? 'bg-gradient-to-tr from-neutral-700 to-neutral-800 grayscale'
                    : 'bg-gradient-to-tr from-neutral-900 via-indigo-950 to-blue-900'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs font-black tracking-widest text-blue-300 uppercase">PAPOPAY PLATINUM</span>
                    <span className="text-sm font-black italic">mastercard</span>
                  </div>

                  <div className="w-10 h-8 rounded-lg bg-amber-400/80 border border-amber-300 mb-6 flex items-center justify-center">
                    <div className="w-6 h-5 border border-amber-600 rounded-xs opacity-75" />
                  </div>

                  <div className="space-y-4">
                    <div className="text-xl sm:text-2xl font-mono tracking-widest font-black">
                      5399 •••• •••• 9104
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">Card Holder</span>
                        <span className="font-bold">{userDisplayName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">Expires</span>
                        <span className="font-bold">10/29</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">CVV</span>
                        <span className="font-bold">{showCardCvv ? '812' : '•••'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowCardCvv(!showCardCvv)}
                    className="py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-2"
                  >
                    {showCardCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{showCardCvv ? 'Ficha CVV' : 'Onyesha CVV'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsCardFrozen(!isCardFrozen);
                      toast.success(isCardFrozen ? 'Kadi imefunguliwa!' : 'Kadi imegandishwa kwa usalama!');
                    }}
                    className={`py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 ${
                      isCardFrozen
                        ? 'bg-rose-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isCardFrozen ? 'Fungua Kadi' : 'Gandisha Kadi'}</span>
                  </button>
                </div>
              </div>

              {/* Student NFC Cards */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Kadi za NFC za Wanafunzi 🎓
                    </h3>
                    <p className="text-xs text-neutral-500">Watoto wanasafiri salama kwa TZS 200 bila chenji</p>
                  </div>
                  <button
                    onClick={() => toast.info('Kipengele cha kuongeza mwanafunzi kimefunguka')}
                    className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {studentCards.map((card) => (
                    <div key={card.id} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${card.avatarColor} text-white font-black text-sm flex items-center justify-center`}>
                            {card.studentName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-neutral-900 dark:text-white">{card.studentName}</h4>
                            <p className="text-[11px] text-neutral-400">{card.schoolName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-black text-emerald-600 block">TZS {card.balance.toLocaleString()}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{card.cardNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-700 text-xs">
                        <span className="text-neutral-500">Kikomo kwa siku: TZS {card.dailyLimit}</span>
                        <button
                          onClick={() => handleStudentCardTopUp(card.id, 5000)}
                          className="px-3 py-1 rounded-xl bg-[#3b66f5] text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                        >
                          + Weka TZS 5,000
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: TRANSFER & SPLIT FARE */}
          {/* ========================================================================= */}
          {activeSection === 'transfer_exchange' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Send Money to PapoPay User (@username, Wallet ID, or Phone) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center font-bold">
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                        Send Money to PapoPay User
                      </h3>
                      <p className="text-xs text-neutral-500">Tuma kwa @username (mf. @amourrashid), Wallet ID (PP...), au Simu</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityUsernameInput(usernameHandle ? usernameHandle.replace(/^@+/, '') : '');
                      setIsSecurityModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 cursor-pointer shrink-0"
                  >
                    {hasPinSet ? '🔐 PIN / @user' : '⚠️ Weka PIN'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Mpokeaji (@username, Wallet ID au Namba ya Simu)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Mfano: @jumamohamed, PP4225358 au 0712345678"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold pr-10"
                      />
                      {isLookingUpRecipient && (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#3b66f5] absolute right-3.5 top-1/2 -translate-y-1/2" />
                      )}
                    </div>

                    {/* Auto-Verified Recipient Profile Card */}
                    {lookupResult && (
                      <div
                        className={`mt-2.5 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          lookupResult.found
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {lookupResult.found ? (
                          <>
                            <div className="flex items-center gap-3 min-w-0">
                              {lookupResult.photoURL ? (
                                <img
                                  src={lookupResult.photoURL}
                                  alt={lookupResult.displayName}
                                  className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                                  {lookupResult.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-sm text-neutral-900 dark:text-white truncate">
                                    {lookupResult.displayName}
                                  </span>
                                  {lookupResult.verified && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 truncate">
                                  {lookupResult.username ? `${lookupResult.username} • ` : ''}
                                  ID: {lookupResult.maskedWalletId || 'PP****'}
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-300">
                            <UserX className="w-4 h-4 shrink-0" />
                            <span>Mtumiaji hakupatikana kwenye PapoPay. Hakikisha @username au Wallet ID ni sahihi.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Kiasi (TZS)
                    </label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Ujumbe / Sababu (Hiari)
                    </label>
                    <input
                      type="text"
                      placeholder="Mfano: Malipo ya bidhaa"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-xs font-medium"
                    />
                  </div>

                  {/* Fee & Total Summary */}
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Transfer Amount:</span>
                      <span className="font-mono font-bold">TZS {transferAmtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Transaction Fee:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {computedP2PFee === 0 ? 'TZS 0 (FREE)' : `TZS ${computedP2PFee.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-neutral-200 dark:border-neutral-700 font-black">
                      <span>Total to be Deducted:</span>
                      <span className="font-mono text-[#3b66f5]">TZS {(transferAmtNum + computedP2PFee).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-neutral-400">
                        Transaction PIN (Tarakimu 4–6)
                      </label>
                      {!hasPinSet && (
                        <button
                          type="button"
                          onClick={() => setIsSecurityModalOpen(true)}
                          className="text-[11px] font-bold text-[#3b66f5] underline cursor-pointer"
                        >
                          Weka PIN Kwanza
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      value={transferPin}
                      onChange={(e) => setTransferPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold tracking-widest"
                    />
                  </div>

                  {transferError && (
                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{transferError}</span>
                    </div>
                  )}

                  <button
                    disabled={isTransferring || (Boolean(lookupResult) && !lookupResult?.found)}
                    onClick={handleExecuteTransfer}
                    className="w-full py-4 rounded-2xl bg-[#3b66f5] hover:bg-[#2f55e0] disabled:opacity-60 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    {isTransferring ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>Thibitisha &amp; Tuma TZS {(transferAmtNum + computedP2PFee).toLocaleString()}</span>
                  </button>
                </div>
              </div>

              {/* Gawana Nauli (Split Fare Calculator) */}
              <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                      Gawana Nauli &amp; Bili ya Mgahawa (Split Bill)
                    </h3>
                    <p className="text-xs text-neutral-500">Mlipie pamoja bili ya meza, daladala au taxi kirahisi</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Jumla ya Bili (TZS)
                    </label>
                    <input
                      type="number"
                      value={splitTotal}
                      onChange={(e) => setSplitTotal(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                      Idadi ya Watu
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={splitPeople}
                      onChange={(e) => setSplitPeople(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                    />
                  </div>

                  <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-center space-y-1">
                    <span className="text-xs text-neutral-500 uppercase font-bold">Kila mtu analipa:</span>
                    <div className="text-3xl font-black font-mono text-[#3b66f5]">
                      TZS {Math.ceil(Number(splitTotal || 0) / Math.max(1, Number(splitPeople || 1))).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const perPerson = Math.ceil(Number(splitTotal || 0) / Math.max(1, Number(splitPeople || 1)));
                      const text = `Habari! Naomba unilipe sehemu yako ya TZS ${perPerson.toLocaleString()} kupitia PapoPay (${activeWalletId ? `Wallet ID: ${activeWalletId}` : 'PapoWallet'})`;
                      navigator.clipboard.writeText(text);
                      toast.success('Ujumbe wa mgawanyo umenakiliwa! Unaweza kuutuma WhatsApp.');
                    }}
                    className="w-full py-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Nakili Ujumbe wa WhatsApp kwa Wenzako</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: LUKU, DAWASA, KING'AMUZI & VOCHA UNIFIED BILLS HUB */}
          {/* ========================================================================= */}
          {activeSection === 'mobile_recharge' && (
            <div className="space-y-6">
              {/* Quick Saved Accounts & Meters Bar */}
              {savedBillAccounts.length > 0 && (
                <div className="p-4 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                      Namba & Mita Zilizohifadhiwa (Lipa kwa Mbofyo 1)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">App + WhatsApp Sync</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedBillAccounts.map((item, idx) => (
                      <button
                        key={`${item.kind}-${item.account}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (item.kind === 'luku') {
                            setLukuMeter(item.account);
                          } else if (item.kind === 'dawasa') {
                            setUtilityProvider('DAWASA');
                            setUtilityAccount(item.account);
                          } else if (item.kind === 'tv') {
                            if (item.label.includes('DStv')) setUtilityProvider('DStv');
                            else if (item.label.includes('Star')) setUtilityProvider('StarTimes');
                            else setUtilityProvider('AzamTV');
                            setUtilityAccount(item.account);
                          } else if (item.kind === 'vocha') {
                            setVochaPhone(item.account);
                          }
                          toast.info(`Imejaza: ${item.label} (${item.account})`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-amber-50 dark:bg-neutral-800 dark:hover:bg-amber-950/30 border border-neutral-200 dark:border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <span>{item.label}</span>
                        <span className="font-mono text-[11px] text-neutral-500">{item.account}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. LUKU Umeme Purchase */}
                <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                        LUKU Umeme TANESCO
                      </h3>
                      <p className="text-xs text-neutral-500">Tokeni ya umeme papo hapo</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Namba ya Mita ya LUKU
                      </label>
                      <input
                        type="text"
                        value={lukuMeter}
                        onChange={(e) => setLukuMeter(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Kiasi (TZS)
                      </label>
                      <div className="flex gap-1.5 mb-2">
                        {['5000', '10000', '20000', '50000'].map((amtPreset) => (
                          <button
                            key={amtPreset}
                            type="button"
                            onClick={() => setLukuAmount(amtPreset)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border ${
                              lukuAmount === amtPreset
                                ? 'bg-amber-500 text-neutral-950 border-amber-500'
                                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {(Number(amtPreset) / 1000)}k
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={lukuAmount}
                        onChange={(e) => setLukuAmount(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                      />
                    </div>

                    {generatedLukuToken && (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">TOKEN YAKO YA LUKU:</span>
                        <div className="text-lg font-black font-mono tracking-wider text-emerald-900 dark:text-emerald-100 select-all">
                          {generatedLukuToken}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedLukuToken);
                            toast.success('Token ya LUKU imenakiliwa!');
                          }}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                        >
                          Nakili Token
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isBuyingLuku}
                      onClick={handleBuyLuku}
                      className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {isBuyingLuku ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                      <span>Nunua LUKU TZS {Number(lukuAmount || 0).toLocaleString()}</span>
                    </button>
                  </div>
                </div>

                {/* 2. DAWASA Maji & King'amuzi (AzamTV / DStv / StarTimes) */}
                <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                        Maji (DAWASA) &amp; TV
                      </h3>
                      <p className="text-xs text-neutral-500">DAWASA, AzamTV, DStv &amp; StarTimes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(['DAWASA', 'AzamTV', 'DStv', 'StarTimes'] as const).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setUtilityProvider(prov)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all ${
                          utilityProvider === prov
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {prov === 'DAWASA' ? '💧 DAWASA' : `📺 ${prov}`}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        {utilityProvider === 'DAWASA' ? 'Namba ya Akaunti ya Maji' : `Namba ya Kadi (${utilityProvider})`}
                      </label>
                      <input
                        type="text"
                        value={utilityAccount}
                        onChange={(e) => setUtilityAccount(e.target.value)}
                        placeholder={utilityProvider === 'DAWASA' ? 'Mfano: DW-4409128' : 'Mfano: 402918374'}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Kiasi (TZS)
                      </label>
                      <input
                        type="number"
                        value={utilityAmount}
                        onChange={(e) => setUtilityAmount(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                      />
                    </div>
                  </div>

                  {lastUtilityReceipt && (
                    <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-xs space-y-1">
                      <span className="font-black text-cyan-700 dark:text-cyan-300 block">
                        ✅ {lastUtilityReceipt.title}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-300 block font-mono">
                        {lastUtilityReceipt.refCode}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isPayingUtility}
                    onClick={handlePayUtilityBill}
                    className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isPayingUtility ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    <span>Lipa {utilityProvider} TZS {Number(utilityAmount || 0).toLocaleString()}</span>
                  </button>
                </div>

                {/* 3. Vocha & Data Bundles */}
                <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center font-bold">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                        Vocha &amp; Vifurushi
                      </h3>
                      <p className="text-xs text-neutral-500">Vodacom, Tigo, Airtel, Halotel (+5% pts)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(['Vodacom', 'Tigo', 'Airtel', 'Halotel'] as const).map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => setVochaNetwork(net)}
                        className={`p-2.5 rounded-2xl border text-left transition-all ${
                          vochaNetwork === net
                            ? 'bg-[#3b66f5] text-white border-[#3b66f5] shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <h5 className="font-black text-xs">{net}</h5>
                        <span className={`text-[10px] ${vochaNetwork === net ? 'text-blue-100' : 'text-neutral-400'}`}>
                          5% Cashback
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Namba ya Simu ya Kujaza
                      </label>
                      <input
                        type="tel"
                        value={vochaPhone}
                        onChange={(e) => setVochaPhone(e.target.value)}
                        placeholder="0754123456"
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-sm font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">
                        Kiasi cha Vocha / Kifurushi (TZS)
                      </label>
                      <div className="flex gap-1.5 mb-2">
                        {['1000', '2000', '5000', '10000'].map((vPreset) => (
                          <button
                            key={vPreset}
                            type="button"
                            onClick={() => setVochaAmount(vPreset)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border ${
                              vochaAmount === vPreset
                                ? 'bg-[#3b66f5] text-white border-[#3b66f5]'
                                : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {Number(vPreset).toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={vochaAmount}
                        onChange={(e) => setVochaAmount(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 rounded-2xl text-base font-mono font-bold"
                      />
                    </div>
                  </div>

                  {lastVochaMsg && (
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      ✅ {lastVochaMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isBuyingVocha}
                    onClick={handleBuyVochaBundle}
                    className="w-full py-4 rounded-2xl bg-[#3b66f5] hover:bg-blue-600 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isBuyingVocha ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}
                    <span>Nunua Vocha TZS {Number(vochaAmount || 0).toLocaleString()}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: P2P MARKETPLACE */}
          {/* ========================================================================= */}
          {activeSection === 'p2p' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                    Soko la P2P la Kubadilishana Sarafu (Escrow Protection)
                  </h3>
                  <p className="text-xs text-neutral-500">Nunua au uza TZS / USD kwa wafanyabiashara waliothibitishwa</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                  0% Maker Fee
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'JumaKariakoo_FX', rating: '99.8%', trades: 1420, price: '2,610 TZS', limits: '50,000 - 5,000,000 TZS', methods: 'M-Pesa, NMB' },
                  { name: 'AminaExchange_TZ', rating: '100%', trades: 890, price: '2,608 TZS', limits: '20,000 - 2,000,000 TZS', methods: 'Tigo Pesa, CRDB' },
                  { name: 'MangiTrader24', rating: '99.4%', trades: 2150, price: '2,612 TZS', limits: '100,000 - 10,000,000 TZS', methods: 'M-Pesa, Airtel' }
                ].map((trader) => (
                  <div key={trader.name} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-neutral-900 dark:text-white">{trader.name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">✓ Verified</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">Ufanisi: {trader.rating} • Miamala: {trader.trades} • Njia: {trader.methods}</p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-right">
                        <span className="text-xs text-neutral-400 block">Kiwango</span>
                        <span className="text-base font-black font-mono text-emerald-600">{trader.price}</span>
                      </div>
                      <button
                        onClick={() => toast.success(`Agizo la biashara na ${trader.name} limefunguliwa!`)}
                        className="px-5 py-2.5 rounded-xl bg-[#3b66f5] hover:bg-blue-600 text-white font-bold text-xs"
                      >
                        Nunua USD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: TRANSACTION HISTORY & DIGITAL RECEIPTS */}
          {/* ========================================================================= */}
          {(activeSection === 'history' || activeSection === 'overview') && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#111625] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Kumbukumbu za Miamala (Transaction Ledger)
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Bofya muamala wowote kutazama au kupakua Stakabadhi ya EFD ya TRA.
                  </p>
                </div>

                {activeSection === 'overview' && (
                  <button 
                    onClick={() => setActiveSection('history')}
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold text-[#3b66f5] flex items-center gap-1 transition-colors"
                  >
                    <span>Ona Yote</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {filteredTransactions.length === 0 ? (
                  <p className="py-8 text-center text-xs text-neutral-400 font-semibold">
                    Bado hakuna miamala iliyorekodiwa kwenye akaunti hii.
                  </p>
                ) : (
                  filteredTransactions.map((tx) => {
                    const statusBadgeClass =
                      tx.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : tx.status === 'pending' || tx.status === 'processing'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
                    const statusText =
                      tx.status === 'failed'
                        ? 'FAILED'
                        : tx.status === 'processing'
                        ? 'PROCESSING'
                        : tx.status === 'pending'
                        ? 'PENDING'
                        : 'COMPLETED';
                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSelectedReceipt(tx);
                          setIsReceiptModalOpen(true);
                        }}
                        className="py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 px-2 rounded-2xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                            tx.status === 'failed'
                              ? 'bg-red-50 dark:bg-red-950/40 text-red-600'
                              : tx.status === 'pending' || tx.status === 'processing'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                              : tx.type === 'credit'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                          }`}>
                            {tx.type === 'credit' ? <Download className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {tx.title}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono">
                                {tx.typeLabel || tx.txType || (tx.type === 'credit' ? 'Money Received' : 'Money Sent')}
                              </span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${statusBadgeClass}`}>
                                {statusText}
                              </span>
                              {tx.paymentMethod && (
                                <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                                  {tx.paymentMethod}
                                </span>
                              )}
                            </div>
                            {(tx.sender || tx.recipient) && (
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                {tx.sender ? `Kutoka: ${tx.sender}` : ''}{tx.sender && tx.recipient ? ' ➔ ' : ''}{tx.recipient ? `Kwenda: ${tx.recipient}` : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-sm sm:text-base font-black font-mono block ${
                            tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                          }`}>
                            {tx.type === 'credit' ? '+' : '-'}{formatAmount(tx.amount)}
                          </span>
                          {Number(tx.fee || 0) > 0 && (
                            <span className="text-[10px] font-mono text-amber-600 block">
                              Ada: {formatAmount(Number(tx.fee || 0))}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                            {tx.refCode} • {tx.date} {tx.time}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TOP-UP / DEPOSIT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isTopUpModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#3b66f5] flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Weka Salio PapoPay
                    </h3>
                    <p className="text-xs text-neutral-500">M-Pesa, Tigo Pesa, Airtel Money, Halopesa</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1.5">
                  Chagua Kiasi cha Kuweka (TZS)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['10000', '25000', '50000', '100000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        topUpAmount === amt
                          ? 'bg-[#3b66f5] text-white border-[#3b66f5]'
                          : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {Number(amt).toLocaleString()}
                    </button>
                  ))}
                </div>
                <input 
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-[#3b66f5]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1.5">
                  Chagua Njia (Lipa Namba {PAPO_LIPA_NAMBA} / Simu)
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {([
                    { id: 'lipanamba', label: `Lipa ${PAPO_LIPA_NAMBA}` },
                    { id: 'mpesa', label: 'M-Pesa' },
                    { id: 'tigopesa', label: 'Mixx / Tigo' },
                    { id: 'airtel', label: 'Airtel' },
                    { id: 'halopesa', label: 'Halopesa' },
                  ] as const).map((net) => (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => setTopUpMethod(net.id)}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        topUpMethod === net.id
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {net.label}
                    </button>
                  ))}
                </div>

                {topUpMethod === 'lipanamba' && (
                  <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                          Lipa Namba ({PAPO_LIPA_NAMBA_NAME})
                        </div>
                        <div className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-100">
                          {PAPO_LIPA_NAMBA}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(PAPO_LIPA_NAMBA);
                          toast.success(`Lipa Namba ${PAPO_LIPA_NAMBA} imenakiliwa!`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Nakili</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={topUpLipaRef}
                      onChange={(e) => setTopUpLipaRef(e.target.value)}
                      placeholder="Namba ya Muamala / SMS (hiari, mf. BH82K9...)"
                      className="w-full bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-700 px-3 py-2 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                )}

                <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                  Namba ya Simu ya Malipo
                </label>
                <input 
                  type="tel"
                  value={topUpPhone}
                  onChange={(e) => setTopUpPhone(e.target.value)}
                  placeholder="0712345678"
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              {topUpStatusNote && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{topUpStatusNote}</span>
                </div>
              )}

              <button
                disabled={isProcessingTopUp}
                onClick={handleExecuteTopUp}
                className="w-full py-3.5 rounded-2xl bg-[#3b66f5] hover:bg-[#2f55e0] disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessingTopUp ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  {isProcessingTopUp
                    ? topUpMethod === 'lipanamba'
                      ? 'Inasubiri Uthibitisho wa Admin...'
                      : 'Inasubiri PIN ya Mongike...'
                    : topUpMethod === 'lipanamba'
                    ? `Nimelipa TZS ${Number(topUpAmount || 0).toLocaleString()} (${PAPO_LIPA_NAMBA})`
                    : `Tuma Push ya TZS ${Number(topUpAmount || 0).toLocaleString()}`}
                </span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: DIGITAL RECEIPT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isReceiptModalOpen && selectedReceipt && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  Stakabadhi ya Malipo
                </h3>
                <p className="text-[11px] font-mono text-neutral-400">
                  {selectedReceipt.refCode}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-center space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  {selectedReceipt.typeLabel || 'Kiasi cha Muamala'}
                </span>
                <span className="text-2xl font-black font-mono text-neutral-900 dark:text-white block">
                  {formatAmount(selectedReceipt.amount)}
                </span>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                  selectedReceipt.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : selectedReceipt.status === 'pending' || selectedReceipt.status === 'processing'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedReceipt.status === 'failed'
                    ? '✗ Imeshindikana (Failed)'
                    : selectedReceipt.status === 'pending' || selectedReceipt.status === 'processing'
                    ? '⏳ Inasubiri (Pending)'
                    : '✓ Imekamilika (Completed)'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-400">Tarehe &amp; Muda:</span>
                  <span className="font-mono font-semibold">{selectedReceipt.date} {selectedReceipt.time}</span>
                </div>
                {selectedReceipt.sender && (
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-400">Mtumaji:</span>
                    <span className="font-bold text-right">{selectedReceipt.sender}</span>
                  </div>
                )}
                {selectedReceipt.recipient && (
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-400">Mpokeaji:</span>
                    <span className="font-bold text-right">{selectedReceipt.recipient}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-400">Ada:</span>
                  <span className="font-mono font-bold">{formatAmount(Number(selectedReceipt.fee || 0))}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-400">Njia ya Malipo:</span>
                  <span className="font-bold">{selectedReceipt.paymentMethod || 'PapoPay Wallet'}</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/verify/${selectedReceipt.refCode}`} size={90} />
                <span className="text-[9px] text-neutral-400 font-mono mt-1">Skani Kuhakiki Uhalali wa EFD</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `🧾 *STAKABADHI YA PAPOPAY*\n• Muamala: ${selectedReceipt.title}\n• Kiasi: ${formatAmount(selectedReceipt.amount)}\n• Rejea: ${selectedReceipt.refCode}\n• Hali: Imethibitishwa`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#1fb857] transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Tuma WhatsApp</span>
                </a>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="min-h-[44px] py-2.5 rounded-xl bg-[#3b66f5] text-white font-black text-xs uppercase hover:bg-blue-600 cursor-pointer"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2B: WHATSAPP EXPRESS /pay REVIEW & PAY CHECKOUT SHEET */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {expressCheckoutOpen && (
          <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800"
            >
              {expressStep === 'paid' && expressReceipt ? (
                <div
                  className={`${
                    expressReceipt.status === 'paid'
                      ? 'bg-[#00A884]'
                      : expressReceipt.status === 'pending_admin_confirm'
                      ? 'bg-amber-600'
                      : 'bg-blue-600'
                  } text-white p-6 space-y-5 text-center`}
                >
                  <div
                    className={`w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center shadow-lg ${
                      expressReceipt.status === 'paid'
                        ? 'text-[#00A884]'
                        : expressReceipt.status === 'pending_admin_confirm'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {expressReceipt.status === 'paid' ? (
                      <Check className="w-9 h-9 stroke-[3]" />
                    ) : (
                      <Clock className="w-9 h-9 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/90">
                      {expressReceipt.status === 'paid'
                        ? 'Paid successfully'
                        : expressReceipt.status === 'pending_admin_confirm'
                        ? `Inasubiri Admin (${PAPO_LIPA_NAMBA})`
                        : 'Ombi la USSD Limetumwa'}
                    </p>
                    <h3 className="text-3xl font-black tabular-nums">
                      TZS {expressReceipt.amount.toLocaleString()}
                    </h3>
                    <p className="text-sm font-semibold text-white/95">
                      Kwenda: {expressReceipt.merchantName}
                    </p>
                    <p className="text-xs text-white/85 font-mono">
                      #{expressReceipt.referenceId} • {expressReceipt.methodLabel}
                    </p>
                  </div>

                  {expressReceipt.token && (
                    <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-sm text-left space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-white/90 block">
                        Tokeni yako ya LUKU
                      </span>
                      <span className="text-lg font-black font-mono tracking-wider block">
                        {expressReceipt.token}
                      </span>
                    </div>
                  )}

                  {expressReceipt.message && expressReceipt.status !== 'paid' && (
                    <p className="text-xs bg-white/15 rounded-xl p-3 text-white/95">
                      {expressReceipt.message}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const summary =
                          `✅ PapoPay Risiti\n` +
                          `Rejea: #${expressReceipt.referenceId}\n` +
                          `Mpokeaji: ${expressReceipt.merchantName}\n` +
                          `Kiasi: TZS ${expressReceipt.amount.toLocaleString()}/=\n` +
                          `Njia: ${expressReceipt.methodLabel}` +
                          (expressReceipt.token ? `\nLUKU Token: ${expressReceipt.token}` : '');
                        navigator.clipboard?.writeText(summary);
                        toast.success('Risiti imenakiliwa!');
                      }}
                      className="min-h-[44px] py-2.5 px-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Nakili Risiti</span>
                    </button>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `✅ *RISITI YA PAPOPAY*\n• Rejea: #${expressReceipt.referenceId}\n• Kwenda: ${expressReceipt.merchantName}\n• Kiasi: TZS ${expressReceipt.amount.toLocaleString()}/=\n• Njia: ${expressReceipt.methodLabel}` +
                          (expressReceipt.token ? `\n• LUKU Token: ${expressReceipt.token}` : '')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] py-2.5 px-3 rounded-2xl bg-white text-[#075E54] hover:bg-emerald-50 text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Tuma WhatsApp</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpressCheckoutOpen(false)}
                    className="w-full min-h-[44px] py-2.5 rounded-2xl border border-white/40 text-white text-xs font-bold hover:bg-white/10 cursor-pointer"
                  >
                    Rudi Kwenye PapoPay
                  </button>
                </div>
              ) : expressStep === 'pin' ? (
                <div>
                  <div className="bg-[#0B2D71] text-white px-5 py-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setExpressStep('review');
                        setExpressPin('');
                        setExpressError('');
                      }}
                      className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-white/90 hover:text-white cursor-pointer"
                      aria-label="Rudi nyuma"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-0">
                      <p className="text-[11px] text-blue-200 truncate">{expressRecipientName}</p>
                      <p className="text-base font-black tabular-nums">TZS {expressAmount.toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpressCheckoutOpen(false)}
                      className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
                      aria-label="Funga"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Ingiza PIN ya PapoPay (Tarakimu 4–6)
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Namba: {expressBuyerPhone || '—'} · Bonyeza ✓ ukimaliza
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2.5">
                      {[0, 1, 2, 3, 4, 5].map((idx) => {
                        if (idx >= 4 && expressPin.length <= 4) return null;
                        return (
                          <div
                            key={idx}
                            className={`w-11 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                              expressPin.length > idx
                                ? 'border-[#008069] bg-emerald-50 dark:bg-emerald-950/40 text-neutral-900 dark:text-white'
                                : 'border-neutral-300 dark:border-neutral-700 text-neutral-300'
                            }`}
                          >
                            {expressPin.length > idx ? '•' : ''}
                          </div>
                        );
                      })}
                    </div>

                    {expressError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold text-center">
                        {expressError}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          disabled={expressSubmitting}
                          onClick={() => {
                            if (expressPin.length >= 6) return;
                            const next = expressPin + digit;
                            setExpressPin(next);
                            setExpressError('');
                          }}
                          className="min-h-[52px] rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-lg font-black text-neutral-900 dark:text-white tabular-nums transition-colors cursor-pointer"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={expressSubmitting}
                        onClick={() => setExpressPin((prev) => prev.slice(0, -1))}
                        className="min-h-[52px] rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer"
                        aria-label="Futa tarakimu"
                      >
                        <Delete className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        disabled={expressSubmitting}
                        onClick={() => {
                          if (expressPin.length >= 6) return;
                          const next = expressPin + '0';
                          setExpressPin(next);
                          setExpressError('');
                        }}
                        className="min-h-[52px] rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-lg font-black text-neutral-900 dark:text-white tabular-nums transition-colors cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        disabled={expressSubmitting || expressPin.length < 4}
                        onClick={() => handleExpressCheckoutSubmit()}
                        className="min-h-[52px] rounded-2xl bg-[#008069] hover:bg-[#016a56] disabled:opacity-50 text-white flex items-center justify-center font-black cursor-pointer"
                        aria-label="Thibitisha PIN"
                      >
                        {expressSubmitting ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-[#075E54] text-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-black text-sm shrink-0">
                        {expressRecipientName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black truncate">Review and pay</h3>
                        <p className="text-[11px] text-emerald-100 font-mono truncate">
                          #{expressRef}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpressCheckoutOpen(false)}
                      className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
                      aria-label="Funga"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Mpokeaji
                          </span>
                          <p className="text-sm font-black text-neutral-900 dark:text-white truncate">
                            {expressRecipientName}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">{expressTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Jumla
                          </span>
                          <span className="text-lg font-black font-mono tabular-nums text-[#075E54] dark:text-emerald-400">
                            TZS {expressAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                        Namba Yako ya Simu (Mlipaji)
                      </label>
                      <input
                        type="tel"
                        value={expressBuyerPhone}
                        onChange={(e) => {
                          setExpressBuyerPhone(e.target.value);
                          setExpressError('');
                        }}
                        placeholder="0712345678"
                        className="w-full min-h-[44px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-[#008069]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                          Chagua Njia ya Malipo
                        </label>
                        <span className="text-[11px] font-mono font-bold text-[#3b66f5] tabular-nums">
                          Salio: TZS {balanceTZS.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'papowallet', label: 'PapoPay Wallet', sub: '0% Ada • Papo Hapo' },
                          { id: 'lipanamba', label: `Lipa Namba ${PAPO_LIPA_NAMBA}`, sub: `${PAPO_LIPA_NAMBA_NAME}` },
                          { id: 'mpesa', label: 'M-Pesa', sub: 'USSD Push' },
                          { id: 'tigopesa', label: 'Mixx by Yas', sub: 'Tigo Pesa Push' },
                          { id: 'airtel', label: 'Airtel Money', sub: 'USSD Push' },
                          { id: 'halopesa', label: 'HaloPesa', sub: 'USSD Push' },
                          { id: 'card', label: 'Mastercard / Visa', sub: 'Virtual Card' },
                        ] as const).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setExpressMethod(m.id);
                              setExpressError('');
                            }}
                            className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              expressMethod === m.id
                                ? 'border-[#008069] bg-emerald-50 dark:bg-emerald-950/40'
                                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50'
                            }`}
                          >
                            <div className="text-xs font-black text-neutral-900 dark:text-white">
                              {m.label}
                            </div>
                            <div className="text-[10px] text-neutral-500">{m.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {expressMethod === 'lipanamba' && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                              Lipa Namba ({PAPO_LIPA_NAMBA_NAME})
                            </div>
                            <div className="text-base font-black font-mono text-emerald-900 dark:text-emerald-100">
                              {PAPO_LIPA_NAMBA}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(PAPO_LIPA_NAMBA);
                              toast.success(`Lipa Namba ${PAPO_LIPA_NAMBA} imenakiliwa!`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Nakili</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={expressLipaRef}
                          onChange={(e) => setExpressLipaRef(e.target.value)}
                          placeholder="Namba ya Muamala / SMS (mf. BH82K9...)"
                          className="w-full bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-700 px-3 py-2 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    )}

                    {expressError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                        {expressError}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={expressSubmitting}
                      onClick={() => {
                        if (expressBuyerPhone.replace(/\D/g, '').length < 9) {
                          setExpressError('Weka namba sahihi ya simu ya mlipaji (mf. 0712345678).');
                          return;
                        }
                        if (expressMethod === 'papowallet' || expressMethod === 'card') {
                          setExpressPin('');
                          setExpressError('');
                          setExpressStep('pin');
                        } else {
                          handleExpressCheckoutSubmit();
                        }
                      }}
                      className="w-full min-h-[48px] py-3 rounded-2xl bg-[#008069] hover:bg-[#016a56] disabled:opacity-60 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      {expressSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      <span>
                        {expressMethod === 'papowallet' || expressMethod === 'card'
                          ? `Endelea Kulipa TZS ${expressAmount.toLocaleString()}`
                          : expressMethod === 'lipanamba'
                          ? `Nimelipa TZS ${expressAmount.toLocaleString()} (${PAPO_LIPA_NAMBA})`
                          : `Tuma Push ya TZS ${expressAmount.toLocaleString()}`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2C: ENHANCED PAYMENT LINK CREATOR & WHATSAPP SENDER */}
      <AnimatePresence>
        {isPayLinkModalOpen && (
          <div className="fixed inset-0 z-[225] flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800"
            >
              <div className="bg-[#075E54] text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Enhanced Payment Link</h3>
                    <p className="text-[11px] text-emerald-100">Unda link au tuma Review & Pay WhatsApp</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayLinkModalOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Jina la Huduma / Bidhaa
                  </label>
                  <input
                    type="text"
                    value={payLinkTitle}
                    onChange={(e) => setPayLinkTitle(e.target.value)}
                    placeholder="Mf. Oda ya Viatu / Chakula"
                    className="w-full min-h-[42px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Kiasi cha Malipo (TZS)
                  </label>
                  <input
                    type="number"
                    value={payLinkAmount}
                    onChange={(e) => setPayLinkAmount(e.target.value)}
                    placeholder="15000"
                    className="w-full min-h-[42px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 rounded-xl text-sm font-black font-mono tabular-nums text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Namba ya WhatsApp ya Mteja (Hiari kutuma moja kwa moja)
                  </label>
                  <input
                    type="tel"
                    value={payLinkCustomerPhone}
                    onChange={(e) => setPayLinkCustomerPhone(e.target.value)}
                    placeholder="0712345678"
                    className="w-full min-h-[42px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white"
                  />
                </div>

                {createdPayLink && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <span>Rejea #{createdPayLink.refCode}</span>
                      <span>TZS {createdPayLink.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] font-mono break-all text-emerald-800 dark:text-emerald-300">
                      {createdPayLink.checkoutUrl}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(createdPayLink.checkoutUrl);
                          toast.success('Link imenakiliwa!');
                        }}
                        className="flex-1 min-h-[36px] rounded-xl bg-white dark:bg-neutral-900 border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Nakili Link</span>
                      </button>
                      <a
                        href={`https://wa.me/${payLinkCustomerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `💳 *Ombi la Malipo PapoPay* (#${createdPayLink.refCode})\n• Huduma: ${createdPayLink.title}\n• Kiasi: TZS ${createdPayLink.amount.toLocaleString()}/=\n\n👉 Lipa sasa: ${createdPayLink.checkoutUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[36px] rounded-xl bg-[#008069] text-white text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Shiriki WA</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={payLinkCreating}
                    onClick={() => handleCreateEnhancedPaymentLink(false)}
                    className="min-h-[44px] rounded-2xl border border-[#008069] text-[#008069] hover:bg-emerald-50 font-black text-xs cursor-pointer disabled:opacity-50"
                  >
                    {payLinkCreating ? 'Inaunda...' : 'Unda Link Tu'}
                  </button>
                  <button
                    type="button"
                    disabled={payLinkCreating}
                    onClick={() => handleCreateEnhancedPaymentLink(true)}
                    className="min-h-[44px] rounded-2xl bg-[#008069] hover:bg-[#006b57] text-white font-black text-xs cursor-pointer disabled:opacity-50"
                  >
                    {payLinkCreating ? 'Inatuma...' : 'Tuma Order WhatsApp'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PapoPay Kwenye WhatsApp Interactive Modal */}
      <WhatsAppAIAssistantModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        initialMode="papopay"
      />

      {/* PapoPay Face Payment (Smile-to-Pay) Modal */}
      <FacePaymentModal
        isOpen={isFacePayModalOpen}
        amount={facePayTarget.amount}
        recipientName={facePayTarget.recipient}
        serviceTitle={facePayTarget.service}
        isRegistered={isFaceRegistered}
        onClose={() => setIsFacePayModalOpen(false)}
        onSuccess={(receipt) => {
          setIsFacePayModalOpen(false);
          const val = receipt.amount;
          setBalanceTZS(prev => Math.max(0, prev - val));
          
          const newTx: TransactionItem = {
            id: `tx_${Date.now()}`,
            title: `Malipo ya Uso (Face Pay) - ${facePayTarget.recipient}`,
            subtitle: `${facePayTarget.service} • Smile-to-Pay Verified (${receipt.faceScore}%)`,
            amount: val,
            type: 'debit',
            category: 'merchant',
            date: 'Leo',
            time: receipt.time,
            refCode: `TRX: ${receipt.txId}`,
            status: 'completed'
          };

          setTransactions(prev => [newTx, ...prev]);
          setSelectedReceipt(newTx);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* PapoPay Express Terminal (Murtaza AI Kiosk & Mageti ya BRT) */}
      <PapoPayKioskTerminal
        isOpen={isKioskModalOpen}
        onClose={() => setIsKioskModalOpen(false)}
        onBalanceDeduct={(amount, description) => {
          setBalanceTZS(prev => Math.max(0, prev - amount));
          const newTx: TransactionItem = {
            id: `tx_${Date.now()}`,
            title: `Kiosk Terminal - ${description}`,
            subtitle: `Murtaza AI Face Recognition Pass (TZ-DAR-KIOSK-048)`,
            amount,
            type: 'debit',
            category: 'merchant',
            date: 'Leo',
            time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
            refCode: `KIO-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'completed'
          };
          setTransactions(prev => [newTx, ...prev]);
        }}
      />

      {/* Smart Shopping Cart / Kaunta ya Vitu (Pysource YOLO Vision) */}
      <PysourceVisionCheckout
        isOpen={isVisionCheckoutOpen}
        onClose={() => setIsVisionCheckoutOpen(false)}
        userBalance={balanceTZS}
        onPaymentSuccess={(amount, receiptDesc) => {
          setBalanceTZS(prev => Math.max(0, prev - amount));
          const newTx: TransactionItem = {
            id: `tx_${Date.now()}`,
            title: `Smart Kaunta (YOLO) - ${receiptDesc}`,
            subtitle: `Pysource Vision Multi-Item Checkout (No Barcode Required)`,
            amount,
            type: 'debit',
            category: 'merchant',
            date: 'Leo',
            time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
            refCode: `YOLO-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'completed'
          };
          setTransactions(prev => [newTx, ...prev]);
          setSelectedReceipt(newTx);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* Biometric Face Registration Modal */}
      <FaceRegistrationModal
        isOpen={isFaceRegisterModalOpen}
        onClose={() => setIsFaceRegisterModalOpen(false)}
        initialName={profile?.displayName || (profile as any)?.name || 'Baraka Juma'}
        initialPhone={profile?.phoneNumber || '0754 123 456'}
        onSuccess={(regData) => {
          setIsFaceRegistered(true);
          toast.success(`Uso wa ${regData.name} umesajiliwa kikamilifu! Sasa unaweza kulipa kwa uso.`);
        }}
      />

      {/* PapoPay Wakala & Merchant POS (Maduka, Migahawa & Hoteli) */}
      <PapoPayWakalaPOS
        isOpen={isWakalaModalOpen}
        onClose={() => setIsWakalaModalOpen(false)}
        onBalanceDeposit={(amount, customerName) => {
          setBalanceTZS(prev => prev + amount);
          const newTx: TransactionItem = {
            id: `tx_${Date.now()}`,
            title: `Kuweka Pesa kwa Wakala (Face Cash-In)`,
            subtitle: `Wakala Kituo: TZ-WAKALA-0842-DAR • Uso Umethibitishwa (${customerName})`,
            amount,
            type: 'credit',
            category: 'deposit',
            date: 'Leo',
            time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
            refCode: `WAKALA-DEP-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'completed'
          };
          setTransactions(prev => [newTx, ...prev]);
          setSelectedReceipt(newTx);
          setIsReceiptModalOpen(true);
        }}
        onBalanceWithdraw={(amount, customerName) => {
          setBalanceTZS(prev => Math.max(0, prev - amount));
          const newTx: TransactionItem = {
            id: `tx_${Date.now()}`,
            title: `Kutoa Pesa kwa Wakala (Face Cash-Out)`,
            subtitle: `Wakala Kituo: TZ-WAKALA-0842-DAR • Pesa Taslimu kwa Uso (${customerName})`,
            amount,
            type: 'debit',
            category: 'withdraw',
            date: 'Leo',
            time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
            refCode: `WAKALA-WTH-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'completed'
          };
          setTransactions(prev => [newTx, ...prev]);
          setSelectedReceipt(newTx);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* Security Settings Modal (@username & Transaction PIN) */}
      <AnimatePresence>
        {isSecurityModalOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111625] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#3b66f5] flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      Usalama wa PapoPay &amp; @username
                    </h3>
                    <p className="text-[11px] text-neutral-500">Weka @username ya malipo na Transaction PIN</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-400 block mb-1">
                    PapoPay @username (mf. amourrashid)
                  </label>
                  <input
                    type="text"
                    placeholder="amourrashid"
                    value={securityUsernameInput}
                    onChange={(e) => setSecurityUsernameInput(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold"
                  />
                </div>

                {hasPinSet && (
                  <div>
                    <label className="text-[11px] font-bold uppercase text-neutral-400 block mb-1">
                      Transaction PIN ya Sasa
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      value={securityCurrentPin}
                      onChange={(e) => setSecurityCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-widest"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold uppercase text-neutral-400 block mb-1">
                    {hasPinSet ? 'Transaction PIN Mpya (hiari kubadili, tarakimu 4–6)' : 'Weka Transaction PIN Mpya (tarakimu 4–6)'}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Mfano: 2580"
                    value={securityNewPin}
                    onChange={(e) => setSecurityNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-widest"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-bold cursor-pointer"
                >
                  Funga
                </button>
                <button
                  type="button"
                  disabled={isSavingSecurity}
                  onClick={handleSaveSecurityProfile}
                  className="flex-1 py-3 rounded-xl bg-[#3b66f5] hover:bg-[#2f55e0] text-white text-xs font-black uppercase cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingSecurity ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Hifadhi Salama</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
