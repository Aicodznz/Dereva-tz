import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Banknote, ArrowDownLeft, ArrowUpRight, ScanFace, 
  CheckCircle2, AlertCircle, X, ShieldCheck, RefreshCw, 
  Volume2, VolumeX, Sparkles, UserX, UserPlus, Receipt, 
  Printer, Share2, QrCode, Search, Smartphone, Shield, 
  Check, Clock, Coins, Plus, Trash2, ArrowRight, User, 
  LogOut, Wallet, Building2, Sliders, MapPin, Phone,
  Zap, Droplets, Tv, Send, FileText, ChevronRight, Camera,
  AlertTriangle, SwitchCamera, ChevronDown, ChevronUp, Users, CreditCard,
  Lock, KeyRound, Download, Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { pushNotificationService } from '../../utils/pushNotificationService';
import { BiometricFaceCanvas, BiometricHudMode, FaceTrackResult } from '../papopay/BiometricFaceCanvas';
import { FaceRegistrationModal } from '../papopay/FaceRegistrationModal';
import { toast } from 'sonner';

export interface SimulatedCustomer {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  faceEmbeddingId: string;
  avatar: string;
  isRegistered: boolean;
  hasAccountButNoFace?: boolean;
  nidaNumber?: string;
}

const DEFAULT_WAKALA_CLIENTS: SimulatedCustomer[] = [
  {
    id: 'cust_baraka',
    name: 'Baraka Juma Mrema (Demo)',
    phone: '0754 892 100',
    walletBalance: 3450000,
    faceEmbeddingId: 'EMB-TZ-DAR-9821-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19880412-14102-00001-24'
  },
  {
    id: 'cust_zawadi',
    name: 'Zawadi Bakari Said',
    phone: '0713 401 200',
    walletBalance: 820000,
    faceEmbeddingId: 'EMB-TZ-DAR-4102-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19930725-21040-00002-18'
  },
  {
    id: 'cust_kelvin',
    name: 'Kelvin Mwamba',
    phone: '0788 619 450',
    walletBalance: 125000,
    faceEmbeddingId: 'EMB-TZ-DAR-7719-VERIFIED',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isRegistered: true,
    nidaNumber: '19961103-31890-00003-91'
  },
  {
    id: 'cust_no_face',
    name: 'Amina Hamisi (Akaunti Ipo, Bado Uso)',
    phone: '0714 888 333',
    walletBalance: 250000,
    faceEmbeddingId: 'NOT_ENROLLED',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    isRegistered: false,
    hasAccountButNoFace: true,
    nidaNumber: '19950312-51203-00004-55'
  },
  {
    id: 'cust_unregistered',
    name: 'Mgeni Hajajisajili (Unknown Visitor)',
    phone: '0769 000 000',
    walletBalance: 0,
    faceEmbeddingId: 'UNREGISTERED_NULL',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    isRegistered: false
  }
];

export type WakalaServiceTab = 'deposit' | 'withdraw' | 'airtime' | 'bills' | 'send_money' | 'statement';

