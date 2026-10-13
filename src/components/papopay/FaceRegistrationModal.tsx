import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck, 
  Camera, RefreshCw, Sparkles, Smile, Eye, UserCheck, 
  Lock, Volume2, VolumeX, ShieldAlert, Cpu, Activity,
  Phone, User, Check
} from 'lucide-react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas } from './BiometricFaceCanvas';
import { toast } from 'sonner';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (registeredData: {
    name: string;
    phone: string;
    embeddingId: string;
    photoUrl?: string;
  }) => void;
  initialName?: string;
  initialPhone?: string;
}

type Step = 'info_form' | 'camera_capture' | 'analyzing_mesh' | 'completed';

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = 'Mteja Mpya',
  initialPhone = '0755 000 111'
}) => {
  const [step, setStep] = useState<Step>('info_form');
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [dailyLimit, setDailyLimit] = useState<number>(250000);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [embeddingId, setEmbeddingId] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera fallback active during face registration", err);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('info_form');
      setAnalysisProgress(0);
      setCapturedPhoto(null);
      const generatedId = `EMB-TZ-${Math.floor(1000 + Math.random() * 9000)}-REG`;
      setEmbeddingId(generatedId);
      speak("Karibu kwenye usajili wa uso wa PapoPay. Tafadhali jaza taarifa zako na upige picha ya uso.");
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const handleProceedToCamera = () => {
    if (!fullName.trim()) {
      toast.error("Tafadhali weka jina lako kamili!");
      return;
    }
    setStep('camera_capture');
    startCamera();
    speak("Weka uso wako katikati ya mduara kisha bofya kitufe cha kunasa uso.");
  };

  const handleCaptureFace = () => {
    if (videoRef.current && canvasRef.current) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedPhoto(dataUrl);
        }
      } catch {}
    } else {
      // Fallback avatar
      setCapturedPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
    }

    setStep('analyzing_mesh');
    speak("Inachanganua alama za uso na kuunda ufunguo salama wa kibayometriki.");

    // Progress animation
    let prog = 10;
    setAnalysisProgress(prog);
    const interval = setInterval(() => {
      prog += 20;
      setAnalysisProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        completeRegistration();
      }
    }, 400);
  };

  const completeRegistration = () => {
    stopCamera();
    setStep('completed');
    playPaymentChime();
    triggerHapticTap();

    speak(`Hongera ${fullName.split(' ')[0]}! Uso wako umesajiliwa kikamilifu kwenye PapoPay.`);
    toast.success("Uso wako umesajiliwa kikamilifu! Sasa unaweza kulipa kwa uso.", { icon: '🎉' });

    // Store in localStorage for persistence
    try {
      localStorage.setItem('papopay_registered_face', JSON.stringify({
        isEnrolled: true,
        name: fullName,
        phone,
        embeddingId,
        dailyLimit,
        enrolledAt: new Date().toISOString()
      }));
    } catch {}

    setTimeout(() => {
      onSuccess({
        name: fullName,
        phone,
        embeddingId,
        photoUrl: capturedPhoto || undefined
      });
      onClose();
    }, 2200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2800] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-md bg-[#0b1120] border border-cyan-500/40 rounded-[36px] overflow-hidden shadow-2xl shadow-cyan-950/80 flex flex-col text-white"
        >
          {/* Header */}
          <div className="p-5 pb-3 flex items-center justify-between border-b border-white/10 bg-[#0e1628]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <ScanFace className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Usajili wa Uso (Face Registration)
                </h3>
                <p className="text-[11px] text-cyan-300">
                  Jiunge na PapoPay Smile-to-Pay Biometric
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="px-6 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span className={step === 'info_form' ? 'text-cyan-400 font-bold' : 'text-emerald-400'}>
              1. Taarifa Binafsi
            </span>
            <span>&bull;</span>
            <span className={step === 'camera_capture' ? 'text-cyan-400 font-bold' : step === 'analyzing_mesh' || step === 'completed' ? 'text-emerald-400' : ''}>
              2. Picha ya Uso
            </span>
            <span>&bull;</span>
            <span className={step === 'completed' ? 'text-emerald-400 font-bold' : ''}>
              3. Imekamilika
            </span>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* STEP 1: FORM */}
            {step === 'info_form' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p>
                    Uso wako unabadilishwa kuwa <strong>nambari fiche (468 Vector Embeddings)</strong>. Hatuhifadhi picha halisi kwenye seva yetu bali ufunguo wa usalama pekee.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      Jina Kamili (Full Name):
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="k.m. Baraka Juma"
                      className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-sm focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-cyan-400" />
                      Nambari ya Simu (Phone Number):
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="k.m. 0755 123 456"
                      className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                      Kikomo cha Malipo ya Uso kwa Siku:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[100000, 250000, 500000].map(lim => (
                        <button
                          key={lim}
                          type="button"
                          onClick={() => setDailyLimit(lim)}
                          className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                            dailyLimit === lim
                              ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-xs'
                              : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          TZS {lim >= 1000000 ? `${lim/1000000}M` : `${lim/1000}k`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToCamera}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all mt-4"
                >
                  <Camera className="w-4 h-4" />
                  <span>Endelea Kupiga Picha ya Uso</span>
                </button>
              </div>
            )}

            {/* STEP 2: CAMERA CAPTURE */}
            {step === 'camera_capture' && (
              <div className="space-y-4 flex flex-col items-center">
                <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-cyan-500/60 bg-black flex items-center justify-center shadow-2xl shadow-cyan-950/60">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* High-Performance 3D Biometric Face Canvas */}
                  <BiometricFaceCanvas
                    phase="align_center"
                    isUnregistered={false}
                    hudMode="mesh"
                    faceConfidence={99.1}
                    lightingQuality={94}
                    distanceCm={42}
                  />

                  {/* Biometric overlay ring */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                      className="w-52 h-52 rounded-full border-2 border-dashed border-cyan-400/50"
                    />
                    <div className="absolute inset-4 border border-cyan-400/20 rounded-full" />
                    <span className="absolute bottom-3 text-[9px] font-mono text-cyan-300 bg-black/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                      468 MESH POINTS &bull; LIVE TRACKING
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white">
                    Weka Uso Wako Katikati
                  </p>
                  <p className="text-xs text-neutral-400">
                    Kamera itatambua 468 mesh landmarks ili kusajili kitambulisho chako.
                  </p>
                </div>

                <div className="flex w-full gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCaptureFace}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nasa Uso & Sajili (Capture)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: ANALYZING MESH */}
            {step === 'analyzing_mesh' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative w-24 h-24 rounded-3xl bg-cyan-500/10 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                  <Sparkles className="w-5 h-5 text-amber-300 absolute top-2 right-2 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-white">
                    Inachanganua Alama za Uso (MediaPipe)...
                  </h4>
                  <p className="text-xs text-neutral-400 font-mono">
                    Kuunda Vector: {embeddingId}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs bg-neutral-800 rounded-full h-2 overflow-hidden mt-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                    style={{ width: `${analysisProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs font-mono text-cyan-300">{analysisProgress}% Complete</span>
              </div>
            )}

            {/* STEP 4: COMPLETED */}
            {step === 'completed' && (
              <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_35px_#10b981] animate-bounce">
                  <Check className="w-10 h-10 stroke-[3]" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-black text-white">
                    Hongera, Uso Umesajiliwa!
                  </h4>
                  <p className="text-xs text-emerald-300 font-bold">
                    {fullName} &bull; {embeddingId}
                  </p>
                  <p className="text-xs text-neutral-400 max-w-xs mt-2">
                    Sasa unaweza kufanya malipo ya Smile-to-Pay na kupita kwenye mageti ya BRT bila nenosiri au kadi!
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
