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
  AlertTriangle, SwitchCamera, ChevronDown, ChevronUp, Users, CreditCard
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
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

  // Active top-level navigation
  const [portalMode, setPortalMode] = useState<'terminal' | 'ledger' | 'float_mgmt'>('terminal');

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
            walletBalance: 500000,
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
  const handleSelectCustomerSubject = (customer: SimulatedCustomer) => {
    setActiveSubject(customer);
    setMatchedCustomer(null);
    setIsCustomerConfirmed(false);
    triggerHapticTap();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileTab('pos');
    }

    speak(`Umechagua mteja husika: ${customer.name.split(' ')[0]}. Inachanganua uso wake kuthibitisha...`);
    toast.info(`Mteja Husika Aliyelengwa: ${customer.name}`, {
      description: `Simu: ${customer.phone} | Salio: TZS ${customer.walletBalance.toLocaleString()}`,
      icon: '🎯'
    });

    // Run verification directly for this specific targeted customer
    triggerFaceSearch(customer);
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
        setIsCustomerConfirmed(false); // Can be confirmed or transacted immediately!
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileTab('pos');
        }
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja husika ${verified.name.split(' ')[0]} ametambuliwa kikamilifu kwa uso wake bila kubonyeza. Salio lake ni shilingi ${verified.walletBalance.toLocaleString()}.`);
        toast.success(`🎯 Uso Umetambuliwa Kiotomatiki: ${verified.name}`, { 
          description: `Simu: ${verified.phone} | Salio: TZS ${verified.walletBalance.toLocaleString()} (Hands-Free)`,
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
        setIsCustomerConfirmed(false);
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          setMobileTab('pos');
        }
        playPaymentChime();
        triggerHapticTap();
        speak(`Mteja ${target.name.split(' ')[0]} ametambuliwa kikamilifu. Salio lako ni shilingi ${target.walletBalance.toLocaleString()}. Tafadhali thibitisha kabla ya huduma.`);
        toast.success(`Mteja Ametambuliwa: ${target.name}`, { icon: '✅' });
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
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

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

      speak(`Pesa shilingi ${depositAmount.toLocaleString()} zimewekwa kikamilifu kwa ${matchedCustomer.name.split(' ')[0]}. Kamisheni yako ni shilingi ${commission.toLocaleString()}.`);
      toast.success(`TZS ${depositAmount.toLocaleString()} Zimewekwa kwa Uso! Kamisheni: +TZS ${commission.toLocaleString()}`, { icon: '💰' });
    }, 1400);
  };

  // 2. KUTOA PESA (CASH-OUT WITHDRAWAL)
  const handleExecuteWithdraw = () => {
    if (!matchedCustomer || isProcessingAction) return;
    if (withdrawAmount <= 0) {
      toast.error('Weka kiasi sahihi cha kutoa pesa!');
      return;
    }
    if (matchedCustomer.walletBalance < withdrawAmount) {
      toast.error(`Salio la mteja halitoshi! (Salio: TZS ${matchedCustomer.walletBalance.toLocaleString()})`);
      speak("Salio la mteja halitoshi kwa kutoa kiasi hiki.");
      return;
    }

    setIsProcessingAction(true);
    speak(`Mteja anatoa shilingi ${withdrawAmount.toLocaleString()}. Inathibitisha kibayometriki...`);

    setTimeout(() => {
      setIsProcessingAction(false);
      playPaymentChime();
      triggerHapticTap();

      const commission = Math.round(withdrawAmount * 0.012);
      setCommissionEarned(prev => prev + commission);
      setFloatBalance(prev => prev + withdrawAmount + commission);

      const updatedBalance = matchedCustomer.walletBalance - withdrawAmount;
      const updatedCust = { ...matchedCustomer, walletBalance: updatedBalance };
      setMatchedCustomer(updatedCust);
      setCustomers(prev => prev.map(c => c.id === matchedCustomer.id ? updatedCust : c));

      const newTx = {
        id: `WAK-WTH-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: matchedCustomer.name,
        type: 'Cash-Out (Kutoa)',
        amount: withdrawAmount,
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

      speak(`Kutoa pesa kwa shilingi ${withdrawAmount.toLocaleString()} kumethibitishwa. Mkabidhi mteja pesa taslimu.`);
      toast.success(`Kutoa Pesa Kumethibitishwa! Mkabidhi mteja TZS ${withdrawAmount.toLocaleString()}`, { icon: '💵' });
    }, 1400);
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
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Bila password</p>
            </div>
            <span className="text-[9px] sm:text-[11px] text-emerald-400 font-mono font-bold truncate">Face Active</span>
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
              <p className="text-[9px] sm:text-[11px] text-neutral-400 mt-0.5 truncate">Bila kadi wala simu</p>
            </div>
            <span className="text-[9px] sm:text-[11px] text-amber-400 font-mono font-bold truncate">Smile-to-Withdraw</span>
          </div>
        </div>

        {/* MOBILE SEGMENTED VIEW CONTROLLER (< lg) */}
        <div className="lg:hidden w-full mt-3 sticky top-[48px] z-30 bg-[#0c1222]/95 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-xl">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => { setMobileTab('camera'); setPortalMode('terminal'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                portalMode === 'terminal' && mobileTab === 'camera'
                  ? 'bg-cyan-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Camera className="w-4 h-4" />
                {liveFaceDetected && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <span className="truncate">1. Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => { setMobileTab('pos'); setPortalMode('terminal'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all relative cursor-pointer ${
                portalMode === 'terminal' && mobileTab === 'pos'
                  ? 'bg-emerald-500 text-neutral-950 shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Wallet className="w-4 h-4" />
                {matchedCustomer && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-amber-400 text-neutral-950 text-[7px] font-mono font-black animate-pulse">
                    MTEJA!
                  </span>
                )}
              </div>
              <span className="truncate">2. POS Kaunta</span>
            </button>

            <button
              type="button"
              onClick={() => { setMobileTab('customers'); setPortalMode('terminal'); triggerHapticTap(); }}
              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                portalMode === 'terminal' && mobileTab === 'customers'
                  ? 'bg-purple-500 text-white shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="truncate">3. Wateja</span>
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

        {/* DESKTOP TAB CONTROLS (TERMINAL vs LEDGER) - Visible on lg screens */}
        <div className="hidden lg:flex mt-6 flex-row items-center justify-between gap-3 border-b border-white/10 pb-4 w-full">
          {/* Main Mode Tabs: Terminal vs Ledger */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalMode('terminal');
                triggerHapticTap();
              }}
              className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                portalMode === 'terminal'
                  ? 'bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <ScanFace className="w-4 h-4 shrink-0" />
              <span>1. Terminal (Uso)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalMode('ledger');
                triggerHapticTap();
              }}
              className={`py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                portalMode === 'ledger'
                  ? 'bg-cyan-500 text-neutral-950 shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>2. Miamala ({transactions.length})</span>
            </button>
          </div>

          {/* Detection Mode Controls & Quick Rescan */}
          <div className="flex items-center justify-end gap-2">
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
        {(portalMode === 'terminal' && mobileTab !== 'ledger') && (
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

                {/* Top Corner Badge: Scanner Status */}
                <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 z-20 flex flex-col gap-1 max-w-[70%] sm:max-w-none">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`px-2.5 sm:px-3 py-1 rounded-xl backdrop-blur-md text-[9px] sm:text-[10px] font-mono border flex items-center gap-1.5 truncate ${
                      searchState === 'customer_found'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-950'
                        : searchState === 'searching_db'
                        ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40 animate-pulse'
                        : searchState === 'unregistered'
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                        : 'bg-black/85 text-neutral-300 border-white/10'
                    }`}>
                      {searchState === 'searching_db' ? (
                        <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 animate-spin shrink-0" />
                      ) : searchState === 'customer_found' ? (
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                      ) : searchState === 'unregistered' ? (
                        <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-bounce shrink-0" />
                      ) : (
                        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 animate-pulse shrink-0" />
                      )}
                      <span className="font-bold truncate">
                        {searchState === 'searching_db'
                          ? 'Inachanganua uso...'
                          : searchState === 'customer_found'
                          ? (isCustomerConfirmed ? 'Mteja Amethibitishwa 99.8% ✓' : 'Ametambuliwa Kiotomatiki ✓')
                          : searchState === 'unregistered'
                          ? 'Sura Haipo Kwenye Mfumo ⚠️'
                          : liveFaceDetected 
                          ? 'Uso Umeonekana (Inachanganua...)' 
                          : 'Standby: Inasubiri Mteja (Hakuna Mtu)...'}
                      </span>
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-semibold">
                      <span className={`w-1.5 h-1.5 rounded-full ${liveFaceDetected ? 'bg-emerald-400 animate-ping' : 'bg-neutral-500'}`}></span>
                      {liveFaceDetected ? 'Uso Upo' : 'Hakuna Mtu'}
                    </span>
                    {searchState === 'idle_no_face' && (
                      <button
                        type="button"
                        onClick={() => executeLiveCameraSearch()}
                        className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Bonyeza hapa kuchanganua uso wa mteja"
                      >
                        <ScanFace className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Skani Sasa</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* HUD Mode Switcher & Camera Flip (Phone & Desktop) */}
                <div className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 z-20 flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-1 sm:px-2 py-0.5 rounded-lg sm:rounded-xl bg-black/80 hover:bg-black text-cyan-300 border border-white/15 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold shadow-lg cursor-pointer active:scale-95 transition-all"
                    title="Geuza Kamera (Mbele / Nyuma)"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">{cameraFacing === 'user' ? 'Kamera ya Mbele' : 'Kamera ya Nyuma'}</span>
                  </button>

                  <div className="flex items-center gap-0.5 sm:gap-1 bg-black/80 backdrop-blur-md p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-white/10 text-[9px] sm:text-[10px]">
                    <button
                      type="button"
                      onClick={() => setHudMode('mesh')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg ${hudMode === 'mesh' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                    >
                      3D Mesh
                    </button>
                    <button
                      type="button"
                      onClick={() => setHudMode('neural_box')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg ${hudMode === 'neural_box' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                    >
                      YOLO
                    </button>
                    <button
                      type="button"
                      onClick={() => setHudMode('liveness_depth')}
                      className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg ${hudMode === 'liveness_depth' ? 'bg-emerald-500 text-neutral-950 font-bold' : 'text-neutral-400'}`}
                    >
                      Depth
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
                !isCustomerConfirmed ? (
                  /* STEP 1: CUSTOMER IDENTITY RECOGNIZED - MUST CONFIRM FIRST */
                  <div className="bg-[#0c1322] p-6 rounded-3xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/60 space-y-5">
                    <div className="text-center space-y-3">
                      <div className="relative inline-block mx-auto">
                        <img
                          src={matchedCustomer.avatar}
                          alt="Matched Customer"
                          className="w-24 h-24 rounded-3xl object-cover border-4 border-emerald-400 shadow-xl shadow-emerald-500/30 mx-auto"
                        />
                        <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[10px] shadow-lg flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>VERIFIED 99.8%</span>
                        </span>
                      </div>

                      <div>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/40">
                          🎯 Mteja Husika Ametambuliwa kwa Uso
                        </span>
                        <h2 className="text-2xl font-black text-white mt-1">{matchedCustomer.name}</h2>
                        <p className="text-xs text-neutral-300 font-mono mt-0.5">
                          Namba ya Simu: <span className="text-emerald-400 font-bold">{matchedCustomer.phone}</span>
                        </p>
                      </div>
                    </div>

                    {/* Customer Details Box: Balance, Phone, Biometric Key */}
                    <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-xs text-neutral-400">Salio Halisi la Akaunti:</span>
                        <span className="text-xl font-mono font-black text-emerald-400">
                          TZS {matchedCustomer.walletBalance.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Ufunguo wa Kibayometriki:</span>
                        <span className="font-mono text-cyan-300 truncate max-w-[180px]">{matchedCustomer.faceEmbeddingId}</span>
                      </div>

                      {matchedCustomer.nidaNumber && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Namba ya NIDA:</span>
                          <span className="font-mono text-neutral-300">{matchedCustomer.nidaNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Notice */}
                    <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>
                        Mteja amethibitishwa kwa uso wake. Thibitisha taarifa hizi hapa chini ili ufungue huduma za kuweka pesa au kutoa pesa.
                      </span>
                    </div>

                    {/* BIG CONFIRMATION BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomerConfirmed(true);
                        playPaymentChime();
                        triggerHapticTap();
                        speak(`Uthibitisho umekamilika. Sasa unaweza kumpatia ${matchedCustomer.name.split(' ')[0]} huduma.`);
                        toast.success(`Mteja Amethibitishwa: ${matchedCustomer.name}`, { icon: '✅' });
                      }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>Thibitisha Mteja Huyu & Fungua Huduma</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMatchedCustomer(null);
                        setActiveSubject(null);
                        setIsCustomerConfirmed(false);
                        setSearchState('idle_no_face');
                        speak("Uthibitisho umeghairiwa. Inasubiri mteja husika.");
                        toast.info("Uthibitisho Umeghairiwa", { 
                          description: "Chagua mteja husika kwenye orodha au elekeza kamera kwa mteja mwingine.",
                          icon: '🔄' 
                        });
                      }}
                      className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>❌ Sio Mteja Husika? (Scan / Chagua Mteja Mwingine)</span>
                    </button>
                  </div>
                ) : (
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
                        onClick={handleExecuteWithdraw}
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
              )
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
                  /* IDLE / WAITING FOR CUSTOMER FACE */
                  <div className="bg-[#0c1322] p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 shadow-xl flex flex-col items-center justify-center text-center space-y-4 sm:space-y-5 min-h-[340px] sm:min-h-[420px]">
                    <div className="relative">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-cyan-500/10 border-2 border-cyan-400/40 text-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <ScanFace className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500 border-2 border-[#0c1322] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      </div>
                    </div>

                    <div className="space-y-1 sm:space-y-1.5 max-w-sm">
                      <h3 className="text-lg sm:text-xl font-black text-white">Inasubiri Utambuzi wa Uso</h3>
                      <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                        Mteja asimame mbele ya kamera ya Wakala. Kamera ita-detect uso wake kiotomatiki, itachanganua kanzidata ya PapoPay, na kufungua huduma za kuweka na kutoa pesa.
                      </p>
                    </div>

                    <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 w-full max-w-sm text-left space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs text-neutral-300">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                        <span>Kamera ya Utambuzi wa Kibayometriki (AI Face Tracking)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span>Ukaguzi wa Kanzidata ya PapoPay (12,450 records)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>Kama hayupo, fomu ya usajili itatokea papo hapo</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full max-w-sm">
                      <button
                        type="button"
                        onClick={executeLiveCameraSearch}
                        disabled={isSearchingRef.current}
                        className="w-full sm:flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
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
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer transition-colors"
                      >
                        Demo Profiles
                      </button>
                    </div>
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTION LEDGER */}
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

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-[#0c1424] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-5 text-white space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black">Risiti ya Wakala wa PapoPay</h3>
                <p className="text-[10px] font-mono text-emerald-300">{lastReceipt.id}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5 text-center">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">{lastReceipt.type}</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  TZS {lastReceipt.amount.toLocaleString()}
                </span>
                <p className="text-[10px] text-emerald-300 font-mono mt-0.5">Kamisheni: +TZS {lastReceipt.commission.toLocaleString()}</p>
              </div>

              <div className="space-y-1 text-xs font-mono text-neutral-300 border-t border-b border-white/10 py-2.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mteja:</span>
                  <span className="font-bold text-white">{lastReceipt.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Kituo cha Wakala:</span>
                  <span>{lastReceipt.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Muda:</span>
                  <span>{lastReceipt.date} {lastReceipt.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Uthibitisho:</span>
                  <span className="text-emerald-400 font-bold">Face ID Verified ✓</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-2xl">
                <QRCodeSVG value={`https://papo.tz/receipt/${lastReceipt.id}`} size={80} />
                <span className="text-[9px] text-neutral-600 font-mono mt-1">EFD Digital Receipt BOT</span>
              </div>

              <button
                type="button"
                onClick={() => setLastReceipt(null)}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
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
          onClick={() => { setPortalMode('terminal'); setMobileTab('camera'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            portalMode === 'terminal' && mobileTab === 'camera'
              ? 'text-cyan-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <Camera className="w-4 h-4" />
            {liveFaceDetected && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-[9px] font-medium tracking-tight">Kamera</span>
        </button>

        <button
          type="button"
          onClick={() => { setPortalMode('terminal'); setMobileTab('pos'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all relative cursor-pointer ${
            portalMode === 'terminal' && mobileTab === 'pos'
              ? 'text-emerald-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <Wallet className="w-4 h-4" />
            {matchedCustomer && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-amber-400 text-neutral-950 text-[7px] font-mono font-black animate-pulse">
                ✓
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium tracking-tight">POS Kaunta</span>
        </button>

        <button
          type="button"
          onClick={() => { setIsFloatModalOpen(true); triggerHapticTap(); }}
          className="mx-1 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-neutral-950 flex flex-col items-center justify-center shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="text-[8px] font-black uppercase">Float</span>
        </button>

        <button
          type="button"
          onClick={() => { setPortalMode('terminal'); setMobileTab('customers'); triggerHapticTap(); }}
          className={`flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            portalMode === 'terminal' && mobileTab === 'customers'
              ? 'text-purple-400 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[9px] font-medium tracking-tight">Wateja</span>
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