export default function WakalaDashboard() {
  const navigate = useNavigate();

  // Load wakala profile from storage
  const [wakalaProfile, setWakalaProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('papopay_current_wakala');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      wakalaId: 'TZ-WAKALA-0842-DAR',
      businessName: 'Wakala wa PapoPay - Dar Express',
      agentName: 'Amani Tarimo (Wakala)',
      phone: '0754 892 100',
      location: 'Dar es Salaam, Posta / Kariakoo',
      wakalaFloatBalance: 8500000,
      commissionEarned: 38400,
      role: 'wakala'
    };
  });

  const [floatBalance, setFloatBalance] = useState<number>(wakalaProfile.wakalaFloatBalance || 8500000);
  const [commissionEarned, setCommissionEarned] = useState<number>(wakalaProfile.commissionEarned || 38400);

  // Active top-level navigation: POS Kaunta Hub vs Wakala wa Kawaida vs Ledger
  const [portalMode, setPortalMode] = useState<'pos_hub' | 'wakala_kawaida' | 'terminal' | 'ledger' | 'float_mgmt'>('pos_hub');

  // Customer DB with localStorage registration support
  const [customers, setCustomers] = useState<SimulatedCustomer[]>(() => {
    const list: SimulatedCustomer[] = [];
    const seenPhones = new Set<string>();

    // 1. Load from registered faces array
    try {
      const facesList = localStorage.getItem('papopay_registered_faces');
      if (facesList) {
        const parsedArr = JSON.parse(facesList);
        if (Array.isArray(parsedArr)) {
          parsedArr.forEach((p, idx) => {
            const isEnrolled = Boolean(p.isEnrolled);
            const phone = p.phone || `0754 000 00${idx}`;
            if (!seenPhones.has(phone)) {
              seenPhones.add(phone);
              list.push({
                id: 'cust_enrolled_' + phone.replace(/\s+/g, ''),
                name: p.name || 'Mteja Aliyesajiliwa',
                phone: phone,
                walletBalance: p.walletBalance || 500000,
                faceEmbeddingId: isEnrolled ? (p.embeddingId || `EMB-REG-${idx}`) : 'NOT_ENROLLED',
                avatar: p.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                isRegistered: isEnrolled,
                hasAccountButNoFace: !isEnrolled,
                nidaNumber: p.nidaNumber || '20010815-44210-00012-77'
              });
            }
          });
        }
      }
    } catch {}

    // 2. Load single registered face if not already added
    try {
      const single = localStorage.getItem('papopay_registered_face');
      const curWalletBal = Number(localStorage.getItem('papopay_wallet_balance')) || 500000;
      if (single) {
        const p = JSON.parse(single);
        const phone = p.phone || '0754 000 000';
        if (!seenPhones.has(phone)) {
          seenPhones.add(phone);
          const isEnrolled = Boolean(p.isEnrolled);
          list.push({
            id: 'cust_enrolled_' + phone.replace(/\s+/g, ''),
            name: p.name || 'Mteja Aliyesajiliwa',
            phone: phone,
            walletBalance: curWalletBal,
            faceEmbeddingId: isEnrolled ? (p.embeddingId || 'EMB-CUSTOM-REGISTERED') : 'NOT_ENROLLED',
            avatar: p.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isRegistered: isEnrolled,
            hasAccountButNoFace: !isEnrolled,
            nidaNumber: '20010815-44210-00012-77'
          });
        }
      }
    } catch {}

    // 3. Append default system clients
    DEFAULT_WAKALA_CLIENTS.forEach(c => {
      if (!seenPhones.has(c.phone)) {
        seenPhones.add(c.phone);
        list.push(c);
      }
    });

    return list.length > 0 ? list : DEFAULT_WAKALA_CLIENTS;
  });

  // Simulated target customer currently at counter in front of camera (Mteja Husika) - starts NULL so no false customer is pre-assumed!
  const [activeSubject, setActiveSubject] = useState<SimulatedCustomer | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Search & filter state for identifying relevant customer
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'registered' | 'unregistered'>('all');

  // Mode: 'live_camera' (real camera tracking) or 'test_profiles' (testing preset customers)
  const [detectionMode, setDetectionMode] = useState<'live_camera' | 'test_profiles'>('live_camera');

  // Face Tracking & System Search Pipeline
  // 'idle_no_face' -> camera on, waiting for customer face
  // 'searching_db' -> face locked, searching system records
  // 'customer_found' -> customer verified, waiting for confirmation or services active
  // 'unregistered' -> face present but not in system, display registration form
  const [searchState, setSearchState] = useState<'idle_no_face' | 'searching_db' | 'customer_found' | 'unregistered'>('idle_no_face');
  const [searchProgress, setSearchProgress] = useState<number>(0);
  const [matchedCustomer, setMatchedCustomer] = useState<SimulatedCustomer | null>(null);
  const [isCustomerConfirmed, setIsCustomerConfirmed] = useState<boolean>(false);
  const [liveFaceDetected, setLiveFaceDetected] = useState<boolean>(false);

  // POS Kaunta Standby & Direct Operations State
  const [posSearchQuery, setPosSearchQuery] = useState<string>('');
  const [posStandbyTab, setPosStandbyTab] = useState<'queue' | 'direct_phone' | 'scan'>('queue');
  const [directPhone, setDirectPhone] = useState<string>('0754 123 456');
  const [directPhoneAmount, setDirectPhoneAmount] = useState<number>(50000);
  const [directCustomerName, setDirectCustomerName] = useState<string>('Mteja wa PapoPay');

  // DUAL SECURITY: Customer Secret PIN Verification State
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinPendingWithdraw, setPinPendingWithdraw] = useState<number | null>(null);

  // FULL NEW CUSTOMER FACE & PIN ENROLLMENT MODAL
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [regFullName, setRegFullName] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regNida, setRegNida] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('1234');
  const [regInitialBalance, setRegInitialBalance] = useState<number>(500000);
  const [regPhotoPreview, setRegPhotoPreview] = useState<string | null>(null);
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState<boolean>(false);

  // WAKALA WA KAWAIDA (STREET KIOSK) STATE
  const [streetWakalaTab, setStreetWakalaTab] = useState<'service' | 'queue' | 'direct_phone' | 'enroll'>('service');
  const [streetSearchQuery, setStreetSearchQuery] = useState<string>('');

  // In-Place Rapid Customer Registration State
  const [quickEnrollName, setQuickEnrollName] = useState('');
  const [quickEnrollPhone, setQuickEnrollPhone] = useState('');
  const [quickEnrollNida, setQuickEnrollNida] = useState('');
  const [isQuickEnrolling, setIsQuickEnrolling] = useState(false);

  // Active Wakala Service when customer is unlocked
  const [activeService, setActiveService] = useState<WakalaServiceTab>('deposit');

  // Inputs for services
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(30000);
  const [airtimeNetwork, setAirtimeNetwork] = useState<'Vodacom' | 'Tigo' | 'Airtel' | 'Halotel'>('Vodacom');
  const [airtimeAmount, setAirtimeAmount] = useState<number>(5000);
  const [billType, setBillType] = useState<'luku' | 'daway' | 'azam'>('luku');
  const [billMeterNumber, setBillMeterNumber] = useState('04291882901');
  const [billAmount, setBillAmount] = useState<number>(20000);
  const [sendRecipientPhone, setSendRecipientPhone] = useState('0712 345 678');
  const [sendAmount, setSendAmount] = useState<number>(25000);

  // Biometric camera controls
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Live Telemetry from BiometricFaceCanvas
  const [liveConfidence, setLiveConfidence] = useState(99.4);
  const [liveDistance, setLiveDistance] = useState(42);
  const [liveLux, setLiveLux] = useState(92);
  const [liveYaw, setLiveYaw] = useState(0);

  // Float modal & Receipt modal
  const [isFloatModalOpen, setIsFloatModalOpen] = useState(false);
  const [floatTopUpAmount, setFloatTopUpAmount] = useState('1000000');
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // History ledger
  const [transactions, setTransactions] = useState<any[]>([
    {
      id: 'WAK-DEP-9921',
      customer: 'Baraka Juma Mrema',
      type: 'Cash-In (Kuweka)',
      amount: 50000,
      commission: 600,
      time: '10:42 AM',
      date: 'Leo',
      status: 'completed'
    },
    {
      id: 'WAK-WTH-8812',
      customer: 'Zawadi Bakari Said',
      type: 'Cash-Out (Kutoa)',
      amount: 30000,
      commission: 360,
      time: '09:15 AM',
      date: 'Leo',
      status: 'completed'
    }
  ]);

  // Mobile Phone View Tabs ('camera' | 'pos' | 'customers' | 'ledger')
  const [mobileTab, setMobileTab] = useState<'camera' | 'pos' | 'customers' | 'ledger'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const speak = (text: string) => {
    if (!soundEnabled || typeof window === 'undefined') return;
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

  const startCamera = async (facingModeParam?: 'user' | 'environment') => {
    try {
      setCameraError(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const mode = facingModeParam || cameraFacing;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("Camera fallback active in Wakala", err);
      setCameraError("Kamera haipatikani au imezuiwa kwenye kivinjari. Unaweza kuchagua mteja hapa chini kuthibitisha.");
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextMode);
    await startCamera(nextMode);
    triggerHapticTap();
    toast.info(`Kamera imebadilishwa: ${nextMode === 'environment' ? 'Kamera ya Nyuma (Kaunta)' : 'Kamera ya Mbele (Selfie)'}`, { icon: '📷' });
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const isSearchingRef = useRef<boolean>(false);
  const faceDetectedDebounceRef = useRef<number>(0);
  const faceAbsentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Capture current video frame as high quality image
  const captureCurrentFrame = (): string => {
    if (videoRef.current) {
      try {
        const vid = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 360;
        const cCtx = canvas.getContext('2d');
        if (cCtx) {
          cCtx.translate(canvas.width, 0);
          cCtx.scale(-1, 1);
          cCtx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch {}
    }
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  };

  useEffect(() => {
    startCamera();
    speak(`Karibu kwenye Kituo cha Wakala cha PapoPay. Mfumo uko tayari kusubiri mteja.`);
    // In live camera mode, wait for an actual face to be detected!
    setSearchState('idle_no_face');
    setMatchedCustomer(null);
    setIsCustomerConfirmed(false);
    return () => stopCamera();
  }, []);

  // Sync balances to storage
  useEffect(() => {
    try {
      const updated = {
        ...wakalaProfile,
        wakalaFloatBalance: floatBalance,
        commissionEarned
      };
      localStorage.setItem('papopay_current_wakala', JSON.stringify(updated));
    } catch {}
  }, [floatBalance, commissionEarned]);

  // LIVE FACE TRACKER CALLBACK from BiometricFaceCanvas:
  // ONLY triggers recognition when an actual human face is verified in front of the camera!
  const facePresenceCountRef = useRef<number>(0);

  const handleFaceTracked = (data: FaceTrackResult) => {
    setLiveConfidence(data.confidence);
    setLiveLux(data.brightness);
    setLiveDistance(data.distanceCm);
    setLiveYaw(data.headYaw);

    if (detectionMode !== 'live_camera') return;

    if (data.detected && data.confidence >= 88) {
      setLiveFaceDetected(true);
      if (faceAbsentTimeoutRef.current) {
        clearTimeout(faceAbsentTimeoutRef.current);
        faceAbsentTimeoutRef.current = null;
      }

      // Require 4 consecutive callbacks of confirmed human face presence (~720ms) before initiating search
      if (searchState === 'idle_no_face' && !isSearchingRef.current) {
        facePresenceCountRef.current++;
        if (facePresenceCountRef.current >= 4) {
          facePresenceCountRef.current = 0;
          executeLiveCameraSearch();
        }
      }
    } else {
      setLiveFaceDetected(false);
      facePresenceCountRef.current = 0;

      // When person steps away from the camera, return to idle standby after 3.5 seconds
      if ((searchState === 'customer_found' || searchState === 'unregistered') && !isCustomerConfirmed && !faceAbsentTimeoutRef.current) {
        faceAbsentTimeoutRef.current = setTimeout(() => {
          if (!isCustomerConfirmed) {
            setSearchState('idle_no_face');
            setMatchedCustomer(null);
            setActiveSubject(null);
            speak("Mteja ameondoka mbele ya kamera. Mfumo unarudi kusubiri mteja mpya.");
          }
          faceAbsentTimeoutRef.current = null;
        }, 3500);
      }
    }
  };

  // SELECT SPECIFIC CUSTOMER AT COUNTER (Mteja Husika)
  const handleSelectCustomerSubject = (customer: SimulatedCustomer, preferredService: WakalaServiceTab = 'deposit') => {
    setActiveSubject(customer);
    setMatchedCustomer(customer);
    setIsCustomerConfirmed(true);
    setSearchState('customer_found');
    setActiveService(preferredService);
    triggerHapticTap();
    playPaymentChime();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileTab('pos');
    }

    speak(`Mteja ${customer.name.split(' ')[0]} amethibitishwa. Unaweza ${preferredService === 'deposit' ? 'kuweka pesa' : preferredService === 'withdraw' ? 'kumtolea pesa' : 'kumpatia huduma'} sasa.`);
    toast.success(`Mteja Yupo Tayari: ${customer.name}`, {
      description: `Simu: ${customer.phone} | Salio: TZS ${customer.walletBalance.toLocaleString()}`,
      icon: '✅'
    });
  };

  // EXECUTE LIVE CAMERA SEARCH (Matches and identifies the genuine relevant customer in front of camera)
  const executeLiveCameraSearch = () => {
    isSearchingRef.current = true;
    setSearchState('searching_db');
    setMatchedCustomer(null);
    setIsCustomerConfirmed(false);
    setSearchProgress(20);

    const snapshot = captureCurrentFrame();

    // 1. If Wakala has explicitly targeted a specific customer at counter, use that
    let targetCustomer: SimulatedCustomer | null = activeSubject;

    // 2. If no subject explicitly selected, in live_camera mode look for genuine registered faces in localStorage
    if (!targetCustomer && detectionMode === 'live_camera') {
      try {
        const stored = localStorage.getItem('papopay_registered_face');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.isEnrolled && parsed.name) {
            targetCustomer = customers.find(c => c.phone === parsed.phone) || {
              id: 'cust_enrolled_' + (parsed.phone || 'custom').replace(/\s+/g, ''),
              name: parsed.name,
              phone: parsed.phone || '0754 000 000',
              walletBalance: parsed.walletBalance || 500000,
              faceEmbeddingId: parsed.embeddingId || 'EMB-CUSTOM-REGISTERED',
              avatar: parsed.photoUrl || snapshot,
              isRegistered: true,
              nidaNumber: parsed.nidaNumber || '20010815-44210-00012-77'
            };
          }
        }
      } catch {}

      if (!targetCustomer) {
        try {
          const storedList = localStorage.getItem('papopay_registered_faces');
          if (storedList) {
            const arr = JSON.parse(storedList);
            if (Array.isArray(arr) && arr.length > 0) {
              const enrolled = arr.find((f: any) => f.isEnrolled && f.name);
              if (enrolled) {
                targetCustomer = customers.find(c => c.phone === enrolled.phone) || {
                  id: 'cust_enrolled_' + (enrolled.phone || '0').replace(/\s+/g, ''),
                  name: enrolled.name,
                  phone: enrolled.phone || '0754 000 000',
                  walletBalance: enrolled.walletBalance || 500000,
                  faceEmbeddingId: enrolled.embeddingId || 'EMB-CUSTOM-REGISTERED',
                  avatar: enrolled.photoUrl || snapshot,
                  isRegistered: true,
                  nidaNumber: enrolled.nidaNumber || '20010815-44210-00012-77'
                };
              }
            }
          }
        } catch {}
      }
    }

    if (targetCustomer) {
      speak(`Uso umepatikana! Inatafuta na kuthibitisha mteja ${targetCustomer.name.split(' ')[0]} kwenye mfumo wa PapoPay...`);
    } else {
      speak("Uso umetambuliwa mbele ya kamera. Inachanganua mfumo wa PapoPay...");
    }

    const pInterval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 90) {
          clearInterval(pInterval);
          return 90;
        }
        return prev + 30;
      });
    }, 150);

    setTimeout(() => {
      clearInterval(pInterval);
      setSearchProgress(100);
      isSearchingRef.current = false;

      if (targetCustomer && targetCustomer.isRegistered) {
        // MATCHED REGISTERED CUSTOMER (MTEJA HUSIKA AMETAMBULIWA KIOTOMATIKI!)
        const verified: SimulatedCustomer = {
          ...targetCustomer,
          avatar: targetCustomer.avatar?.startsWith('data:') ? targetCustomer.avatar : (snapshot || targetCustomer.avatar)
        };

        setMatchedCustomer(verified);
        setActiveSubject(verified);
        setSearchState('customer_found');
        setIsCustomerConfirmed(true); // Confirmed and services active immediately!
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileTab('pos');
        }
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja husika ${verified.name.split(' ')[0]} ametambuliwa kikamilifu kwa uso wake. Salio lake ni shilingi ${verified.walletBalance.toLocaleString()}.`);
        toast.success(`🎯 Uso Umetambuliwa Kiotomatiki: ${verified.name}`, { 
          description: `Simu: ${verified.phone} | Salio: TZS ${verified.walletBalance.toLocaleString()} (Huduma Ziko Wazi)`,
          icon: '✅' 
        });
      } else if (targetCustomer && targetCustomer.hasAccountButNoFace) {
        // CASE: ACCOUNT EXISTS BUT USER HAS NOT ENROLLED FACE YET
        setActiveSubject(targetCustomer);
        setMatchedCustomer(null);
        setIsCustomerConfirmed(false);
        setSearchState('unregistered');
        setQuickEnrollName(targetCustomer.name);
        setQuickEnrollPhone(targetCustomer.phone);
        setQuickEnrollNida(targetCustomer.nidaNumber || '');
        triggerHapticTap();
        speak(`Mteja ${targetCustomer.name.split(' ')[0]} ana akaunti lakini hajasajili uso bado! Tafadhali weka uso wake sasa ili kuwezesha miamala.`);
        toast.warning(`Akaunti Ipo, Bado Hajaweka Uso: ${targetCustomer.name}`, { 
          description: "Mteja hakusajili uso wakati anajisajili. Weka uso wake sasa.",
          icon: '⚠️' 
        });
      } else {
        // CASE: UNREGISTERED FACE! DO NOT GUESS OR DEFAULT TO BARAKA!
        const unregSubject: SimulatedCustomer = {
          id: 'cust_unreg_' + Date.now(),
          name: 'Mteja Mpya (Hajasajiliwa)',
          phone: '',
          walletBalance: 0,
          faceEmbeddingId: 'UNREGISTERED_NULL',
          avatar: snapshot,
          isRegistered: false
        };
        setActiveSubject(unregSubject);
        setMatchedCustomer(null);
        setIsCustomerConfirmed(false);
        setSearchState('unregistered');
        setQuickEnrollName('');
        setQuickEnrollPhone('');
        setQuickEnrollNida('');
        triggerHapticTap();
        speak("Samahani, sura hii haijatambuliwa kwenye mfumo wa PapoPay. Tafadhali jaza jina na namba ya simu kusajili uso wa mteja sasa.");
        toast.error("Sura Haijatambuliwa Kwenye Mfumo!", { 
          description: "Mteja huyu hajasajiliwa bado. Jaza fomu ya usajili wa haraka hapa pembeni.",
          icon: '⚠️' 
        });
      }
    }, 1200);
  };

  // IN-PLACE QUICK REGISTRATION HANDLER
  const handleQuickEnrollSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickEnrollName.trim()) {
      toast.error("Tafadhali weka jina kamili la mteja!");
      return;
    }
    if (!quickEnrollPhone.trim()) {
      toast.error("Tafadhali weka namba ya simu ya mteja!");
      return;
    }

    setIsQuickEnrolling(true);
    speak("Inanasa picha ya uso na kusajili kwenye kanzidata ya PapoPay...");

    const photo = captureCurrentFrame();
    const embId = `EMB-TZ-${Date.now()}`;

    setTimeout(() => {
      const newCustomer: SimulatedCustomer = {
        id: 'cust_' + Date.now(),
        name: quickEnrollName.trim(),
        phone: quickEnrollPhone.trim(),
        walletBalance: 500000,
        faceEmbeddingId: embId,
        avatar: photo,
        isRegistered: true,
        nidaNumber: quickEnrollNida.trim() || '20010915-44210-00012-77'
      };

      try {
        const record = {
          isEnrolled: true,
          name: newCustomer.name,
          phone: newCustomer.phone,
          embeddingId: embId,
          dailyLimit: 1000000,
          photoUrl: photo,
          enrolledAt: new Date().toISOString()
        };
        localStorage.setItem('papopay_registered_face', JSON.stringify(record));

        const existingList = localStorage.getItem('papopay_registered_faces');
        let facesArr: any[] = [];
        if (existingList) {
          try { facesArr = JSON.parse(existingList); } catch {}
        }
        facesArr = facesArr.filter(f => f.phone !== newCustomer.phone);
        facesArr.unshift(record);
        localStorage.setItem('papopay_registered_faces', JSON.stringify(facesArr));
      } catch {}

      setCustomers(prev => [newCustomer, ...prev]);
      setActiveSubject(newCustomer);
      setMatchedCustomer(newCustomer);
      setIsQuickEnrolling(false);
      setSearchState('customer_found');
      setIsCustomerConfirmed(false); // Wakala confirms to unlock services!

      playPaymentChime();
      triggerHapticTap();
      speak(`Hongera! Uso wa ${newCustomer.name.split(' ')[0]} umesajiliwa kikamilifu. Sasa unaweza kuthibitisha na kuweka pesa.`);
      toast.success(`Uso Umesajiliwa Kikamilifu: ${newCustomer.name}`, { icon: '🎉' });
    }, 1100);
  };

  // MANUAL / DEMO SUBJECT SEARCH (Used in Test Profiles mode)
  const triggerFaceSearch = (subject?: SimulatedCustomer | null) => {
    const target = subject || customers.find(c => c.isRegistered) || customers[0];
    if (!target) return;
    setActiveSubject(target);
    setSearchState('searching_db');
    setMatchedCustomer(null);
    setIsCustomerConfirmed(false);
    setSearchProgress(15);

    speak("Uso umepatikana. Inatafuta mteja kwenye mfumo wa PapoPay...");

    const pInterval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev >= 90) {
          clearInterval(pInterval);
          return 90;
        }
        return prev + 25;
      });
    }, 240);

    setTimeout(() => {
      clearInterval(pInterval);
      setSearchProgress(100);

      if (target.isRegistered) {
        setMatchedCustomer(target);
        setSearchState('customer_found');
        setIsCustomerConfirmed(true);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileTab('pos');
        }
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja ${target.name.split(' ')[0]} ametambuliwa kikamilifu. Salio lake ni shilingi ${target.walletBalance.toLocaleString()}. Unaweza kuweka au kutoa pesa sasa.`);
        toast.success(`Mteja Ametambuliwa: ${target.name}`, { 
          description: `Simu: ${target.phone} | Salio: TZS ${target.walletBalance.toLocaleString()}`,
          icon: '✅' 
        });
      } else if (target.hasAccountButNoFace) {
        setSearchState('unregistered');
        setMatchedCustomer(null);
        setQuickEnrollName(target.name);
        setQuickEnrollPhone(target.phone);
        triggerHapticTap();
        speak(`Mteja ${target.name.split(' ')[0]} ana akaunti lakini hajasajili uso bado! Weka uso wake sasa.`);
        toast.warning(`Akaunti Ipo, Bado Uso: ${target.name}`, { 
          description: "Mteja hakusajili uso wakati anajisajili. Weka uso wake sasa.",
          icon: '⚠️' 
        });
      } else {
        setSearchState('unregistered');
        setMatchedCustomer(null);
        setQuickEnrollName('');
        setQuickEnrollPhone('');
        triggerHapticTap();
        speak("Samahani, uso huu haujasajiliwa kwenye mfumo wa PapoPay. Tafadhali jaza fomu ya usajili sasa.");
        toast.error("Uso Haujasajiliwa! Jaza fomu ya usajili hapa chini.", { icon: '⚠️' });
      }
    }, 1200);
  };

  // 1. KUWEKA PESA (CASH-IN DEPOSIT)
  const handleExecuteDeposit = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (depositAmount <= 0) {
      toast.error('Weka kiasi sahihi cha kuweka pesa!');
      return;
    }
    if (floatBalance < depositAmount) {
      toast.error(`Salio la Float ya Wakala halitoshi! (Float: TZS ${floatBalance.toLocaleString()})`);
      speak("Salio lako la float halitoshi kufanya muamala huu. Tafadhali ongeza float.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Inaweka shilingi ${depositAmount.toLocaleString()} kwenye akaunti ya ${matchedCustomer.name.split(' ')[0]}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(depositAmount * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev - depositAmount + commission);

      // Update customer balance
      const updatedBalance = matchedCustomer.walletBalance + depositAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setActiveSubject(updatedCust);
      setCustomers(prev => prev.map(c => (c.id === matchedCustomer.id || c.phone === matchedCustomer.phone) ? updatedCust : c));

      // Persist to localStorage so the PapoPay User Wallet reflects the deposited funds immediately!
      try {
        localStorage.setItem('papopay_wallet_balance', updatedBalance.toString());
        
        // Update registered single face record if exists
        const storedFace = localStorage.getItem('papopay_registered_face');
        if (storedFace) {
          const parsed = JSON.parse(storedFace);
          if (parsed.phone === matchedCustomer.phone || parsed.name === matchedCustomer.name) {
            parsed.walletBalance = updatedBalance;
            localStorage.setItem('papopay_registered_face', JSON.stringify(parsed));
          }
        }

        // Update registered faces array if exists
        const storedList = localStorage.getItem('papopay_registered_faces');
        if (storedList) {
          const parsedList = JSON.parse(storedList);
          if (Array.isArray(parsedList)) {
            const updatedList = parsedList.map((f: any) => 
              (f.phone === matchedCustomer.phone || f.name === matchedCustomer.name)
                ? { ...f, walletBalance: updatedBalance }
                : f
            );
            localStorage.setItem('papopay_registered_faces', JSON.stringify(updatedList));
          }
        }
      } catch {}

      const newTx = {
        id: `WAK-DEP-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: 'Cash-In (Kuweka)',
        amount: depositAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setLastReceipt({
        ...newTx,
        customerPhone: matchedCustomer.phone,
        customerPhoto: matchedCustomer.avatar,
        wakalaId: wakalaProfile.wakalaId,
        businessName: wakalaProfile.businessName
      });

      speak(`Pesa shilingi ${depositAmount.toLocaleString()} zimewekwa kikamilifu kwa ${matchedCustomer.name.split(' ')[0]}. Salio jipya ni shilingi ${updatedBalance.toLocaleString()}. Kamisheni yako ni shilingi ${commission.toLocaleString()}.`);
      toast.success(`TZS ${depositAmount.toLocaleString()} Zimewekwa Kikamilifu!`, { 
        description: `Mteja: ${matchedCustomer.name} | Salio Jipya: TZS ${updatedBalance.toLocaleString()} | Kamisheni: +TZS ${commission.toLocaleString()}`,
        icon: '💰' 
      });

      // Dispatch Real Native Push Notification (Rich Notification)
      pushNotificationService.showRichNotification({
        title: `💰 PapoPay: TZS ${depositAmount.toLocaleString()} Zimewekwa!`,
        body: `Mteja: ${matchedCustomer.name} | Salio Jipya: TZS ${updatedBalance.toLocaleString()} | Kamisheni: +TZS ${commission.toLocaleString()}`,
        image: matchedCustomer.avatar
      }).catch(() => {});
    }, 1000);
  };

  // 2. KUTOA PESA (CASH-OUT WITHDRAWAL - DUAL SECURITY: FACE + PIN)
  const handleExecuteWithdraw = (overrideAmount?: number) => {
    const amt = typeof overrideAmount === 'number' ? overrideAmount : withdrawAmount;
    if (!matchedCustomer || isProcessingAction) return;
    if (amt <= 0) {
      toast.error('Weka kiasi sahihi cha kutoa pesa!');
      return;
    }
    if (matchedCustomer.walletBalance < amt) {
      toast.error(`Salio la mteja halitoshi! (Salio: TZS ${matchedCustomer.walletBalance.toLocaleString()})`);
      speak("Salio la mteja halitoshi kwa kutoa kiasi hiki.");
      return;
    }

    // Require Dual Security: Face Match + Customer Secret PIN
    setEnteredPin('');
    setPinPendingWithdraw(amt);
    setIsPinModalOpen(true);
    triggerHapticTap();
    speak(`Uso wa ${matchedCustomer.name.split(' ')[0]} umethibitishwa. Mteja aingize PIN ya siri kuidhinisha kutoa shilingi ${amt.toLocaleString()}.`);
  };

  const handleConfirmPinWithdrawal = () => {
    if (!pinPendingWithdraw || !matchedCustomer) return;
    const expected = (matchedCustomer as any).pin || '1234';
    if (enteredPin.trim() !== expected && enteredPin.trim() !== '1234') {
      toast.error('PIN ya siri sio sahihi! (PIN ya mfano: 1234)');
      triggerHapticTap();
      return;
    }

    const amt = pinPendingWithdraw;
    setIsPinModalOpen(false);
    setIsProcessingAction(true);
    speak(`PIN imethibitishwa. Mteja anatoa shilingi ${amt.toLocaleString()}. Inakamilisha muamala...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(amt * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev + amt + commission);

      const updatedBalance = matchedCustomer.walletBalance - amt;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setActiveSubject(updatedCust);
      setCustomers(prev => prev.map(c => (c.id === matchedCustomer.id || c.phone === matchedCustomer.phone) ? updatedCust : c));

      // Persist to localStorage so the PapoPay User Wallet reflects the withdrawn funds immediately!
      try {
        localStorage.setItem('papopay_wallet_balance', updatedBalance.toString());
        
        const storedFace = localStorage.getItem('papopay_registered_face');
        if (storedFace) {
          const parsed = JSON.parse(storedFace);
          if (parsed.phone === matchedCustomer.phone || parsed.name === matchedCustomer.name) {
            parsed.walletBalance = updatedBalance;
            localStorage.setItem('papopay_registered_face', JSON.stringify(parsed));
          }
        }

        const storedList = localStorage.getItem('papopay_registered_faces');
        if (storedList) {
          const parsedList = JSON.parse(storedList);
          if (Array.isArray(parsedList)) {
            const updatedList = parsedList.map((f: any) => 
              (f.phone === matchedCustomer.phone || f.name === matchedCustomer.name)
                ? { ...f, walletBalance: updatedBalance }
                : f
            );
            localStorage.setItem('papopay_registered_faces', JSON.stringify(updatedList));
          }
        }
      } catch {}

      const newTx = {
        id: `WAK-WTH-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: 'Cash-Out (Kutoa Taslimu)',
        amount: amt,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed',
        securityMethod: 'AI Face ID + PIN ya Siri (Dual Security)'
      };

      setTransactions(prev => [newTx, ...prev]);
      setLastReceipt({
        ...newTx,
        customerPhone: matchedCustomer.phone,
        customerPhoto: matchedCustomer.avatar,
        wakalaId: wakalaProfile.wakalaId,
        businessName: wakalaProfile.businessName,
        customerBalanceRemaining: updatedBalance
      });

      speak(`Kutoa pesa kwa shilingi ${amt.toLocaleString()} kumethibitishwa kwa uso na PIN. Mkabidhi mteja pesa taslimu.`);
      toast.success(`Kutoa Pesa Kumethibitishwa! Mkabidhi mteja TZS ${amt.toLocaleString()}`, { 
        description: `Mteja: ${matchedCustomer.name} | Salio Lililobaki: TZS ${updatedBalance.toLocaleString()} | Uthibitisho: Face ID + PIN ✓`,
        icon: '💵' 
      });

      // Dispatch Real Native Push Notification (Lock Screen + Banner)
      pushNotificationService.showLockScreenNotification({
        title: `💵 PapoPay: Kutoa Pesa TZS ${amt.toLocaleString()}`,
        body: `Imethibitishwa kwa Sura na PIN ya ${matchedCustomer.name}. Salio Lililobaki: TZS ${updatedBalance.toLocaleString()}.`
      }).catch(() => {});
    }, 1000);
  };

  // FULL NEW CUSTOMER ENROLLMENT SUBMISSION (With Face, NIDA, PIN, and Initial Credit)
  const handleRegisterNewCustomerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!regFullName.trim() || !regPhone.trim()) {
      toast.error('Tafadhali weka jina kamili na namba ya simu ya mteja!');
      return;
    }
    if (!regPin || regPin.length < 4) {
      toast.error('Tafadhali weka PIN ya siri ya tarakimu 4!');
      return;
    }

    setIsRegisteringCustomer(true);
    speak(`Inanasa picha ya uso na kusajili mteja mpya ${regFullName.split(' ')[0]} kwenye mfumo wa PapoPay...`);

    const photo = regPhotoPreview || captureCurrentFrame() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const embId = `EMB-TZ-${Date.now()}`;

    setTimeout(() => {
      const newCustomer: SimulatedCustomer = {
        id: 'cust_' + Date.now(),
        name: regFullName.trim(),
        phone: regPhone.trim(),
        walletBalance: regInitialBalance,
        faceEmbeddingId: embId,
        avatar: photo,
        isRegistered: true,
        nidaNumber: regNida.trim() || `2001${Math.floor(10000000 + Math.random() * 90000000)}-44210-00012-77`
      };
      (newCustomer as any).pin = regPin;

      try {
        const record = {
          isEnrolled: true,
          name: newCustomer.name,
          phone: newCustomer.phone,
          embeddingId: embId,
          dailyLimit: 1000000,
          photoUrl: photo,
          walletBalance: regInitialBalance,
          pin: regPin,
          nidaNumber: newCustomer.nidaNumber,
          enrolledAt: new Date().toISOString()
        };
        localStorage.setItem('papopay_registered_face', JSON.stringify(record));
        localStorage.setItem('papopay_wallet_balance', regInitialBalance.toString());

        const existingList = localStorage.getItem('papopay_registered_faces');
        let facesArr: any[] = [];
        if (existingList) {
          try { facesArr = JSON.parse(existingList); } catch {}
        }
        facesArr = facesArr.filter(f => f.phone !== newCustomer.phone);
        facesArr.unshift(record);
        localStorage.setItem('papopay_registered_faces', JSON.stringify(facesArr));
      } catch {}

      setCustomers(prev => [newCustomer, ...prev]);
      setActiveSubject(newCustomer);
      setMatchedCustomer(newCustomer);
      setIsCustomerConfirmed(true);
      setSearchState('customer_found');
      setIsRegisteringCustomer(false);
      setIsNewCustomerModalOpen(false);

      // Reset fields
      setRegFullName('');
      setRegPhone('');
      setRegNida('');
      setRegPin('1234');
      setRegPhotoPreview(null);

      playPaymentChime();
      triggerHapticTap();
      speak(`Hongera! Mteja ${newCustomer.name.split(' ')[0]} amesajiliwa kikamilifu. Anaweza kuweka au kutoa pesa sasa kwa uso wake na PIN.`);
      toast.success(`Mteja Mpya Amesajiliwa Kikamilifu!`, {
        description: `Jina: ${newCustomer.name} | Simu: ${newCustomer.phone} | PIN: ${regPin} | Salio: TZS ${newCustomer.walletBalance.toLocaleString()}`,
        icon: '🎉'
      });
    }, 1100);
  };

  // ELECTRONIC RECEIPT ACTIONS
  const handlePrintReceipt = () => {
    if (!lastReceipt) return;
    toast.success("Inatuma risiti kwa printer...", { icon: '🖨️' });
    try {
      window.print();
    } catch {}
  };

  const handleShareReceipt = () => {
    if (!lastReceipt) return;
    const text = `RISITI YA WAKALA WA PAPOPAY\nMuamala: ${lastReceipt.id}\nMteja: ${lastReceipt.customer}\nKiasi: TZS ${lastReceipt.amount.toLocaleString()}\nKamisheni: TZS ${lastReceipt.commission.toLocaleString()}\nMuda: ${lastReceipt.date} ${lastReceipt.time}\nUthibitisho: AI Face ID + PIN ✓ (100% Salama)`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Risiti imenakiliwa! Unaweza kuituma kupitia SMS au WhatsApp.", { icon: '📋' });
    } else {
      toast.success("Risiti iko tayari kushirikiwa!", { icon: '📱' });
    }
  };

  // DIRECT CASH-IN DEPOSIT BY PHONE NUMBER (Without requiring face scan)
  const handleExecuteDirectPhoneDeposit = () => {
    if (!directPhone.trim() || directPhoneAmount <= 0) {
      toast.error('Weka namba ya simu na kiasi sahihi cha kuweka pesa!');
      return;
    }
    if (floatBalance < directPhoneAmount) {
      toast.error(`Salio la Float ya Wakala halitoshi! (Float: TZS ${floatBalance.toLocaleString()})`);
      speak("Salio lako la float halitoshi kufanya muamala huu. Tafadhali ongeza float.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Inaweka shilingi ${directPhoneAmount.toLocaleString()} kwa namba ${directPhone}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(directPhoneAmount * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev - directPhoneAmount + commission);

      // Check if target phone matches any enrolled customer
      const existingCust = customers.find(c => c.phone.replace(/\s+/g, '') === directPhone.replace(/\s+/g, ''));
      let targetName = directCustomerName.trim() || 'Mteja wa PapoPay';
      let targetBalance = 500000 + directPhoneAmount;
      let targetAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

      if (existingCust) {
        targetName = existingCust.name;
        targetBalance = existingCust.walletBalance + directPhoneAmount;
        targetAvatar = existingCust.avatar;
        const updated = { ...existingCust, walletBalance: targetBalance };
        setCustomers(prev => prev.map(c => c.id === existingCust.id ? updated : c));
        setMatchedCustomer(updated);
        setIsCustomerConfirmed(true);
      }

      // Persist wallet balance so the user app immediately shows the credited amount!
      try {
        const curWallet = Number(localStorage.getItem('papopay_wallet_balance')) || 3450000;
        localStorage.setItem('papopay_wallet_balance', (curWallet + directPhoneAmount).toString());
      } catch {}

      const newTx = {
        id: `WAK-DEP-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: `${targetName} (${directPhone})`,
        type: 'Cash-In (Kuweka kwa Namba)',
        amount: directPhoneAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setLastReceipt({
        ...newTx,
        customerPhone: directPhone,
        customerPhoto: targetAvatar,
        wakalaId: wakalaProfile.wakalaId,
        businessName: wakalaProfile.businessName
      });

      speak(`Pesa shilingi ${directPhoneAmount.toLocaleString()} zimewekwa kwa namba ${directPhone}. Kamisheni yako ni shilingi ${commission.toLocaleString()}.`);
      toast.success(`TZS ${directPhoneAmount.toLocaleString()} Zimewekwa kwa Namba ya Simu!`, {
        description: `Simu: ${directPhone} | Kamisheni: +TZS ${commission.toLocaleString()}`,
        icon: '📱'
      });
    }, 1000);
  };

  // 3. NUNUA VOCHA (AIRTIME)
  const handleExecuteAirtime = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (airtimeAmount <= 0) return;
    if (matchedCustomer.walletBalance < airtimeAmount) {
      toast.error("Salio la mteja halitoshi kununua vocha.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Inanunua vocha ya ${airtimeNetwork} shilingi ${airtimeAmount.toLocaleString()}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(airtimeAmount * 0.03); // 3% airtime commission
      setCommissionEarned(prev => prev + commission);

      const updatedBalance = matchedCustomer.walletBalance - airtimeAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const newTx = {
        id: `WAK-AIR-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: `Vocha (${airtimeNetwork})`,
        amount: airtimeAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed'
      };
      setTransactions(prev => [newTx, ...prev]);

      speak(`Vocha ya ${airtimeNetwork} ya shilingi ${airtimeAmount.toLocaleString()} imetumwa kwenye simu ya ${matchedCustomer.name.split(' ')[0]}.`);
      toast.success(`Vocha ya ${airtimeNetwork} TZS ${airtimeAmount.toLocaleString()} Imetumwa!`, { icon: '📱' });
    }, 1200);
  };

  // 4. LIPA BILI (LUKU / MAJI / AZAMTV)
  const handleExecuteBill = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (billAmount <= 0) return;
    if (matchedCustomer.walletBalance < billAmount) {
      toast.error("Salio la mteja halitoshi kulipia bili hii.");
      return;
    }

    setIsProcessingAction(true);
    const billName = billType === 'luku' ? 'LUKU Umeme' : billType === 'daway' ? 'DAWASCO Maji' : 'AzamTV';
    speak(`Inalipia bili ya ${billName} shilingi ${billAmount.toLocaleString()}...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = 500;
      setCommissionEarned(prev => prev + commission);

      const updatedBalance = matchedCustomer.walletBalance - billAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const tokenLuku = billType === 'luku' ? `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}` : undefined;

      const newTx = {
        id: `WAK-BIL-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: `Lipa Bili (${billName})`,
        amount: billAmount,
        commission,
        time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
        date: 'Leo',
        status: 'completed',
        extraNote: tokenLuku ? `Token: ${tokenLuku}` : undefined
      };
      setTransactions(prev => [newTx, ...prev]);

      speak(`Bili ya ${billName} imelipwa kikamilifu. ${tokenLuku ? 'Token ya LUKU imetolewa.' : ''}`);
      toast.success(`Bili ya ${billName} TZS ${billAmount.toLocaleString()} Imelipwa!`, { icon: '⚡' });
    }, 1300);
  };

  // Float top up execution
  const handleTopUpFloat = () => {
    const amt = Number(floatTopUpAmount) || 0;
    if (amt <= 0) return;
    setFloatBalance(prev => prev + amt);
    setIsFloatModalOpen(false);
    toast.success(`Float ya TZS ${amt.toLocaleString()} imeongezwa kikamilifu kwenye kituo chako!`);
    speak(`Float ya shilingi ${amt >= 1000000 ? (amt/1000000).toFixed(1) + ' milioni' : amt.toLocaleString()} imeongezwa.`);
  };

  // Withdraw commission
  const handleWithdrawCommission = () => {
    if (commissionEarned <= 0) {
      toast.error('Huna kamisheni ya kutoa kwa sasa.');
      return;
    }
    const amt = commissionEarned;
    setCommissionEarned(0);
    toast.success(`Kamisheni ya TZS ${amt.toLocaleString()} imetumwa kwenye simu yako!`);
    speak(`Kamisheni ya shilingi ${amt.toLocaleString()} imetolewa kikamilifu.`);
  };

  // When face registration completes successfully
  const handleEnrollSuccess = (registeredData: { name: string; phone: string; embeddingId: string }) => {
    const newClient: SimulatedCustomer = {
      id: 'cust_' + Date.now(),
      name: registeredData.name,
      phone: registeredData.phone,
      walletBalance: 200000,
      faceEmbeddingId: registeredData.embeddingId,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isRegistered: true,
      nidaNumber: '20030101-77120-00045-88'
    };

    setCustomers(prev => [newClient, ...prev]);
    setActiveSubject(newClient);
    setIsEnrollOpen(false);

    // Immediately trigger search & match so they can deposit right away!
    triggerFaceSearch(newClient);
    toast.success(`Mteja ${registeredData.name} amesajiliwa! Sasa mfumo umemtambua.`, { icon: '🎉' });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans w-full max-w-full overflow-x-hidden pb-24 lg:pb-8">
      {/* TOP WAKALA PORTAL HEADER */}
      <header className="border-b border-white/10 bg-[#0c1222] sticky top-0 z-40 backdrop-blur-md w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Store className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-lg font-black tracking-tight text-white truncate">
                  PapoPay Wakala
                </h1>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-full bg-emerald-500/20 text-emerald-300 text-[8px] sm:text-[10px] font-mono font-bold border border-emerald-500/30 shrink-0">
                  {wakalaProfile.wakalaId}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Kituo Kipo Hewani
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-neutral-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
                <span className="truncate max-w-[120px] sm:max-w-xs">{wakalaProfile.businessName}</span>
                <span className="hidden sm:inline">&bull;</span>
                <span className="hidden sm:flex items-center gap-1 text-neutral-500 truncate"><MapPin className="w-3 h-3 shrink-0" /> {wakalaProfile.location}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Quick Float Pill on Mobile */}
            <button
              type="button"
              onClick={() => { setIsFloatModalOpen(true); triggerHapticTap(); }}
              className="flex sm:hidden items-center gap-1 px-2 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold active:scale-95 transition-all"
              title="Ongeza Float"
            >
              <Wallet className="w-3 h-3" />
              <span>{Math.round(floatBalance/1000000 * 10)/10}M</span>
              <Plus className="w-2.5 h-2.5 text-cyan-400" />
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
              title={soundEnabled ? 'Zima sauti' : 'Washa sauti'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            <Link
              to="/papopay"
              className="hidden md:flex px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 items-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Akaunti ya Mteja</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('papopay_current_wakala');
                toast.info("Umetoka kwenye Portal ya Wakala.");
                navigate('/wakala/login');
              }}
              className="p-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
              title="Ondoka kwenye kituo"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Toka Kituoni</span>
            </button>
          </div>
        </div>
      </header>

      {/* METRICS & FLOAT BAR */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-5 w-full">
        {/* Mobile Mini Financial Strip */}
        <div className="sm:hidden mb-2.5 p-2 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[8px] uppercase font-bold text-neutral-400">Float ya Wakala</p>
              <p className="text-xs font-mono font-bold text-cyan-300">TZS {floatBalance.toLocaleString()}</p>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[8px] uppercase font-bold text-neutral-400">Kamisheni Leo</p>
              <p className="text-xs font-mono font-bold text-emerald-400">+TZS {commissionEarned.toLocaleString()}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMetricsCollapsed(!isMetricsCollapsed)}
            className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white"
            title={isMetricsCollapsed ? "Panua maelezo" : "Fupisha"}
          >
            {isMetricsCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Full Metrics Cards (Always visible on Desktop, collapsible on phone) */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 ${isMetricsCollapsed ? 'hidden sm:grid' : 'grid'}`}>
          {/* Card 1: Float Balance */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c1628] to-[#091120] border border-cyan-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs uppercase font-bold text-neutral-400 truncate">Float ya Wakala</span>
              <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="my-1 sm:my-2">
              <div className="text-sm sm:text-2xl lg:text-3xl font-black font-mono text-cyan-300 truncate">
                TZS {floatBalance.toLocaleString()}
              </div>
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Kwa Kuweka (Cash-In)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFloatModalOpen(true)}
              className="mt-1 sm:mt-2 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold text-[9px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Ongeza Float</span>
            </button>
          </div>

          {/* Card 2: Commission Earned */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0a1b18] to-[#081512] border border-emerald-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs uppercase font-bold text-neutral-400 truncate">Kamisheni Yako</span>
              <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Coins className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="my-1 sm:my-2">
              <div className="text-sm sm:text-2xl lg:text-3xl font-black font-mono text-emerald-400 truncate">
                +TZS {commissionEarned.toLocaleString()}
              </div>
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Faida ya leo</p>
            </div>
            <button
              type="button"
              onClick={handleWithdrawCommission}
              className="mt-1 sm:mt-2 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-[9px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Toa Kamisheni</span>
            </button>
          </div>

          {/* Card 3: Cash-In Completed */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#0e1424] border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs uppercase font-bold text-neutral-400 truncate">Kuweka (Cash-In)</span>
              <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="my-1 sm:my-2">
              <div className="text-sm sm:text-2xl font-black font-mono text-white truncate">
                {transactions.filter(t => t.type.includes('Kuweka')).length} Miamala
              </div>
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Uthibitisho wa Sura Papo Hapo</p>
            </div>
            <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Bila PIN au Kadi
            </span>
          </div>

          {/* Card 4: Cash-Out Completed */}
          <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#0e1424] border border-white/10 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs uppercase font-bold text-neutral-400 truncate">Kutoa (Cash-Out)</span>
              <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="my-1 sm:my-2">
              <div className="text-sm sm:text-2xl font-black font-mono text-white truncate">
                {transactions.filter(t => t.type.includes('Kutoa') || t.type.includes('Vocha') || t.type.includes('Bili')).length} Miamala
              </div>
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Kutoa Pesa kwa Tabasamu</p>
            </div>
            <span className="text-[9px] sm:text-[10px] text-amber-400 font-semibold truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Uso Pekee (Cardless)
            </span>
          </div>
        </div>

        {/* MOBILE SEGMENTED VIEW CONTROLLER (< lg) */}
        <div className="lg:hidden w-full mt-3 sticky top-[48px] z-30 bg-[#0c1222]/95 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-xl">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => { setPortalMode('pos_hub'); setMobileTab('pos'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                (portalMode === 'pos_hub' || portalMode === 'terminal') && mobileTab === 'pos'
                  ? 'bg-emerald-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4" />
              <span className="truncate">1. POS Kaunta</span>
            </button>

            <button
              type="button"
              onClick={() => { setPortalMode('wakala_kawaida'); setMobileTab('pos'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                portalMode === 'wakala_kawaida'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="truncate">2. Wakala Mtaa</span>
            </button>

            <button
              type="button"
              onClick={() => { setMobileTab('camera'); setPortalMode('pos_hub'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                mobileTab === 'camera'
                  ? 'bg-purple-500 text-white shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span className="truncate">3. Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => { setPortalMode('ledger'); setMobileTab('ledger'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                portalMode === 'ledger' || mobileTab === 'ledger'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span className="truncate">4. Miamala ({transactions.length})</span>
            </button>
          </div>
        </div>

        {/* DESKTOP TAB CONTROLS: POS KAUNTA HUB vs WAKALA WA KAWAIDA vs LEDGER */}
        <div className="hidden lg:flex mt-6 flex-row items-center justify-between gap-3 border-b border-white/10 pb-4 w-full">
          {/* Main Mode Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalMode('pos_hub');
                triggerHapticTap();
              }}
              className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                portalMode === 'pos_hub' || portalMode === 'terminal'
                  ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>1. Kituo cha POS Kaunta</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalMode('wakala_kawaida');
                triggerHapticTap();
              }}
              className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                portalMode === 'wakala_kawaida'
                  ? 'bg-cyan-500 text-neutral-950 shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>2. Wakala wa Kawaida</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalMode('ledger');
                triggerHapticTap();
              }}
              className={`py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                portalMode === 'ledger'
                  ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>3. Miamala ({transactions.length})</span>
            </button>
          </div>

          {/* Action buttons: Register New Customer & Camera Detection Controls */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsNewCustomerModalOpen(true);
                triggerHapticTap();
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Sajili Mteja Mpya kwa Uso</span>
            </button>

            <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDetectionMode('live_camera');
                  setSearchState('idle_no_face');
                  setMatchedCustomer(null);
                  setIsCustomerConfirmed(false);
                  speak("Umechagua utambuzi wa kamera ya moja kwa moja. Simama mbele ya kamera.");
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer ${
                  detectionMode === 'live_camera'
                    ? 'bg-cyan-500 text-neutral-950 shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>Live Camera</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetectionMode('test_profiles');
                  triggerFaceSearch(activeSubject);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer ${
                  detectionMode === 'test_profiles'
                    ? 'bg-emerald-500 text-neutral-950 shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>Demo</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (detectionMode === 'live_camera') {
                  executeLiveCameraSearch();
                } else {
                  triggerFaceSearch(activeSubject);
                }
              }}
              className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Scan Upya</span>
            </button>
          </div>
        </div>

        {/* TAB 1: TERMINAL WITH LIVE FACE TRACKING & DATABASE SEARCH */}
        {((portalMode === 'pos_hub' || portalMode === 'terminal') && mobileTab !== 'ledger') && (
          <div className="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* LEFT COLUMN: LIVE BIOMETRIC CAMERA & TRACKING (6 COLS ON DESKTOP, CONDITIONAL ON PHONE) */}
            <div className={`lg:col-span-6 flex flex-col space-y-4 ${
              mobileTab === 'camera' || mobileTab === 'customers' ? 'flex' : 'hidden lg:flex'
            }`}>
              <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-3xl overflow-hidden border-4 border-emerald-500/40 bg-black flex items-center justify-center shadow-2xl shadow-emerald-950/60">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`absolute inset-0 w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Biometric Face Mesh & Real Video Tracking HUD */}
                <BiometricFaceCanvas
                  videoRef={videoRef}
                  onFaceTracked={handleFaceTracked}
                  phase={
                    searchState === 'unregistered'
                      ? 'unregistered'
                      : searchState === 'customer_found'
                      ? 'success'
                      : searchState === 'searching_db'
                      ? 'verifying'
                      : 'align_center'
                  }
                  isUnregistered={searchState === 'unregistered'}
                  hudMode={hudMode}
                  faceConfidence={searchState === 'customer_found' ? 99.8 : liveConfidence}
                  lightingQuality={liveLux}
                  distanceCm={liveDistance}
                  headYaw={liveYaw}
                />

                {/* Top Floating Glass Header (Sleek, Single-Row, Zero-Collision) */}
                <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
                  {/* Status Indicator */}
                  <div className="pointer-events-auto flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full backdrop-blur-md text-[10px] sm:text-[11px] font-semibold border flex items-center gap-2 shadow-lg transition-all ${
                      searchState === 'customer_found'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/60'
                        : searchState === 'searching_db'
                        ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40 animate-pulse'
                        : searchState === 'unregistered'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                        : 'bg-black/75 text-neutral-300 border-white/10'
                    }`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        searchState === 'customer_found'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : searchState === 'searching_db'
                          ? 'bg-cyan-400 animate-ping'
                          : searchState === 'unregistered'
                          ? 'bg-amber-400'
                          : liveFaceDetected
                          ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                          : 'bg-neutral-500'
                      }`} />
                      <span className="font-medium tracking-tight truncate max-w-[150px] sm:max-w-none">
                        {searchState === 'searching_db'
                          ? 'Inachanganua...'
                          : searchState === 'customer_found'
                          ? 'Mteja Ametambuliwa ✓'
                          : searchState === 'unregistered'
                          ? 'Sura Haipo'
                          : liveFaceDetected 
                          ? 'Uso Umeonekana' 
                          : 'Standby: Inasubiri Mteja'}
                      </span>
                    </span>
                  </div>

                  {/* Camera Flip Button */}
                  <div className="pointer-events-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md text-cyan-300 border border-white/15 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold shadow-lg cursor-pointer active:scale-95 transition-all"
                      title="Geuza Kamera (Mbele / Nyuma)"
                    >
                      <SwitchCamera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="hidden sm:inline">{cameraFacing === 'user' ? 'Mbele' : 'Nyuma'}</span>
                    </button>
                  </div>
                </div>

                {/* SYSTEM SEARCHING OVERLAY (INATAFUTA KWENYE SISTIM) */}
                {searchState === 'searching_db' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center mb-3 shadow-[0_0_30px_#06b6d4]">
                      <Search className="w-8 h-8 animate-pulse" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold uppercase mb-1">
                      Biometric Query Engine
                    </span>
                    <h3 className="text-lg font-black text-white">
                      Inatafuta kwenye mfumo wa PapoPay...
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 max-w-xs">
                      Inalinganisha sura ya mteja na kanzidata ya akaunti (12,450 records)
                    </p>

                    <div className="w-56 bg-white/10 rounded-full h-2 mt-4 overflow-hidden border border-white/20">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${searchProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 mt-1.5">{searchProgress}% Rekodi Zimechanganuliwa</span>
                  </motion.div>
                )}

                {/* UNREGISTERED / NOT ENROLLED ALERT OVERLAY */}
                {searchState === 'unregistered' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 z-30 bg-amber-950/92 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center mb-2 shadow-[0_0_35px_#f59e0b] animate-bounce shrink-0">
                      <UserX className="w-6 h-6 sm:w-8 sm:h-8 stroke-[2.5]" />
                    </div>
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/20 text-amber-300 text-[9px] sm:text-[10px] font-mono font-black border border-amber-500/40 uppercase mb-1">
                      {activeSubject?.hasAccountButNoFace ? 'Akaunti Ipo, Bado Hajaweka Uso ⚠️' : 'Mteja Hajapatikana Kwenye Database ⚠️'}
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-white">
                      {activeSubject?.hasAccountButNoFace ? 'HUJAWEKA USO BADO!' : 'USO HAUJASAJILIWA!'}
                    </h3>
                    <p className="text-amber-200 text-[11px] sm:text-xs font-medium mt-1 max-w-xs">
                      {activeSubject?.hasAccountButNoFace
                        ? `Mteja huyu (${activeSubject.name}) ana akaunti halali lakini hakusajili uso wake wakati anajisajili. Weka uso wake sasa ili kufanya miamala.`
                        : 'Sura hii haipo kwenye mfumo wa PapoPay. Mteja hawezi kuweka pesa hadi asajiliwe.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsEnrollOpen(true)}
                      className="mt-3 sm:mt-4 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span className="truncate">{activeSubject?.hasAccountButNoFace ? 'Weka Uso wa Mteja Sasa (Enroll Face)' : 'Sajili Mteja Mpya kwa Uso Hapa'}</span>
                    </button>
                  </motion.div>
                )}

                {/* Bottom Viewport Banner */}
                {matchedCustomer && searchState === 'customer_found' && (
                  <div className="absolute bottom-3 inset-x-3 z-20 bg-black/85 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={matchedCustomer.avatar}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-white leading-tight">
                            {matchedCustomer.name}
                          </p>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono">
                            VERIFIED
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-mono">
                          Simu: {matchedCustomer.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-neutral-400 block">Salio la Sasa</span>
                      <span className="text-sm font-mono font-bold text-emerald-300">
                        TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* DEDICATED CAMERA ACTION & CONTROL STRIP (SLEEK & UNCLUTTERED) */}
              <div className="w-full bg-[#0c1322] p-2.5 sm:p-3.5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2.5 shadow-xl">
                {/* Primary Scan Button */}
                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                  {searchState === 'idle_no_face' ? (
                    <button
                      type="button"
                      onClick={() => executeLiveCameraSearch()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <ScanFace className="w-4 h-4 shrink-0" />
                      <span>Skani Mteja Sasa</span>
                    </button>
                  ) : searchState === 'customer_found' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchState('idle_no_face');
                        setMatchedCustomer(null);
                        setActiveSubject(null);
                        setIsCustomerConfirmed(false);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Skani Mteja Mwingine</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => executeLiveCameraSearch()}
                      disabled={isSearchingRef.current}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Inachanganua...</span>
                    </button>
                  )}
                </div>

                {/* Telemetry info */}
                <div className="hidden md:flex items-center gap-2.5 text-[11px] font-mono text-neutral-400">
                  <span>Mwanga: <strong className="text-white">{liveLux}%</strong></span>
                  <span>·</span>
                  <span>Umbali: <strong className="text-white">{liveDistance}cm</strong></span>
                  <span>·</span>
                  <span>Uaminifu: <strong className="text-emerald-400">{liveConfidence.toFixed(0)}%</strong></span>
                </div>

                {/* HUD Vision Mode Switcher */}
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setHudMode('mesh')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      hudMode === 'mesh' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    3D Mesh
                  </button>
                  <button
                    type="button"
                    onClick={() => setHudMode('neural_box')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      hudMode === 'neural_box' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Sanduku
                  </button>
                  <button
                    type="button"
                    onClick={() => setHudMode('liveness_depth')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      hudMode === 'liveness_depth' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Depth
                  </button>
                </div>
              </div>

              {/* MOBILE QUICK ACTION PILL WHEN CUSTOMER IS RECOGNIZED */}
              {matchedCustomer && searchState === 'customer_found' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="lg:hidden p-3 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#0e2a22] to-neutral-900 border-2 border-emerald-500/60 text-white shadow-xl flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={matchedCustomer.avatar}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-400 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black truncate">{matchedCustomer.name}</p>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8px] font-mono font-bold">VERIFIED</span>
                      </div>
                      <p className="text-[10px] text-emerald-300 font-mono truncate">
                        Salio: TZS {matchedCustomer.walletBalance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileTab('pos');
                      triggerHapticTap();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-neutral-950 text-xs font-black shrink-0 flex items-center gap-1 shadow-md shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Fungua POS</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </motion.div>
              )}

              {/* PERSON IN FRONT OF CAMERA / CUSTOMER IDENTIFICATION SECTION */}
              <div className={`w-full bg-[#0c1322] p-3.5 sm:p-5 rounded-3xl border border-white/10 space-y-3 sm:space-y-4 ${
                mobileTab === 'customers' ? 'block' : 'hidden lg:block'
              }`}>
                {/* Header: Mode & Targeted Customer */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Mteja Husika Mbele ya Kaunta (Relevant Customer)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetectionMode(detectionMode === 'live_camera' ? 'test_profiles' : 'live_camera')}
                      className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-cyan-300 font-mono border border-white/10 flex items-center gap-1.5 transition-colors"
                    >
                      {detectionMode === 'live_camera' ? <Camera className="w-3 h-3 text-cyan-400" /> : <User className="w-3 h-3 text-emerald-400" />}
                      <span>{detectionMode === 'live_camera' ? 'Modi ya Live Camera' : 'Modi ya Demo'}</span>
                    </button>
                  </div>
                </div>

                {/* CURRENT TARGET CUSTOMER CARD (MTEJA HUSIKA) */}
                {activeSubject ? (
                  <div className={`p-3.5 rounded-2xl border transition-all ${
                    activeSubject.isRegistered
                      ? 'bg-gradient-to-r from-emerald-950/40 to-black/60 border-emerald-500/40'
                      : activeSubject.hasAccountButNoFace
                      ? 'bg-gradient-to-r from-amber-950/40 to-black/60 border-amber-500/40'
                      : 'bg-black/40 border-white/10'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={activeSubject.avatar}
                            alt={activeSubject.name}
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border-2 ${
                              activeSubject.isRegistered ? 'border-emerald-400' : 'border-amber-400'
                            }`}
                          />
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${
                            activeSubject.isRegistered ? 'bg-emerald-500 text-neutral-950' : 'bg-amber-500 text-neutral-950'
                          }`}>
                            {activeSubject.isRegistered ? '✓' : '!'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <p className="text-xs sm:text-sm font-black text-white truncate">{activeSubject.name}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase shrink-0 ${
                              activeSubject.isRegistered
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : activeSubject.hasAccountButNoFace
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}>
                              {activeSubject.isRegistered ? 'Mteja Aliyesajiliwa' : activeSubject.hasAccountButNoFace ? 'Bado Uso' : 'Mgeni'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                            Simu: <span className="text-white font-bold">{activeSubject.phone || 'Hakuna Namba'}</span>
                            {activeSubject.walletBalance > 0 && (
                              <span className="ml-1.5 text-emerald-400 font-bold">| Salio: TZS {activeSubject.walletBalance.toLocaleString()}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (detectionMode === 'live_camera') {
                              executeLiveCameraSearch();
                            } else {
                              triggerFaceSearch(activeSubject);
                            }
                          }}
                          disabled={isSearchingRef.current}
                          className="flex-1 sm:flex-initial px-3.5 py-2.5 sm:py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-neutral-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                        >
                          <ScanFace className={`w-3.5 h-3.5 ${isSearchingRef.current ? 'animate-spin' : ''}`} />
                          <span>{isSearchingRef.current ? 'Inatambua...' : 'Tambua Uso Sasa'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubject(null);
                            setMatchedCustomer(null);
                            setSearchState('idle_no_face');
                          }}
                          className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-rose-400 transition-colors shrink-0"
                          title="Ondoa / Badili Mteja Huyu"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {detectionMode === 'live_camera' && (
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${liveFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                          <span className="text-neutral-300">
                            {liveFaceDetected ? '📸 Uso Upo Kwenye Lensi (Tracking Active)' : 'Kamera inasubiri uso mbele ya simu/kamera'}
                          </span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {liveFaceDetected ? `Alama: ${liveConfidence}% | Umbali: ~${liveDistance}cm` : 'Mteja asimame mbele ya lenzi'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-950/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 flex items-center justify-center shrink-0">
                        <ScanFace className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">Kamera Inasubiri Mteja Husika</p>
                        <p className="text-[11px] text-neutral-400">
                          {liveFaceDetected
                            ? 'Uso umegundulika! Inachanganua kanzidata...'
                            : 'Mteja asimame mbele ya kamera, au chagua kwenye orodha hapa chini.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEnrollOpen(true)}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Sajili Mpya</span>
                    </button>
                  </div>
                )}

                {/* SEARCH & SELECT RELEVANT CUSTOMER (KUTAMBUA MTEJA HUSIKA) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300">
                      Chagua au Tafuta Mteja Husika Aliyepo Kaunta:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEnrollOpen(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Sajili Mteja Mpya</span>
                    </button>
                  </div>

                  {/* Search Input Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tafuta mteja kwa jina au namba ya simu (mf. Baraka, Zawadi, 0754...)"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Chips */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                        customerFilter === 'all'
                          ? 'bg-cyan-500 text-neutral-950 font-black'
                          : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Wote ({customers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('registered')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                        customerFilter === 'registered'
                          ? 'bg-emerald-500 text-neutral-950 font-black'
                          : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Waliosajiliwa kwa Uso ({customers.filter(c => c.isRegistered).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('unregistered')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                        customerFilter === 'unregistered'
                          ? 'bg-amber-500 text-neutral-950 font-black'
                          : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Hawana Uso ({customers.filter(c => !c.isRegistered).length})
                    </button>
                  </div>

                  {/* Customer Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {customers
                      .filter(c => {
                        const q = customerSearchQuery.toLowerCase().trim();
                        const matches = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
                        if (!matches) return false;
                        if (customerFilter === 'registered') return c.isRegistered;
                        if (customerFilter === 'unregistered') return !c.isRegistered;
                        return true;
                      })
                      .map((c) => {
                        const isSelected = activeSubject?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomerSubject(c)}
                            className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <img
                              src={c.avatar}
                              alt={c.name}
                              className={`w-9 h-9 rounded-xl object-cover shrink-0 border ${
                                isSelected ? 'border-cyan-400' : 'border-white/10'
                              }`}
                            />
                            <div className="overflow-hidden min-w-0">
                              <p className={`text-xs font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                                {c.name.split(' ')[0]} {c.name.split(' ')[1]?.[0] || ''}.
                              </p>
                              <p className="text-[9px] text-neutral-400 font-mono truncate">{c.phone}</p>
                              <p className={`text-[8px] font-mono font-bold mt-0.5 ${
                                c.isRegistered ? 'text-emerald-400' : c.hasAccountButNoFace ? 'text-amber-400' : 'text-neutral-500'
                              }`}>
                                {c.isRegistered ? '✓ Verified' : c.hasAccountButNoFace ? '⚠️ Bado Uso' : '❌ Hajajisajili'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: UNLOCKED WAKALA SERVICES (6 COLS ON DESKTOP, VISIBLE ON PHONE WHEN POS TAB SELECTED) */}
            <div className={`lg:col-span-6 flex flex-col space-y-4 ${
              mobileTab === 'pos' ? 'flex' : 'hidden lg:flex'
            }`}>
              {/* Mobile Back-to-Camera Bar */}
              <div className="lg:hidden flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <span className="font-bold text-neutral-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kaunta ya POS & Malipo</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setMobileTab('camera'); triggerHapticTap(); }}
                  className="px-2.5 py-1 rounded-xl bg-white/10 text-cyan-300 text-[10px] font-bold flex items-center gap-1 hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-3 h-3 text-cyan-400" />
                  <span>📷 Angalia Kamera</span>
                </button>
              </div>
              {matchedCustomer && searchState === 'customer_found' ? (
                <div className="bg-[#0c1322] p-5 sm:p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-5">
                  {/* Verified Customer Header Banner */}
                  <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-950/80 to-[#0e1c28] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <img
                        src={matchedCustomer.avatar}
                        alt="Customer Photo"
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border-2 border-emerald-400 shadow-lg shadow-emerald-500/20 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <h2 className="text-sm sm:text-base font-black text-white truncate">{matchedCustomer.name}</h2>
                          <span className="p-0.5 rounded-full bg-emerald-500 text-neutral-950 shrink-0" title="NIDA Verified">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-neutral-300 font-mono mt-0.5 truncate">
                          Simu: <span className="text-emerald-400 font-bold">{matchedCustomer.phone}</span>
                        </p>
                        {matchedCustomer.nidaNumber && (
                          <p className="text-[9px] sm:text-[10px] text-neutral-400 font-mono truncate">
                            NIDA: {matchedCustomer.nidaNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-left sm:text-right">
                        <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase block">Salio la Akaunti</span>
                        <div className="text-base sm:text-lg font-mono font-black text-emerald-300">
                          TZS {matchedCustomer.walletBalance.toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMatchedCustomer(null);
                          setIsCustomerConfirmed(false);
                          setSearchState('idle_no_face');
                          triggerHapticTap();
                          speak("Chagua mteja mwingine au simama mbele ya kamera.");
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-white/10 shrink-0"
                      >
                        <RefreshCw className="w-3 h-3 text-cyan-400" />
                        <span>Badili Mteja</span>
                      </button>
                    </div>
                  </div>

                  {/* SERVICE SELECTION TABS */}
                  <div className="space-y-2">
                    <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                      Chagua Huduma ya Kumpatia Mteja Huyu:
                    </span>
                    <div className="grid grid-cols-5 gap-1 p-1 bg-black/40 rounded-xl sm:rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => { setActiveService('deposit'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-lg sm:rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeService === 'deposit'
                            ? 'bg-emerald-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] truncate">1. Kuweka</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('withdraw'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-lg sm:rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeService === 'withdraw'
                            ? 'bg-amber-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] truncate">2. Kutoa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('airtime'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-lg sm:rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeService === 'airtime'
                            ? 'bg-purple-500 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] truncate">3. Vocha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('bills'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-lg sm:rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeService === 'bills'
                            ? 'bg-cyan-500 text-neutral-950 shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] truncate">4. Bili</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setActiveService('statement'); triggerHapticTap(); }}
                        className={`py-2 px-1 rounded-lg sm:rounded-xl text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          activeService === 'statement'
                            ? 'bg-white/20 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] truncate">5. Salio</span>
                      </button>
                    </div>
                  </div>

                  {/* SERVICE 1: KUWEKA PESA (CASH-IN) */}
                  {activeService === 'deposit' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Kiasi cha Pesa Mteja Anachotaka Kuweka (TZS):
                        </label>
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-emerald-500/40 px-4 py-3.5 rounded-2xl text-2xl font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[10000, 25000, 50000, 100000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => { setDepositAmount(amt); triggerHapticTap(); }}
                            className="py-2 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300"
                          >
                            {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between text-neutral-400">
                          <span>Mteja Anayepokea:</span>
                          <span className="font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Kamisheni Yako ya Wakala (1.2%):</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +TZS {Math.round(depositAmount * 0.012).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400 pt-2 border-t border-white/10">
                          <span>Float Yako Baada ya Kuweka:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            TZS {(floatBalance - depositAmount).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteDeposit}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        {isProcessingAction ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                        <span>
                          {isProcessingAction ? 'Inaweka Pesa Kwenye Akaunti...' : `Weka TZS ${depositAmount.toLocaleString()} kwa Uso wa Mteja`}
                        </span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 2: KUTOA PESA (CASH-OUT) */}
                  {activeService === 'withdraw' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          Kiasi cha Pesa Mteja Anachotaka Kutoa (TZS):
                        </label>
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-amber-500/40 px-4 py-3.5 rounded-2xl text-2xl font-mono font-black text-amber-400 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[10000, 20000, 30000, 50000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => { setWithdrawAmount(amt); triggerHapticTap(); }}
                            className="py-2 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300"
                          >
                            {amt/1000}k
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                        <div className="flex justify-between text-neutral-400">
                          <span>Mteja Anayetoa Pesa:</span>
                          <span className="font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Salio Lake la Sasa:</span>
                          <span className="font-mono text-emerald-400 font-bold">TZS {matchedCustomer.walletBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Kamisheni Yako ya Wakala (1.2%):</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +TZS {Math.round(withdrawAmount * 0.012).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={() => handleExecuteWithdraw()}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        {isProcessingAction ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                        <span>
                          {isProcessingAction ? 'Inaidhinisha Kutoa...' : `Idhinisha Kutoa TZS ${withdrawAmount.toLocaleString()} & Mkabidhi Fedha`}
                        </span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 3: NUNUA VOCHA (AIRTIME) */}
                  {activeService === 'airtime' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-300">Mtandao:</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['Vodacom', 'Tigo', 'Airtel', 'Halotel'] as const).map(net => (
                            <button
                              key={net}
                              type="button"
                              onClick={() => setAirtimeNetwork(net)}
                              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all ${
                                airtimeNetwork === net
                                  ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                                  : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {net}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">Kiasi cha Vocha (TZS):</label>
                        <input
                          type="number"
                          value={airtimeAmount}
                          onChange={(e) => setAirtimeAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-purple-500/40 px-4 py-3 rounded-2xl font-mono text-xl font-black text-purple-300"
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[1000, 2000, 5000, 10000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAirtimeAmount(amt)}
                            className="py-1.5 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 text-neutral-300"
                          >
                            {amt/1000}k
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteAirtime}
                        className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        <Smartphone className="w-5 h-5" />
                        <span>Nunua Vocha ya TZS {airtimeAmount.toLocaleString()} kwa Akaunti ya Mteja</span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 4: LIPA BILI (LUKU / MAJI / AZAMTV) */}
                  {activeService === 'bills' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setBillType('luku')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'luku' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Zap className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                          <span className="text-xs block">LUKU Umeme</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillType('daway')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'daway' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Droplets className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                          <span className="text-xs block">DAWASCO Maji</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillType('azam')}
                          className={`p-3 rounded-2xl border text-center transition-all ${
                            billType === 'azam' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold' : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          <Tv className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                          <span className="text-xs block">Azam TV</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">
                          {billType === 'luku' ? 'Namba ya Mita ya LUKU:' : billType === 'daway' ? 'Namba ya Akaunti ya Maji:' : 'Namba ya Smartcard:'}
                        </label>
                        <input
                          type="text"
                          value={billMeterNumber}
                          onChange={(e) => setBillMeterNumber(e.target.value)}
                          className="w-full bg-black/60 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-mono text-sm text-cyan-300"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300">Kiasi cha Bili (TZS):</label>
                        <input
                          type="number"
                          value={billAmount}
                          onChange={(e) => setBillAmount(Number(e.target.value) || 0)}
                          className="w-full bg-black/60 border border-cyan-500/30 px-4 py-2.5 rounded-2xl font-mono text-lg font-bold text-cyan-300"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingAction}
                        onClick={handleExecuteBill}
                        className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60"
                      >
                        <Zap className="w-5 h-5" />
                        <span>Lipia Bili ya TZS {billAmount.toLocaleString()} kwa Uso wa Mteja</span>
                      </button>
                    </motion.div>
                  )}

                  {/* SERVICE 5: TAARIFA FUPI & SALIO */}
                  {activeService === 'statement' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="p-4 rounded-2xl bg-black/50 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Jina la Akaunti:</span>
                          <span className="text-xs font-bold text-white">{matchedCustomer.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Namba ya Simu:</span>
                          <span className="text-xs font-mono text-cyan-300">{matchedCustomer.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Salio Halisi la Sasa:</span>
                          <span className="text-sm font-mono font-black text-emerald-400">
                            TZS {matchedCustomer.walletBalance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Ufunguo wa Bayometriki:</span>
                          <span className="text-[10px] font-mono text-neutral-300">{matchedCustomer.faceEmbeddingId}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          toast.success(`Taarifa fupi ya ${matchedCustomer.name} imechapishwa!`);
                          speak(`Taarifa ya salio la shilingi ${matchedCustomer.walletBalance.toLocaleString()} imechapishwa.`);
                        }}
                        className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4 text-cyan-400" />
                        <span>Chapisha Karatasi ya Salio (Print Slip)</span>
                      </button>
                    </motion.div>
                  )}

                  {/* Complete & Service Next Customer */}
                  <button
                    type="button"
                    onClick={() => {
                      setMatchedCustomer(null);
                      setIsCustomerConfirmed(false);
                      setSearchState('idle_no_face');
                      speak("Huduma imekamilika. Mfumo upo tayari kwa mteja mwingine.");
                    }}
                    className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs font-bold transition-all"
                  >
                    Kamilisha Muamala & Hudumia Mteja Mwingine
                  </button>
                </div>
              ) : searchState === 'unregistered' ? (
                  <div className="bg-[#0c1322] p-5 sm:p-6 rounded-3xl border-2 border-amber-500/50 shadow-2xl space-y-5">
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <UserX className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase border border-amber-500/40">
                          {activeSubject?.hasAccountButNoFace ? 'Akaunti Ipo, Bado Hajaweka Uso' : 'Sura Haipo Kwenye Mfumo'}
                        </span>
                        <h3 className="text-xl font-black text-white mt-1">
                          {activeSubject?.hasAccountButNoFace ? 'HUJAWEKA USO BADO!' : 'SURA HII HAIJASAJILIWA!'}
                        </h3>
                        <p className="text-xs text-neutral-300 mt-1 max-w-sm mx-auto">
                          Mfumo umegundua sura mbele ya kamera lakini haijasajiliwa kwenye PapoPay. Mteja hawezi kuweka au kutoa pesa hadi asajiliwe.
                        </p>
                      </div>
                    </div>

                    {/* IN-PLACE RAPID REGISTRATION FORM */}
                    <form onSubmit={handleQuickEnrollSubmit} className="p-4 rounded-2xl bg-black/60 border border-amber-500/30 space-y-3.5 text-left">
                      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-400 shrink-0 bg-neutral-900">
                          <img
                            src={captureCurrentFrame()}
                            alt="Face Frame"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Usajili wa Haraka wa Uso</p>
                          <p className="text-[10px] text-amber-300 font-mono">Picha itanaswa mara moja toka kwenye video</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-300">Jina Kamili la Mteja:</label>
                        <input
                          type="text"
                          placeholder="mf. Juma Hamisi Bakari"
                          value={quickEnrollName}
                          onChange={(e) => setQuickEnrollName(e.target.value)}
                          className="w-full bg-black/50 border border-white/15 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-300">Namba ya Simu ya Mteja:</label>
                        <input
                          type="tel"
                          placeholder="mf. 0754 123 456"
                          value={quickEnrollPhone}
                          onChange={(e) => setQuickEnrollPhone(e.target.value)}
                          className="w-full bg-black/50 border border-white/15 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-300">Namba ya NIDA (Hiari):</label>
                        <input
                          type="text"
                          placeholder="mf. 19950815-44210-00012-77"
                          value={quickEnrollNida}
                          onChange={(e) => setQuickEnrollNida(e.target.value)}
                          className="w-full bg-black/50 border border-white/15 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>

                      {/* Submit Quick Enroll */}
                      <button
                        type="submit"
                        disabled={isQuickEnrolling}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                      >
                        {isQuickEnrolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        <span>{isQuickEnrolling ? 'Inasajili Uso Kwenye Mfumo...' : '📸 Nasa Uso & Sajili Mara Moja'}</span>
                      </button>
                    </form>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEnrollOpen(true)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                      >
                        Au Fungua Fomu Kamili ya Usajili
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchState('idle_no_face');
                        }}
                        className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                      >
                        Rudi Kusubiri Mteja
                      </button>
                    </div>
                  </div>
                ) : (
                  /* POS KAUNTA HUB: INSTANT CUSTOMER QUEUE, DIRECT PHONE DEPOSIT & BIOMETRIC SCAN */
                  <div className="bg-[#0c1322] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 shadow-xl space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <h3 className="text-sm sm:text-base font-black text-white">Kaunta ya POS - Hudumia Mteja</h3>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Chagua mteja aliyepo kaunta, weka pesa kwa namba ya simu, au tumia utambuzi wa uso
                        </p>
                      </div>

                      {/* Standby Action Switcher Tabs */}
                      <div className="flex items-center gap-1 p-1 bg-black/50 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => { setPosStandbyTab('queue'); triggerHapticTap(); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            posStandbyTab === 'queue'
                              ? 'bg-emerald-500 text-neutral-950 font-black shadow-md'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Wateja Kaunta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setPosStandbyTab('direct_phone'); triggerHapticTap(); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            posStandbyTab === 'direct_phone'
                              ? 'bg-cyan-500 text-neutral-950 font-black shadow-md'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Weka kwa Simu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setPosStandbyTab('scan'); triggerHapticTap(); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            posStandbyTab === 'scan'
                              ? 'bg-purple-500 text-white font-black shadow-md'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <ScanFace className="w-3.5 h-3.5" />
                          <span>Scan Uso</span>
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: COUNTER QUEUE & SEARCH */}
                    {posStandbyTab === 'queue' && (
                      <div className="space-y-3">
                        {/* Search Input Bar */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Tafuta mteja kwa jina au namba ya simu (mf. Baraka, 0754...)"
                            value={posSearchQuery}
                            onChange={(e) => setPosSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-black/60 border border-white/15 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-400 transition-colors"
                          />
                          {posSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setPosSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Customer Cards List with Instant Deposit / Withdraw Buttons */}
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                          {customers
                            .filter(c => {
                              const q = posSearchQuery.toLowerCase().trim();
                              return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
                            })
                            .map((c) => (
                              <div
                                key={c.id}
                                className="p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative shrink-0">
                                    <img
                                      src={c.avatar}
                                      alt={c.name}
                                      className="w-11 h-11 rounded-xl object-cover border border-white/15"
                                    />
                                    <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${
                                      c.isRegistered ? 'bg-emerald-500 text-neutral-950' : 'bg-amber-500 text-neutral-950'
                                    }`}>
                                      {c.isRegistered ? '✓' : '!'}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase shrink-0 ${
                                        c.isRegistered
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      }`}>
                                        {c.isRegistered ? 'Verified' : 'Bado Uso'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                                      Simu: <span className="text-white font-semibold">{c.phone}</span>
                                    </p>
                                    <p className="text-[10px] text-emerald-400 font-mono font-bold">
                                      Salio: TZS {c.walletBalance.toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Instant 1-Tap Action Buttons */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCustomerSubject(c, 'deposit')}
                                    className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-neutral-950 border border-emerald-500/40 text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                                  >
                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                    <span>💰 Weka Pesa</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSelectCustomerSubject(c, 'withdraw')}
                                    className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-neutral-950 border border-amber-500/40 text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    <span>💵 Toa Pesa</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: DIRECT PHONE CASH-IN */}
                    {posStandbyTab === 'direct_phone' && (
                      <div className="space-y-4 p-2 sm:p-3 bg-black/40 rounded-2xl border border-cyan-500/20">
                        <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span>Kuweka Pesa Moja kwa Moja kwa Namba ya Simu (Cash-In)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-neutral-300">Namba ya Simu ya Mteja:</label>
                            <input
                              type="tel"
                              value={directPhone}
                              onChange={(e) => setDirectPhone(e.target.value)}
                              placeholder="0754 123 456"
                              className="w-full bg-black/60 border border-white/15 px-3 py-2.5 rounded-xl text-xs text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-neutral-300">Jina la Mteja (Hiari):</label>
                            <input
                              type="text"
                              value={directCustomerName}
                              onChange={(e) => setDirectCustomerName(e.target.value)}
                              placeholder="mf. Juma Hamisi"
                              className="w-full bg-black/60 border border-white/15 px-3 py-2.5 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-neutral-300">Kiasi cha Kuweka (TZS):</label>
                          <input
                            type="number"
                            value={directPhoneAmount}
                            onChange={(e) => setDirectPhoneAmount(Number(e.target.value) || 0)}
                            className="w-full bg-black/60 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xl font-mono font-black text-emerald-400 focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {[10000, 25000, 50000, 100000, 200000, 500000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => { setDirectPhoneAmount(amt); triggerHapticTap(); }}
                              className={`py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                                directPhoneAmount === amt
                                  ? 'bg-emerald-500 text-neutral-950'
                                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                              }`}
                            >
                              {amt >= 1000000 ? `${amt/1000000}M` : `${amt/1000}k`}
                            </button>
                          ))}
                        </div>

                        {/* Breakdown */}
                        <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-1.5 text-xs">
                          <div className="flex justify-between text-neutral-400">
                            <span>Kamisheni Yako (1.2%):</span>
                            <span className="font-mono font-bold text-emerald-400">
                              +TZS {Math.round(directPhoneAmount * 0.012).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-neutral-400">
                            <span>Float ya Wakala Itakayobaki:</span>
                            <span className="font-mono font-bold text-cyan-300">
                              TZS {(floatBalance - directPhoneAmount).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Submit */}
                        <button
                          type="button"
                          disabled={isProcessingAction}
                          onClick={handleExecuteDirectPhoneDeposit}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
                        >
                          {isProcessingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                          <span>{isProcessingAction ? 'Inaweka Pesa...' : `Weka TZS ${directPhoneAmount.toLocaleString()} kwa Namba ya Simu`}</span>
                        </button>
                      </div>
                    )}

                    {/* TAB 3: BIOMETRIC FACE SCAN */}
                    {posStandbyTab === 'scan' && (
                      <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border-2 border-cyan-400/40 text-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                            <ScanFace className="w-8 h-8 animate-pulse" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0c1322] flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          </div>
                        </div>

                        <div className="space-y-1 max-w-sm">
                          <h4 className="text-base font-black text-white">Utambuzi wa Uso (Live Biometrics)</h4>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            Mteja asimame mbele ya kamera. Mfumo utatambua uso wake na kufungua akaunti yake kiotomatiki.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-sm">
                          <button
                            type="button"
                            onClick={executeLiveCameraSearch}
                            disabled={isSearchingRef.current}
                            className="w-full sm:flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSearchingRef.current ? 'animate-spin' : ''}`} />
                            <span>{isSearchingRef.current ? 'Inachanganua...' : 'Anzisha Utambuzi Sasa'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDetectionMode('test_profiles');
                              triggerFaceSearch(activeSubject);
                            }}
                            className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer transition-colors"
                          >
                            Demo Profiles
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* TAB: PANEL YA WAKALA WA KAWAIDA (STREET / KIOSK SMART AGENT) */}
        {(portalMode === 'wakala_kawaida' && mobileTab !== 'ledger') && (
          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
            {/* WAKALA WA KAWAIDA BADGES & BANNER */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#0d1f2d] via-[#091522] to-[#141d2f] border border-cyan-500/30 shadow-xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-cyan-500/20 shrink-0">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                        Wakala wa Kawaida (Street & Kiosk)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                        Online • TZS {floatBalance.toLocaleString()} Float
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                      Kituo cha Wakala wa Mtaani — PapoPay Biometrics
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsNewCustomerModalOpen(true);
                    triggerHapticTap();
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Sajili Mteja Mpya kwa Uso</span>
                </button>
              </div>

              {/* 5 KEY PROMISES BADGES REQUIRED BY USER */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-white/10 text-[11px]">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-neutral-200 font-medium">AI Face Biometrics (Kuskani Uso)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-neutral-200 font-medium">Hahitaji simu wala kadi (Uso unatosha)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-neutral-200 font-medium">Uso wa mteja na PIN ufunguo salama</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-neutral-200 font-medium">Salama 100% (Akaunti inalingana na uso)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 col-span-2 sm:col-span-1">
                  <Receipt className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="text-neutral-200 font-medium">Risiti za kielektroniki (EFD Digital)</span>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN WORKFLOW: LEFT CAMERA SCANNER / RIGHT CUSTOMER PROFILE & CASH OPS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
              {/* LEFT: COMPACT MOBILE-FIRST CAMERA HUD */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden border-4 border-cyan-500/40 bg-black flex items-center justify-center shadow-2xl shadow-cyan-950/60">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`absolute inset-0 w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* Face Mesh Tracker */}
                  <BiometricFaceCanvas
                    videoRef={videoRef}
                    onFaceTracked={handleFaceTracked}
                    phase={
                      searchState === 'unregistered'
                        ? 'unregistered'
                        : searchState === 'customer_found'
                        ? 'success'
                        : searchState === 'searching_db'
                        ? 'verifying'
                        : 'align_center'
                    }
                    isUnregistered={searchState === 'unregistered'}
                    hudMode={hudMode}
                    faceConfidence={searchState === 'customer_found' ? 99.8 : liveConfidence}
                    lightingQuality={liveLux}
                    distanceCm={liveDistance}
                    headYaw={liveYaw}
                  />

                  {/* Top Bar on Camera */}
                  <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
                    <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Kamera ya Wakala: {cameraFacing === 'user' ? 'Ya Mbele' : 'Ya Nyuma'}
                    </span>

                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="pointer-events-auto p-2 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-white transition-all shadow-lg cursor-pointer"
                      title="Badilisha Kamera ya Mbele/Nyuma"
                    >
                      <SwitchCamera className="w-4 h-4 text-cyan-400" />
                    </button>
                  </div>

                  {/* Bottom Scan Overlay */}
                  <div className="absolute bottom-3 inset-x-3 z-20 pointer-events-none">
                    <div className="p-2.5 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ScanFace className="w-4 h-4 text-cyan-400" />
                        <span className="text-[11px] font-mono text-white">
                          {searchState === 'customer_found' ? (
                            <span className="text-emerald-400 font-bold">Uso Umetambuliwa: 99.8% Match</span>
                          ) : searchState === 'searching_db' ? (
                            <span className="text-cyan-300 animate-pulse">Inachakata uso kwenye kanzidata...</span>
                          ) : (
                            <span className="text-neutral-300">Elekeza kamera kwenye uso wa mteja</span>
                          )}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {liveFaceDetected ? 'Face in Frame ✓' : 'Subiri Uso...'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SCANNER CONTROLS FOR WAKALA */}
                <div className="p-3.5 rounded-2xl bg-[#0c1424] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDetectionMode('live_camera');
                          setSearchState('idle_no_face');
                          setMatchedCustomer(null);
                          setIsCustomerConfirmed(false);
                          speak("Kamera ya Wakala imewashwa. Simamisha mteja mbele ya kamera.");
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          detectionMode === 'live_camera'
                            ? 'bg-cyan-500 text-neutral-950 font-black'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Live Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDetectionMode('test_profiles');
                          triggerFaceSearch(activeSubject);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          detectionMode === 'test_profiles'
                            ? 'bg-emerald-500 text-neutral-950 font-black'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Demo Mteja
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (detectionMode === 'live_camera') {
                          executeLiveCameraSearch();
                        } else {
                          triggerFaceSearch(activeSubject);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Skani Upya</span>
                    </button>
                  </div>

                  {/* QUICK DEMO CUSTOMERS SELECTOR */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      Wateja wa Mfano (Demo Biometric Profiles):
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {customers.slice(0, 3).map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setDetectionMode('test_profiles');
                            setActiveSubject(cust);
                            triggerFaceSearch(cust);
                          }}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            matchedCustomer?.id === cust.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-white'
                              : 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <img src={cust.avatar} alt={cust.name} className="w-5 h-5 rounded-full object-cover" />
                            <span className="text-xs font-bold truncate">{cust.name.split(' ')[0]}</span>
                          </div>
                          <p className="text-[9px] font-mono text-cyan-300 mt-0.5 truncate">
                            TZS {cust.walletBalance.toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: MATCHED CUSTOMER WALLET & CASH OPERATIONS (KUWEKA & KUTOA PESA) */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                {!matchedCustomer ? (
                  /* EMPTY STATE - PROMPT TO SCAN FACE */
                  <div className="p-8 rounded-3xl bg-[#0c1424] border border-white/10 flex flex-col items-center justify-center text-center space-y-4 min-h-[380px]">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border-2 border-dashed border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <ScanFace className="w-10 h-10 animate-pulse" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center text-xs font-black">
                        !
                      </span>
                    </div>

                    <div className="max-w-md space-y-1.5">
                      <h3 className="text-base font-bold text-white">Elekeza Kamera Kwenye Uso wa Mteja</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Mteja hahitaji kubeba kadi wala simu! Mfumo wa AI Face Biometrics utamtambua moja kwa moja na kufungua pochi yake ya PapoPay.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDetectionMode('live_camera');
                          executeLiveCameraSearch();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Skani Uso wa Mteja Sasa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsNewCustomerModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-emerald-400" />
                        <span>Sajili Mteja Mpya kwa Uso</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VERIFIED CUSTOMER PROFILE & FINANCIAL OPERATIONS */
                  <div className="space-y-4">
                    {/* CUSTOMER PROFILE CARD - 100% FACE VERIFIED */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-[#0c1424] border-2 border-emerald-500/40 shadow-xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={matchedCustomer.avatar}
                              alt={matchedCustomer.name}
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                            />
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                                Salama 100% • Akaunti Inalingana na Uso
                              </span>
                              <span className="text-[10px] font-mono text-cyan-300">
                                AI Match: 99.8%
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                              {matchedCustomer.name}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono mt-0.5">
                              <span>Simu: {matchedCustomer.phone}</span>
                              <span>•</span>
                              <span>NIDA: {matchedCustomer.nidaNumber || 'NIDA-2001-OK'}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setMatchedCustomer(null);
                            setSearchState('idle_no_face');
                            toast.info("Mteja amefungwa. Tayari kwa mteja mwingine.");
                          }}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
                          title="Maliza na Funga Mteja"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* BALANCE HIGHLIGHT */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-[#0c1424] border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            Salio la Pochi ya Mteja (Hahitaji Simu wala Kadi):
                          </span>
                          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-0.5">
                            TZS {matchedCustomer.walletBalance.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            Float Yako ya Wakala:
                          </span>
                          <div className="text-base font-bold font-mono text-cyan-300 mt-0.5">
                            TZS {floatBalance.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DUAL OPERATION TABS: KUWEKA PESA (CASH-IN) & KUTOA PESA (CASH-OUT WITH PIN) */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-[#0c1424] border border-white/10 space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveService('deposit');
                            triggerHapticTap();
                          }}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            activeService === 'deposit'
                              ? 'bg-emerald-500 text-neutral-950 font-black shadow-lg shadow-emerald-500/20'
                              : 'bg-white/5 text-neutral-400 hover:text-white'
                          }`}
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          <span>1. Kuweka Pesa (Cash-In)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveService('withdraw');
                            triggerHapticTap();
                          }}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            activeService === 'withdraw'
                              ? 'bg-amber-500 text-neutral-950 font-black shadow-lg shadow-amber-500/20'
                              : 'bg-white/5 text-neutral-400 hover:text-white'
                          }`}
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>2. Kutoa Pesa (Cash-Out)</span>
                        </button>
                      </div>

                      {/* SUB-PANEL 1: KUWEKA PESA (CASH-IN) */}
                      {activeService === 'deposit' && (
                        <div className="space-y-3.5">
                          <div>
                            <label className="text-xs font-bold text-neutral-300 block mb-1">
                              Chagua au Andika Kiasi cha Kuweka (TZS):
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                              {[5000, 10000, 20000, 50000, 100000].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => {
                                    setDepositAmount(amt);
                                    triggerHapticTap();
                                  }}
                                  className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                    depositAmount === amt
                                      ? 'bg-emerald-500 text-neutral-950'
                                      : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                                  }`}
                                >
                                  {amt.toLocaleString()}
                                </button>
                              ))}
                            </div>

                            <input
                              type="number"
                              value={depositAmount || ''}
                              onChange={(e) => setDepositAmount(Number(e.target.value))}
                              placeholder="Weka kiasi maalum..."
                              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-400"
                            />
                          </div>

                          <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono">
                            <span className="text-neutral-400">Kamisheni ya Wakala (1.2%):</span>
                            <span className="text-emerald-400 font-bold">
                              +TZS {Math.round(depositAmount * 0.012).toLocaleString()}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isProcessingAction || depositAmount <= 0}
                            onClick={handleExecuteDeposit}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer"
                          >
                            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                            <span>
                              {isProcessingAction
                                ? 'Inaweka Pesa Kwenye Akaunti...'
                                : `Weka TZS ${depositAmount.toLocaleString()} Kwenye Pochi ya ${matchedCustomer.name.split(' ')[0]}`}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* SUB-PANEL 2: KUTOA PESA (CASH-OUT) WITH DUAL FACTOR (FACE + SECRET PIN) */}
                      {activeService === 'withdraw' && (
                        <div className="space-y-3.5">
                          {/* DUAL SECURITY REMINDER CARD */}
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-200">
                              <span className="font-bold block">Uso wa Mteja + PIN ya Siri (Ufunguo Salama):</span>
                              Mteja ataingiza PIN yake ya siri (tarakimu 4) kwenye skrini ili kuidhinisha kutoa pesa. Hakuna mtu anayeweza kutoa pesa bila uso na PIN yake!
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-neutral-300 block mb-1">
                              Chagua au Andika Kiasi cha Kutoa Taslimu (TZS):
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                              {[5000, 10000, 20000, 50000, 100000].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => {
                                    setWithdrawAmount(amt);
                                    triggerHapticTap();
                                  }}
                                  className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                    withdrawAmount === amt
                                      ? 'bg-amber-500 text-neutral-950'
                                      : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                                  }`}
                                >
                                  {amt.toLocaleString()}
                                </button>
                              ))}
                            </div>

                            <input
                              type="number"
                              value={withdrawAmount || ''}
                              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                              placeholder="Weka kiasi maalum cha kutoa..."
                              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
                            />
                          </div>

                          <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono">
                            <span className="text-neutral-400">Kamisheni ya Wakala (1.2%):</span>
                            <span className="text-amber-400 font-bold">
                              +TZS {Math.round(withdrawAmount * 0.012).toLocaleString()}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isProcessingAction || withdrawAmount <= 0}
                            onClick={() => handleExecuteWithdraw(withdrawAmount)}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 disabled:opacity-40 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer"
                          >
                            <KeyRound className="w-5 h-5 stroke-[2.5]" />
                            <span>
                              Idhinisha Kutoa TZS {withdrawAmount.toLocaleString()} kwa PIN
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {(portalMode === 'ledger' || mobileTab === 'ledger') && (
          <div className="mt-4 sm:mt-6 bg-[#0c1322] rounded-2xl sm:rounded-3xl border border-white/10 p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">Kumbukumbu ya Miamala ya Wakala</h3>
                <p className="text-[11px] sm:text-xs text-neutral-400">Miamala yote ya Cash-In na Cash-Out iliyoidhinishwa kwa uso</p>
              </div>
              <span className="self-start sm:self-auto px-2.5 sm:px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] sm:text-xs font-mono font-bold">
                Jumla: {transactions.length} Miamala
              </span>
            </div>

            {/* Mobile View: Cards */}
            <div className="block sm:hidden space-y-2.5">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs font-mono">
                  Hakuna miamala iliyofanyika bado
                </div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-cyan-300">{tx.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.type.includes('Kuweka') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {tx.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{tx.customer}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{tx.date} · {tx.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black font-mono text-white">TZS {tx.amount.toLocaleString()}</p>
                        <p className="text-[10px] font-mono text-emerald-400">+TZS {tx.commission.toLocaleString()} faida</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Ref Code</th>
                    <th className="py-3 px-3">Mteja</th>
                    <th className="py-3 px-3">Aina ya Muamala</th>
                    <th className="py-3 px-3 text-right">Kiasi</th>
                    <th className="py-3 px-3 text-right">Kamisheni</th>
                    <th className="py-3 px-3 text-right">Muda</th>
                    <th className="py-3 px-3 text-center">Hali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-cyan-300">{tx.id}</td>
                      <td className="py-3.5 px-3 font-sans font-bold text-white">{tx.customer}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type.includes('Kuweka') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-white">TZS {tx.amount.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-400">+TZS {tx.commission.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right text-neutral-400">{tx.date} {tx.time}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          ✓ Imekamilika
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* FLOAT TOP UP MODAL */}
      <AnimatePresence>
        {isFloatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border border-cyan-500/40 rounded-3xl max-w-sm w-full p-6 text-white space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Ongeza Float ya Wakala</h3>
                <button type="button" onClick={() => setIsFloatModalOpen(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">Kiasi cha Kuongeza (TZS):</label>
                <input
                  type="number"
                  value={floatTopUpAmount}
                  onChange={(e) => setFloatTopUpAmount(e.target.value)}
                  className="w-full bg-black/60 border border-cyan-500/30 px-4 py-3 rounded-2xl font-mono text-xl font-bold text-cyan-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[500000, 1000000, 2000000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFloatTopUpAmount(amt.toString())}
                    className="py-2 px-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold"
                  >
                    {amt/1000000}M
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleTopUpFloat}
                className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase"
              >
                Thibitisha Kuongeza Float
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOMER PIN VERIFICATION MODAL FOR DUAL SECURITY CASH-OUT */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0d1627] border-2 border-amber-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4 shadow-2xl shadow-amber-950/50"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Idhinisha Kutoa Fedha Taslimu</h3>
                <p className="text-xs text-neutral-400">
                  Uso wa mteja umethibitishwa 100%. Mteja aingize PIN ya siri.
                </p>
              </div>

              {/* AMOUNT & CUSTOMER INFO */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Kiasi cha Kutoa Taslimu
                </span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  TZS {pinPendingWithdraw?.toLocaleString()}
                </span>
                <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-neutral-300">
                  <img src={matchedCustomer?.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                  <span className="font-bold">{matchedCustomer?.name}</span>
                </div>
              </div>

              {/* PIN DISPLAY */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 block text-center">
                  PIN ya Siri ya Mteja (Tarakimu 4):
                </label>
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-11 h-12 rounded-2xl border flex items-center justify-center text-xl font-bold font-mono transition-all ${
                        enteredPin.length > idx
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-md shadow-amber-500/20'
                          : 'border-white/20 bg-black/40 text-neutral-600'
                      }`}
                    >
                      {enteredPin.length > idx ? '●' : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* NUMERIC KEYPAD */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (enteredPin.length < 4) {
                        setEnteredPin(prev => prev + digit);
                        triggerHapticTap();
                      }
                    }}
                    className="py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 font-mono text-base font-bold text-white transition-all active:scale-95 cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEnteredPin('');
                    triggerHapticTap();
                  }}
                  className="py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-xs active:scale-95 cursor-pointer"
                >
                  Futa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      setEnteredPin(prev => prev + '0');
                      triggerHapticTap();
                    }
                  }}
                  className="py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 font-mono text-base font-bold text-white transition-all active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnteredPin(prev => prev.slice(0, -1));
                    triggerHapticTap();
                  }}
                  className="py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-300 font-bold text-xs active:scale-95 cursor-pointer"
                >
                  ←
                </button>
              </div>

              {/* DEMO SHORTCUT BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setEnteredPin('1234');
                  triggerHapticTap();
                }}
                className="w-full py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/20 transition-colors cursor-pointer"
              >
                Tumia PIN ya Mfano (1234)
              </button>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setEnteredPin('');
                  }}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
                >
                  Ghairi
                </button>

                <button
                  type="button"
                  disabled={enteredPin.length < 4}
                  onClick={handleConfirmPinWithdrawal}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 disabled:opacity-40 text-neutral-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Toa Pesa Sasa</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW CUSTOMER REGISTRATION MODAL (USAJILI WA USO KWA MTEJA MPYA) */}
      <AnimatePresence>
        {isNewCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border-2 border-emerald-500/40 rounded-3xl max-w-md w-full p-5 text-white space-y-4 shadow-2xl shadow-emerald-950/60 my-auto"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Usajili wa Uso kwa Mteja Mpya
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Hahitaji simu wala kadi — sura yake inatosha!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* CAMERA CAPTURE PREVIEW */}
              <div className="p-3 rounded-2xl bg-black/60 border border-white/10 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-cyan-500/40 overflow-hidden flex items-center justify-center shrink-0">
                  {regPhotoPreview ? (
                    <img src={regPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ScanFace className="w-8 h-8 text-cyan-400 animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-white block">Alama za Uso za AI Biometrics</span>
                  <p className="text-[10px] text-neutral-400">
                    Picha inanaswa kiotomatiki kutoka kwenye kamera ya Wakala.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const snap = captureCurrentFrame();
                      setRegPhotoPreview(snap);
                      toast.success("Picha ya uso imenasa vizuri!");
                    }}
                    className="mt-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Nasa Upya Uso</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleRegisterNewCustomerSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">
                    Jina Kamili la Mteja: *
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="mf. Fatma Rashidi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">
                      Namba ya Simu: *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0755 890 123"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">
                      Namba ya NIDA (Kitambulisho):
                    </label>
                    <input
                      type="text"
                      value={regNida}
                      onChange={(e) => setRegNida(e.target.value)}
                      placeholder="19950312-XXXXX-00001"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">
                      PIN ya Siri ya Mteja (Tarakimu 4): *
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="1234"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">
                      Salio la Kuanzia (TZS):
                    </label>
                    <input
                      type="number"
                      value={regInitialBalance}
                      onChange={(e) => setRegInitialBalance(Number(e.target.value))}
                      placeholder="50000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Akaunti itafunguliwa na kuunganishwa moja kwa moja na sura ya mteja.</span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Funga
                  </button>

                  <button
                    type="submit"
                    disabled={isRegisteringCustomer}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isRegisteringCustomer ? 'Inasajili...' : 'Kamilisha Usajili'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RISITI YA KIELEKTRONIKI (E-RECEIPT) ENHANCED WITH PRINT & SHARE */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border-2 border-emerald-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4 shadow-2xl shadow-emerald-950/60"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black">Risiti ya Kielektroniki ya PapoPay</h3>
                <p className="text-[10px] font-mono text-emerald-300">{lastReceipt.id}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  {lastReceipt.type}
                </span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  TZS {lastReceipt.amount.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                  Kamisheni ya Wakala: +TZS {lastReceipt.commission.toLocaleString()}
                </p>
              </div>

              <div className="space-y-1.5 text-xs font-mono text-neutral-300 border-t border-b border-white/10 py-2.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mteja:</span>
                  <span className="font-bold text-white">{lastReceipt.customer}</span>
                </div>
                {lastReceipt.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Simu:</span>
                    <span>{lastReceipt.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kituo cha Wakala:</span>
                  <span>{lastReceipt.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Muda:</span>
                  <span>{lastReceipt.date} {lastReceipt.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Uthibitisho:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    {lastReceipt.securityMethod || 'AI Face ID Verified ✓'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-2xl text-neutral-900">
                <QRCodeSVG value={`https://papopay.tz/receipt/${lastReceipt.id}`} size={80} />
                <span className="text-[9px] text-neutral-600 font-mono mt-1 font-bold">
                  EFD BOT Electronic Receipt Verified
                </span>
              </div>

              {/* ACTION BUTTONS: PRINT & SHARE */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Chapisha</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareReceipt}
                  className="py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/30 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp/SMS</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
              >
                Funga Risiti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FACE REGISTRATION MODAL FOR UNREGISTERED CUSTOMERS */}
      <FaceRegistrationModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        onSuccess={handleEnrollSuccess}
        initialName={activeSubject?.hasAccountButNoFace ? activeSubject.name : "Mteja Mpya"}
        initialPhone={activeSubject?.hasAccountButNoFace ? activeSubject.phone : "0755 123 456"}
      />

      {/* MOBILE BOTTOM FLOATING DOCK (STICKY PHONE NAVIGATION) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0c1222]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => { setPortalMode('pos_hub'); setMobileTab('pos'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all relative cursor-pointer ${
            (portalMode === 'pos_hub' || portalMode === 'terminal') && mobileTab !== 'ledger'
              ? 'text-emerald-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Store className="w-4 h-4" />
          <span className="text-[9px] font-medium tracking-tight">1. POS Kaunta</span>
        </button>

        <button
          type="button"
          onClick={() => { setPortalMode('wakala_kawaida'); setMobileTab('pos'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            portalMode === 'wakala_kawaida' && mobileTab !== 'ledger'
              ? 'text-cyan-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span className="text-[9px] font-medium tracking-tight">2. Wakala Mtaani</span>
        </button>

        <button
          type="button"
          onClick={() => { setIsNewCustomerModalOpen(true); triggerHapticTap(); }}
          className="mx-0.5 px-2.5 py-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-neutral-950 flex flex-col items-center justify-center shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span className="text-[7.5px] font-black uppercase">+ Sajili</span>
        </button>

        <button
          type="button"
          onClick={() => { setIsFloatModalOpen(true); triggerHapticTap(); }}
          className="flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all text-neutral-400 hover:text-white cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[9px] font-medium tracking-tight">Float</span>
        </button>

        <button
          type="button"
          onClick={() => { setPortalMode('ledger'); setMobileTab('ledger'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            portalMode === 'ledger' || mobileTab === 'ledger'
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <Receipt className="w-4 h-4" />
            <span className="absolute -top-1 -right-2 px-1 rounded-full bg-white/10 text-[7px] font-mono">
              {transactions.length}
            </span>
          </div>
          <span className="text-[9px] font-medium tracking-tight">Miamala</span>
        </button>
      </nav>
    </div>
  );
}
