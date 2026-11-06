import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, ShieldCheck, Zap, Users, RefreshCw, 
  CheckCircle2, AlertTriangle, ChevronRight, Lock, 
  Calendar, DollarSign, Smartphone, Camera, PenTool,
  TrendingUp, Award, Building2, Briefcase, FileText,
  X as CloseIcon, Info, ArrowUpRight, Check, Sparkles,
  PieChart, Layers, Sliders, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

interface PapoCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceContext?: string; // e.g. 'PapoRide', 'PapoFood', 'PapoPharmacy'
}

export default function PapoCreditModal({ isOpen, onClose, initialServiceContext }: PapoCreditModalProps) {
  const { user, profile } = useAuth();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'pillars' | 'services' | 'lenders' | 'business_model'>('pillars');
  const [activePillar, setActivePillar] = useState<'score' | 'flex' | 'guarantor' | 'repay' | 'protect'>('score');

  // Credit Account State (Saved locally for seamless demo continuity)
  const [creditLimit, setCreditLimit] = useState<number>(200000);
  const [usedCredit, setUsedCredit] = useState<number>(55000);
  const availableCredit = Math.max(0, creditLimit - usedCredit);
  const creditScore = 785; // Out of 850 (Daraja la Kwanza / Prime)

  // PapoFlex State
  const [selectedTerm, setSelectedTerm] = useState<'7days' | '14days' | '30days' | 'salary'>('7days');
  const [calculatorAmount, setCalculatorAmount] = useState<number>(40000);

  // PapoGuarantor Form & Signature State
  const [nidaNumber, setNidaNumber] = useState('19920412-11104-00001-24');
  const [phoneOperator, setPhoneOperator] = useState('vodacom');
  const [phoneYears, setPhoneYears] = useState('6');
  const [guarantorType, setGuarantorType] = useState<'individual' | 'company' | 'saccos'>('company');
  const [guarantorName, setGuarantorName] = useState('CRDB SACCOS / Bakhresa Group');
  const [guarantorPhone, setGuarantorPhone] = useState('+255 754 123 456');
  const [hasSignature, setHasSignature] = useState(false);
  const [isCapturingSelfie, setIsCapturingSelfie] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState<string | null>(null);
  const [kycSubmitted, setKycSubmitted] = useState(true);

  // Canvas for Digital Signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // PapoRepay State
  const [repayAmount, setRepayAmount] = useState<string>('55000');
  const [repayProvider, setRepayProvider] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'papopay'>('mpesa');
  const [isProcessingRepay, setIsProcessingRepay] = useState(false);
  const [repaySuccessReceipt, setRepaySuccessReceipt] = useState<any | null>(null);

  // PapoProtect State
  const [isAccountFrozen, setIsAccountFrozen] = useState(false);

  // Initialize Canvas for Signature Drawing
  useEffect(() => {
    if (activePillar === 'guarantor' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#059669'; // Emerald signature
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activePillar]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  // Live Camera Selfie Capture
  const handleTakeSelfie = async () => {
    try {
      setIsCapturingSelfie(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        setTimeout(() => {
          const snapCanvas = document.createElement('canvas');
          snapCanvas.width = video.videoWidth || 320;
          snapCanvas.height = video.videoHeight || 240;
          const ctx = snapCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
            const dataUrl = snapCanvas.toDataURL('image/jpeg');
            setSelfieCaptured(dataUrl);
            toast.success("✅ Picha ya Uso (Live Selfie) imethibitishwa!");
          }
          // Stop stream
          stream.getTracks().forEach(track => track.stop());
          setIsCapturingSelfie(false);
        }, 1200);
      };
    } catch (err) {
      setIsCapturingSelfie(false);
      // Fallback for simulation
      setSelfieCaptured("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80");
      toast.info("Picha ya uthibitisho imehifadhiwa kielektroniki");
    }
  };

  // Handle Repayment Action
  const handleMakeRepayment = () => {
    const amountNum = parseInt(repayAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Tafadhali weka kiasi sahihi cha kulipa");
      return;
    }

    if (amountNum > usedCredit) {
      toast.error(`Kiasi kikuu cha deni ni TZS ${usedCredit.toLocaleString()}`);
      return;
    }

    setIsProcessingRepay(true);
    setTimeout(() => {
      setIsProcessingRepay(false);
      const newUsed = Math.max(0, usedCredit - amountNum);
      setUsedCredit(newUsed);

      const receipt = {
        txId: `PPR-${Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        amountPaid: amountNum,
        remainingDebt: newUsed,
        provider: repayProvider.toUpperCase(),
        creditRestored: amountNum
      };

      setRepaySuccessReceipt(receipt);
      toast.success(`🎉 Malipo ya TZS ${amountNum.toLocaleString()} yamepokelewa! Salio lako la PapoCredit limeongezeka.`);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-[#0f111a] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative px-5 py-5 sm:px-8 sm:py-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shrink-0 overflow-hidden">
          {/* Subtle Ambient BG Effect */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-inner">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    PapoCredit
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-950/40 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      ONE CREDIT • ALL SERVICES
                    </span>
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-0.5 max-w-lg leading-snug">
                  Tumia Sasa, Lipa Baadaye kwa huduma zote za Papo Hapo Super App — Safari, Dawa za Dharura, Chakula, na Mafundi!
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Funga"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Highlights */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-white/15 text-white">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Kikomo Chako</span>
              <p className="text-base sm:text-lg font-black tracking-tight mt-0.5">TZS {creditLimit.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Salio Linalopatikana</span>
              <p className="text-base sm:text-lg font-black tracking-tight mt-0.5 text-emerald-200">TZS {availableCredit.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Deni Lililopo</span>
              <p className="text-base sm:text-lg font-black tracking-tight mt-0.5 text-amber-200">TZS {usedCredit.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Alama za Mkopo</span>
              <p className="text-base sm:text-lg font-black tracking-tight mt-0.5 text-white flex items-center gap-1.5">
                <span>{creditScore}/850</span>
                <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded font-bold">PRIME</span>
              </p>
            </div>
          </div>
        </div>

        {/* Primary Tabs Navigation */}
        <div className="px-5 sm:px-8 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#141724] flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('pillars')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'pillars'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Vipengele 5 Muhimu
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'services'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            One Credit kwa Huduma Zote
          </button>

          <button
            onClick={() => setActiveTab('lenders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'lenders'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Jukwaa la Wakopeshaji (P2P)
          </button>

          <button
            onClick={() => setActiveTab('business_model')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'business_model'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Muundo wa Biashara
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">

          {/* TAB 1: THE 5 CORE PILLARS */}
          {activeTab === 'pillars' && (
            <div className="space-y-6">
              {/* Pillars Mini Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'score', label: '1. Credit Score', icon: Award, desc: 'Pima uwezo na historia' },
                  { id: 'flex', label: '2. PapoFlex', icon: Calendar, desc: 'Chagua muda wa kulipa' },
                  { id: 'guarantor', label: '3. PapoGuarantor', icon: ShieldCheck, desc: 'NIDA, Saini & Mdhamini' },
                  { id: 'repay', label: '4. PapoRepay', icon: RefreshCw, desc: 'Lipa deni kielektroniki' },
                  { id: 'protect', label: '5. PapoProtect', icon: Lock, desc: 'Ulinzi wa udanganyifu' },
                ].map((p) => {
                  const Icon = p.icon;
                  const isActive = activePillar === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePillar(p.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#141724]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'}`} />
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">{p.label}</p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5 truncate">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* PILLAR 1: PAPOCREDIT SCORE */}
              {activePillar === 'score' && (
                <div className="bg-white dark:bg-[#141724] p-5 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Visual Gauge */}
                    <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          className="stroke-neutral-200 dark:stroke-neutral-800"
                          strokeWidth="10"
                          fill="transparent"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          className="stroke-emerald-500 transition-all duration-1000 ease-out"
                          strokeWidth="10"
                          strokeDasharray={314}
                          strokeDashoffset={314 - (314 * (creditScore / 850))}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-black text-neutral-900 dark:text-white">{creditScore}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          Uaminifu Bora
                        </span>
                        <span className="text-[9px] text-neutral-400">Kati ya 850</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                          Mfumo wa AI wa Kupima Uwezo & Historia (PapoCredit Score)
                        </h3>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          Alama zako hupimwa kiotomatiki kwa kuchanganua rekodi za safari, ununuzi wa vyakula na dawa, uthibitisho wa namba ya simu ya muda mrefu (M-Pesa/Tigo Pesa), na ulipaji kwa wakati.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="text-xs">
                            <strong className="text-neutral-900 dark:text-white block font-black">Ulipaji kwa Wakati (100%)</strong>
                            <span className="text-[10px] text-neutral-500">Miamala yote 8 iliyopita imelipwa bila kuchelewa</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="text-xs">
                            <strong className="text-neutral-900 dark:text-white block font-black">Miaka ya Namba ya Simu</strong>
                            <span className="text-[10px] text-neutral-500">Miaka 6+ ya matumizi thabiti ya pesa mtandao</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="text-xs">
                            <strong className="text-neutral-900 dark:text-white block font-black">Uthibitisho wa NIDA</strong>
                            <span className="text-[10px] text-neutral-500">Kitambulisho cha Taifa kimehakikiwa kielektroniki</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="text-xs">
                            <strong className="text-neutral-900 dark:text-white block font-black">Dhamana ya SACCOS/Mwajiri</strong>
                            <span className="text-[10px] text-neutral-500">Akaunti imeunganishwa na mfumo wa dhamana</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PILLAR 2: PAPOFLEX */}
              {activePillar === 'flex' && (
                <div className="bg-white dark:bg-[#141724] p-5 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                      PapoFlex: Kuchagua Muda wa Kulipa Kulingana na Uwezo Wako
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Mteja anachagua muda anaotaka kulipa kulingana na muundo uliowekwa na Papo Hapo Super App.
                    </p>
                  </div>

                  {/* Flexible Terms Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      { id: '7days', name: 'Siku 7 (Wiki 1)', fee: '0% RIBA', badge: 'BURE KABISA', desc: 'Lipa ndani ya siku 7 bila ada yoyote ya ziada!' },
                      { id: '14days', name: 'Siku 14 (Wiki 2)', fee: '1.5% Ada', badge: 'UNYUMBULIFU', desc: 'Muda wa wastani kwa mahitaji ya katikati ya mwezi.' },
                      { id: '30days', name: 'Siku 30 (Mwezi 1)', fee: '3.0% Ada', badge: 'MAHITAJI MAKUBWA', desc: 'Kwa ununuzi mkubwa wa duka, matengenezo au safari za mikoani.' },
                      { id: 'salary', name: 'Siku ya Mshahara', fee: 'Makato ya Moja kwa Moja', badge: 'CORPORATE / WAFANYAKAZI', desc: 'Inakatwa moja kwa moja tarehe 25-30 ya mwezi.' },
                    ].map((term) => (
                      <div
                        key={term.id}
                        onClick={() => setSelectedTerm(term.id as any)}
                        className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          selectedTerm === term.id
                            ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/30'
                            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                        }`}
                      >
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            {term.badge}
                          </span>
                          <h4 className="text-sm font-black text-neutral-900 dark:text-white mt-2">{term.name}</h4>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{term.fee}</p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">{term.desc}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-bold">
                          <span>Chagua Huu</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedTerm === term.id ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300'}`}>
                            {selectedTerm === term.id && <Check className="w-2.5 h-2.5" />}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Loan Repayment Calculator */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                        Kikokotoo cha Marejesho (PapoFlex Calculator)
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Kiasi: TZS {calculatorAmount.toLocaleString()}
                      </span>
                    </div>

                    <input 
                      type="range"
                      min={5000}
                      max={150000}
                      step={5000}
                      value={calculatorAmount}
                      onChange={(e) => setCalculatorAmount(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-neutral-200 dark:border-neutral-700">
                      <div>
                        <span className="text-[10px] text-neutral-500 block uppercase">Kiasi Ulichokopa:</span>
                        <strong className="text-neutral-900 dark:text-white">TZS {calculatorAmount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block uppercase">Ada ya PapoFlex:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {selectedTerm === '7days' ? 'TZS 0 (0% Bure)' : selectedTerm === '14days' ? `TZS ${(calculatorAmount * 0.015).toLocaleString()} (1.5%)` : `TZS ${(calculatorAmount * 0.03).toLocaleString()} (3%)`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block uppercase">Jumla ya Kulipa:</span>
                        <strong className="text-neutral-900 dark:text-white">
                          TZS {(calculatorAmount + (selectedTerm === '7days' ? 0 : selectedTerm === '14days' ? calculatorAmount * 0.015 : calculatorAmount * 0.03)).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block uppercase">Muda Uliochagua:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 uppercase">{selectedTerm}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PILLAR 3: PAPOGUARANTOR & DIGITAL KYC SIGNATURE */}
              {activePillar === 'guarantor' && (
                <div className="bg-white dark:bg-[#141724] p-5 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                      PapoGuarantor: Dhamana ya Kampuni/Mtu, NIDA, Live Selfie na Saini Mtandaoni
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Uthibitisho wa NIDA, namba ya simu ya miaka mingi (M-Pesa/Tigo Pesa), picha halisi ya uso (*live selfie*), kujaza fomu mtandaoni, na saini ya kidijitali juu ya kioo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Form: Details */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block mb-1">
                          Namba ya Kitambulisho cha Taifa (NIDA)
                        </label>
                        <input
                          type="text"
                          value={nidaNumber}
                          onChange={(e) => setNidaNumber(e.target.value)}
                          placeholder="Mfano: 19920412-11104-00001-24"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0f111a] text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-black uppercase text-neutral-600 dark:text-neutral-400 block mb-1">
                            Mtandao wa Pesa
                          </label>
                          <select
                            value={phoneOperator}
                            onChange={(e) => setPhoneOperator(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0f111a] text-xs font-bold"
                          >
                            <option value="vodacom">M-Pesa (Vodacom)</option>
                            <option value="tigo">Tigo Pesa (Tigo)</option>
                            <option value="airtel">Airtel Money</option>
                            <option value="halotel">HaloPesa</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-black uppercase text-neutral-600 dark:text-neutral-400 block mb-1">
                            Miaka ya Namba Hii
                          </label>
                          <select
                            value={phoneYears}
                            onChange={(e) => setPhoneYears(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0f111a] text-xs font-bold"
                          >
                            <option value="1">Mwaka 1 au chini</option>
                            <option value="3">Miaka 2 - 3</option>
                            <option value="6">Miaka 4 - 6 (Uaminifu Mkubwa)</option>
                            <option value="10">Zaidi ya Miaka 7 (Prime Score)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block mb-1">
                          Aina ya Mdhamini (Guarantor Option)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'company', label: 'Kampuni/Mwajiri', icon: Building2 },
                            { id: 'saccos', label: 'SACCOS/Chama', icon: Briefcase },
                            { id: 'individual', label: 'Mtu Binafsi', icon: Users },
                          ].map((g) => {
                            const Icon = g.icon;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => setGuarantorType(g.id as any)}
                                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                                  guarantorType === g.id
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span className="text-[10px] leading-tight">{g.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase text-neutral-600 dark:text-neutral-400 block mb-1">
                          Jina la Mdhamini / Taasisi
                        </label>
                        <input
                          type="text"
                          value={guarantorName}
                          onChange={(e) => setGuarantorName(e.target.value)}
                          placeholder="Jina kamili la mwajiri au mdhamini"
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0f111a] text-xs font-bold"
                        />
                      </div>
                    </div>

                    {/* Right: Live Selfie & Digital Signature Canvas */}
                    <div className="space-y-4">
                      {/* Live Selfie Capture */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block mb-1 flex items-center justify-between">
                          <span>Live Picture (Uhakiki wa Uso Halisi)</span>
                          {selfieCaptured && <span className="text-[10px] text-emerald-500 font-bold">✅ Imethibitishwa</span>}
                        </label>
                        <div className="p-3 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 flex items-center gap-3">
                          {selfieCaptured ? (
                            <img src={selfieCaptured} alt="Selfie" className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-400">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-xs font-bold text-neutral-900 dark:text-white">Picha ya Uthibitisho (Anti-Fraud)</p>
                            <p className="text-[10px] text-neutral-500">Piga selfie kwa sekunde 1 kuondoa utapeli</p>
                            <button
                              type="button"
                              onClick={handleTakeSelfie}
                              disabled={isCapturingSelfie}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {isCapturingSelfie ? 'Inapiga Picha...' : selfieCaptured ? 'Piga Tena' : 'Piga Selfie Sasa'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* HTML5 Digital Signature Pad */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                            <PenTool className="w-3.5 h-3.5 text-emerald-500" />
                            Saini Hapa Juu ya Kioo (Digital Signature)
                          </label>
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 underline cursor-pointer"
                          >
                            Futa Saini
                          </button>
                        </div>
                        <div className="relative border-2 border-dashed border-emerald-500/40 rounded-2xl bg-white dark:bg-[#0f111a] overflow-hidden shadow-inner">
                          <canvas
                            ref={canvasRef}
                            width={360}
                            height={110}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-[110px] cursor-crosshair touch-none"
                          />
                          {!hasSignature && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-400 text-xs italic">
                              ✍️ Weka saini yako hapa kwa kidole au mouse
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!hasSignature) {
                            toast.error("Tafadhali weka saini yako juu ya kioo ili kuthibitisha mkataba.");
                            return;
                          }
                          setKycSubmitted(true);
                          toast.success("✅ Fomu ya PapoGuarantor, NIDA na Saini zimethibitishwa!");
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Thibitisha Fomu na Saini ya Mkopo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PILLAR 4: PAPOREPAY */}
              {activePillar === 'repay' && (
                <div className="bg-white dark:bg-[#141724] p-5 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                      PapoRepay: Kulipa Deni kwa Njia Mbalimbali za Kidijitali
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Lipa deni la safari, chakula au dawa kwa M-Pesa, Tigo Pesa, Airtel Money, au PapoPay Wallet kwa urahisi.
                    </p>
                  </div>

                  {repaySuccessReceipt ? (
                    <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
                        <Check className="w-8 h-8 stroke-[3]" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase text-emerald-800 dark:text-emerald-300">
                          Risiti ya Malipo ya PapoRepay
                        </h4>
                        <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                          Namba ya Muamala: {repaySuccessReceipt.txId} • {repaySuccessReceipt.date}
                        </p>
                      </div>

                      <div className="max-w-md mx-auto p-4 rounded-2xl bg-white dark:bg-[#0f111a] border border-neutral-200 dark:border-neutral-800 text-xs space-y-2 text-left font-mono">
                        <div className="flex justify-between">
                          <span>Kiasi Kilicholipwa:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">TZS {repaySuccessReceipt.amountPaid.toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Njia Iliyotumika:</span>
                          <strong>{repaySuccessReceipt.provider} PUSH</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Deni Lililobaki:</span>
                          <strong>TZS {repaySuccessReceipt.remainingDebt.toLocaleString()}</strong>
                        </div>
                        <div className="flex justify-between border-t pt-2 border-dashed">
                          <span>Salio Lililorejeshwa:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">+TZS {repaySuccessReceipt.creditRestored.toLocaleString()}</strong>
                        </div>
                      </div>

                      <button
                        onClick={() => setRepaySuccessReceipt(null)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider"
                      >
                        Fanya Malipo Mengine
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Deni Lililopo Sasa</span>
                          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">TZS {usedCredit.toLocaleString()}</p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">Tarehe ya Mwisho wa Kulipa: 15 Novemba 2026 (Zimebaki Siku 10)</p>
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block mb-1">
                            Kiasi Unachotaka Kulipa (TZS)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={repayAmount}
                              onChange={(e) => setRepayAmount(e.target.value)}
                              className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0f111a] text-sm font-black text-neutral-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setRepayAmount(usedCredit.toString())}
                              className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-black uppercase tracking-wider"
                            >
                              Lipa Yote
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block mb-1">
                            Chagua Njia ya Malipo
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'mpesa', name: 'M-Pesa Lipa', color: 'text-red-500' },
                              { id: 'tigopesa', name: 'Tigo Pesa', color: 'text-blue-500' },
                              { id: 'airtel', name: 'Airtel Money', color: 'text-red-600' },
                              { id: 'papopay', name: 'PapoPay Wallet', color: 'text-emerald-500' },
                            ].map((prov) => (
                              <button
                                key={prov.id}
                                type="button"
                                onClick={() => setRepayProvider(prov.id as any)}
                                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                                  repayProvider === prov.id
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                <span className={prov.color}>{prov.name}</span>
                                {repayProvider === prov.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleMakeRepayment}
                          disabled={isProcessingRepay || usedCredit <= 0}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${isProcessingRepay ? 'animate-spin' : ''}`} />
                          {isProcessingRepay ? 'Inatuma Ombi la Malipo Simuni...' : `Lipa TZS ${parseInt(repayAmount || '0').toLocaleString()} Sasa`}
                        </button>
                      </div>

                      {/* Repayment History preview */}
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-800 space-y-3">
                        <span className="text-xs font-black uppercase text-neutral-800 dark:text-neutral-200 block">
                          Historia ya Safari & Oda Zilizokopwa
                        </span>
                        <div className="space-y-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0f111a] border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                            <div>
                              <strong className="block text-neutral-900 dark:text-white font-bold">PapoPharmacy (Dawa za Dharura)</strong>
                              <span className="text-[10px] text-neutral-400">Jana Saa 23:40 • Sinza Mori</span>
                            </div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">TZS 32,000</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0f111a] border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                            <div>
                              <strong className="block text-neutral-900 dark:text-white font-bold">PapoRide (Teksi toka Posta)</strong>
                              <span className="text-[10px] text-neutral-400">Tarehe 02 Nov • Safari #8491</span>
                            </div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">TZS 14,000</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0f111a] border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                            <div>
                              <strong className="block text-neutral-900 dark:text-white font-bold">PapoFood (Kuku Choma & Chips)</strong>
                              <span className="text-[10px] text-neutral-400">Tarehe 01 Nov • Mlimani City</span>
                            </div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">TZS 9,000</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PILLAR 5: PAPOPROTECT */}
              {activePillar === 'protect' && (
                <div className="bg-white dark:bg-[#141724] p-5 sm:p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                      PapoProtect: Kuzuia Matumizi ya Udanganyifu na Mikopo Hatarishi
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      Ulinzi wa hali ya juu wa AI dhidi ya wizi wa utambulisho, miamala ya mashaka na simu zilizopotea.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black uppercase text-neutral-900 dark:text-white">Device Binding Security</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        Akaunti yako ya PapoCredit imefungwa kwenye simu yako halisi pekee. Hakuna mtu anayeweza kuingia na kukopa kutoka kifaa kigeni bila idhini ya NIDA na OTP.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black uppercase text-neutral-900 dark:text-white">AI Behavioral Fraud Detection</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        AI inachunguza mienendo ya kawaida ya maeneo unayosafiri na kuagiza. Ikiwa kuna agizo lisilo la kawaida, mfumo unazuia kiotomatiki na kutuma onyo.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black uppercase text-neutral-900 dark:text-white">256-Bit Bank-Grade Encryption</h4>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        Data zote za mikopo, rekodi za malipo, na saini za kielektroniki zinalindwa kwa viwango vikali zaidi vya usalama wa kibenki.
                      </p>
                    </div>
                  </div>

                  {/* Emergency Freeze Action */}
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <strong className="text-xs font-black text-red-700 dark:text-red-300 block uppercase">
                          Kufunga Akaunti ya Dharura (Emergency Fraud Freeze)
                        </strong>
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                          {isAccountFrozen ? 'Akaunti yako imefungwa kwa dharura. Hakuna mikopo inayoweza kufanyika.' : 'Simu yako ikiibiwa au ukiona kitu cha kutilia shaka, funga mikopo ya PapoCredit mara moja.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsAccountFrozen(!isAccountFrozen);
                        toast.info(!isAccountFrozen ? "🚨 Akaunti ya PapoCredit imefungwa kwa dharura!" : "✅ Akaunti ya PapoCredit imefunguliwa salama.");
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                        isAccountFrozen ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isAccountFrozen ? 'Fungua Akaunti' : 'Funga Sasa'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ONE CREDIT FOR ALL SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                  Kikomo Kimoja cha Mkopo Kinachotumika Kwenye Huduma Zote (One Credit. All Services)
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Huhitaji kuomba mkopo kila mara unapotaka huduma tofauti. Salio lako la <strong>TZS {availableCredit.toLocaleString()}</strong> linagawanyika popote pale unapohitaji mara moja!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { title: 'PapoRide & Daladala', icon: '🚗', badge: 'SAFARI SASA, LIPA BAADAYE', desc: 'Teksi, bajaji au bodaboda usiku au katikati ya mwezi bila kuwa na pesa mkononi. Dereva analipwa papo hapo.' },
                  { title: 'PapoPharmacy (Duka la Dawa)', icon: '💊', badge: 'TIBIWA SASA, LIPA BAADAYE', desc: 'Dawa za dharura za usiku kwa mtoto au familia. Hakuna kucheleweshwa kwa matibabu kwa sababu ya salio.' },
                  { title: 'PapoFood & Migahawa', icon: '🍔', badge: 'KULA SASA, LIPA BAADAYE', desc: 'Chakula cha familia au mlo wa ofisini siku chache kabla ya mshahara. Agiza mgahawa wowote wa jirani.' },
                  { title: 'PapoFix (Mafundi & Gereji)', icon: '🔧', badge: 'TENGENEZA SASA, LIPA BAADAYE', desc: 'Gari limeharibika njiani, bomba limepasuka nyumbani au shoti ya umeme. Fundi anakuja na kutatua mara moja.' },
                  { title: 'PapoBus & PapoTicket', icon: '🚌', badge: 'SAFIRI SASA, LIPA BAADAYE', desc: 'Tiketi za mabasi ya mikoani au mechi za matukio makubwa. Safiri leo na ulipe mwisho wa mwezi.' },
                  { title: 'PapoPrint & Stationery', icon: '🖨️', badge: 'CHAPISHA SASA, LIPA BAADAYE', desc: 'Uchapishaji wa dharura wa mikataba, ripoti za ofisi au vipeperushi vya biashara bila kusubiri.' },
                ].map((s, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-[#141724] border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{s.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {s.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase">{s.title}</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">{s.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Inakubali PapoCredit</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: P2P LENDERS & INSTITUTIONAL FINANCING MARKETPLACE */}
          {activeTab === 'lenders' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                  Jukwaa la Kuunganisha Wakopaji na Wakopeshaji (P2P & Institutional Liquidity)
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Mabenki, taasisi za Microfinance (MFIs), SACCOS, na wawekezaji binafsi wanaweka mitaji ili kufadhili mikopo ya PapoCredit kwa usalama wa 100% wa dhamana na AI risk management.
                </p>
              </div>

              {/* Lenders Live Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Jumla ya Mtaji Uliopo</span>
                  <p className="text-lg font-black text-neutral-900 dark:text-white mt-0.5">TZS 1.2B+</p>
                  <span className="text-[9px] text-emerald-500 font-bold">Taasisi 8 & Wawekezaji 140</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Kiwango cha Marejesho</span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">98.6%</p>
                  <span className="text-[9px] text-neutral-400">Default rate ndogo ya 1.4%</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Faida ya Mkopeshaji (ROI)</span>
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">14% - 18%</p>
                  <span className="text-[9px] text-neutral-400">Faida ya Mwaka (Annualized Yield)</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Bima ya Mikopo</span>
                  <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">PapoProtect</p>
                  <span className="text-[9px] text-purple-400 font-bold">Mitaji imelindwa na bima</span>
                </div>
              </div>

              {/* Partner Onboarding Callout */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase text-white">Je, Wewe ni Benki, SACCOS au Mwekezaji?</h4>
                    <p className="text-xs text-neutral-300 mt-0.5">
                      Wekeza mtaji wako kwenye mfumo wa mikopo ya usafiri na bidhaa za kila siku wa PapoCredit na upate gawio la faida kila mwisho wa mwezi.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toast.success("📧 Ombi la Ushirikiano wa Kibenki/Mwekezaji limetumwa kwa timu ya PapoCapital!")}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-lg active:scale-95"
                >
                  Jiunge kama Mkopeshaji
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BUSINESS MODEL & 5 REVENUE STREAMS */}
          {activeTab === 'business_model' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-white">
                  Muundo wa Biashara na Vyanzo 5 vya Mapato (Business Model)
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Mkakati endelevu wa kibiashara unaozalisha faida kwa Papo Hapo na watoa huduma wote:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {[
                  {
                    title: '1. Service Commission',
                    badge: 'MAPATO YA KILA SIKU',
                    desc: 'Ada ndogo (10% - 15%) inayokatwa kutoka kwenye kila safari ya usafiri, oda ya mgahawa, duka la dawa, na huduma ya mafundi inapokamilika kupitia PapoCredit.',
                    metric: 'TZS 2,500 - 8,000 kwa oda'
                  },
                  {
                    title: '2. PapoCredit Partnership',
                    badge: 'MAPATO YA MITAJI & MABENKI',
                    desc: 'Ushirikiano na benki na taasisi za kifedha ambapo Papo Hapo inachukua asilimia ya ada ya uchakataji (origination fee) na gawio la riba ya mikopo.',
                    metric: '2.5% - 4.5% kwa mzunguko'
                  },
                  {
                    title: '3. Vendor Subscription',
                    badge: 'VIFURUSHI VYA WAFANYABIASHARA',
                    desc: 'Maduka ya dawa, gereji na migahawa yanalipia ada ya kila mwezi ili kuwezeshwa kupokea wateja wa PapoCredit wanaolipa kwa mkopo bila hatari.',
                    metric: 'TZS 35,000 - 100,000 / mwezi'
                  },
                  {
                    title: '4. Corporate Plans',
                    badge: 'B2B & WAFANYAKAZI WA MAKAMPUNI',
                    desc: 'Makampuni yanasajili wafanyakazi wao kwenye mfumo maalum wa kupata safari za kazi na milo ya mchana kwa ankara ya pamoja ya mwisho wa mwezi.',
                    metric: 'TZS 250,000 - 2,500,000 / kampuni'
                  },
                  {
                    title: '5. PapoPremium',
                    badge: 'VIFURUSHI VYA WATEJA VIP',
                    desc: 'Wateja binafsi wanaojiunga na kifurushi cha VIP kwa kupata vikomo vya juu vya mikopo (hadi TZS 1,000,000), ada 0% kwa siku 14, na kipaumbele cha huduma.',
                    metric: 'TZS 10,000 / mwezi'
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-[#141724] border border-neutral-200 dark:border-neutral-800 space-y-2 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase mt-2">{item.title}</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">{item.desc}</p>
                    </div>

                    <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800 text-[11px] font-mono font-bold text-neutral-900 dark:text-white flex items-center justify-between">
                      <span className="text-neutral-400">Mapato Yanayokadiriwa:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{item.metric}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-8 sm:py-4 bg-neutral-50 dark:bg-[#141724] border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>PapoCredit inalindwa kisheria na kusimamiwa na kanuni za BOT & Bima ya PapoProtect</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Funga
            </button>
            <button
              onClick={() => {
                setActiveTab('pillars');
                setActivePillar('flex');
              }}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Tumia PapoCredit Sasa
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
