import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck,
  Camera, RefreshCw, Sparkles, Volume2, VolumeX,
  Phone, User, Check, Lock, Upload
} from 'lucide-react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { BiometricFaceCanvas, FaceTrackResult } from './BiometricFaceCanvas';
import { toast } from 'sonner';
import {
  captureMultiFrameFaceEnrollment,
  ensureFaceModelsLoaded,
  extractFaceBiometrics,
  matchFaceDescriptor,
  normalizeTzPhone
} from '../../lib/faceBiometrics';
import {
  loadRegisteredFaceCustomers,
  RegisteredFaceCustomer,
  saveEnrolledFaceCustomer
} from '../../lib/faceRegistry';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (registeredData: {
    name: string;
    phone: string;
    embeddingId: string;
    photoUrl?: string;
    faceDescriptor?: number[];
    pin?: string;
    customer?: RegisteredFaceCustomer;
  }) => void;
  initialName?: string;
  initialPhone?: string;
  uid?: string;
  setAsCurrentDeviceProfile?: boolean;
}

type Step = 'info_form' | 'camera_capture' | 'analyzing_mesh' | 'completed';

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  initialPhone = '',
  uid,
  setAsCurrentDeviceProfile = true
}) => {
  const [step, setStep] = useState<Step>('info_form');
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [pin, setPin] = useState('1234');
  const [dailyLimit, setDailyLimit] = useState<number>(250000);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [embeddingId, setEmbeddingId] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isFaceReady, setIsFaceReady] = useState(false);
  const [liveConfidence, setLiveConfidence] = useState(0);
  const [liveLux, setLiveLux] = useState(85);
  const [liveDistance, setLiveDistance] = useState(45);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setCameraError(null);
    setCaptureError(null);
    setIsCameraReady(false);
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsCameraReady(true);
      }
    } catch (err) {
      console.warn('Camera unavailable during face registration:', err);
      setCameraError('Kamera haikuweza kufunguka. Unaweza kupakia picha ya uso wako hapa chini.');
      setIsCameraReady(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraReady(false);
  };

  useEffect(() => {
    if (isOpen) {
      setStep('info_form');
      setAnalysisProgress(0);
      setCapturedPhoto(null);
      setCaptureError(null);
      setCameraError(null);
      setIsFaceReady(false);
      setFullName(initialName && initialName !== 'Mteja Mpya' ? initialName : '');
      setPhone(initialPhone && initialPhone !== '0755 000 111' ? initialPhone : '');
      setPin('1234');
      const generatedId = `EMB-TZ-${Math.floor(1000 + Math.random() * 9000)}-REG`;
      setEmbeddingId(generatedId);
      ensureFaceModelsLoaded().catch(() => {});
      speak('Karibu kwenye usajili wa uso wa PapoPay. Jaza taarifa zako kisha upige picha ya uso.');
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialName, initialPhone]);

  const handleFaceTracked = (info: FaceTrackResult) => {
    setIsFaceReady(info.detected);
    setLiveConfidence(info.confidence);
    setLiveLux(info.brightness);
    setLiveDistance(info.distanceCm);
  };

  const handleProceedToCamera = () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error('Tafadhali weka jina lako kamili!');
      return;
    }
    const normPhone = normalizeTzPhone(phone);
    if (!normPhone || normPhone.length < 9) {
      toast.error('Tafadhali weka namba sahihi ya simu (mfano: 0754 123 456)!');
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      toast.error('Tafadhali weka PIN ya tarakimu 4 (mfano: 4829) kwa ajili ya kutoa pesa!');
      return;
    }
    setStep('camera_capture');
    startCamera();
    speak('Weka uso wako katikati ya mduara kisha bofya kitufe cha kunasa uso.');
  };

  const finalizeBiometricEnrollment = async (
    descriptor: number[],
    photoUrl: string,
    confidence: number
  ) => {
    setCaptureError(null);
    setCapturedPhoto(photoUrl);
    setStep('analyzing_mesh');
    setAnalysisProgress(35);
    speak('Inachanganua alama 128 za uso na kuhifadhi kwenye mfumo salama wa PapoPay.');

    try {
      // Duplicate identity protection: verify this face is not already registered to a different phone number
      const existingCustomers = await loadRegisteredFaceCustomers();
      const myNormPhone = normalizeTzPhone(phone);
      const otherCustomers = existingCustomers.filter(
        (c) => c.normalizedPhone && c.normalizedPhone !== myNormPhone && c.isRegistered
      );

      setAnalysisProgress(65);
      const dupCheck = matchFaceDescriptor(descriptor, otherCustomers, 0.42);
      if (dupCheck.matched && dupCheck.candidate) {
        setStep('camera_capture');
        const msg = `Tahadhari: Uso huu tayari umesajiliwa na ${dupCheck.candidate.name} (${dupCheck.candidate.phone}). Kila uso una akaunti yake.`;
        setCaptureError(msg);
        toast.error(msg, { duration: 6000 });
        speak('Uso huu tayari umesajiliwa na mteja mwingine kwenye mfumo.');
        return;
      }

      setAnalysisProgress(85);
      const savedCustomer = await saveEnrolledFaceCustomer({
        uid,
        name: fullName.trim(),
        phone: phone.trim(),
        embeddingId,
        photoUrl,
        faceDescriptor: descriptor,
        dailyLimit,
        pin: pin.trim(),
        setAsCurrentDeviceProfile
      });

      setAnalysisProgress(100);
      stopCamera();
      setStep('completed');
      playPaymentChime();
      triggerHapticTap();

      speak(`Hongera ${fullName.trim().split(' ')[0]}! Uso wako umesajiliwa kikamilifu kwa utambuzi wa asilimia ${Math.round(confidence)}.`);
      toast.success(`Uso wa ${fullName.trim()} umesajiliwa kikamilifu!`, {
        description: `Namba: ${phone.trim()} | Alama 128D zimehifadhiwa.`,
        icon: '🎉'
      });

      setTimeout(() => {
        onSuccess({
          name: fullName.trim(),
          phone: phone.trim(),
          embeddingId,
          photoUrl,
          faceDescriptor: descriptor,
          pin: pin.trim(),
          customer: savedCustomer
        });
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Face enrollment error:', err);
      setStep('camera_capture');
      setCaptureError('Hitilafu imetokea wakati wa kuhifadhi uso. Tafadhali jaribu tena.');
      toast.error('Imeshindwa kuhifadhi usajili wa uso. Jaribu tena.');
    }
  };

  const handleCaptureFace = async () => {
    setCaptureError(null);
    if (!videoRef.current || !isCameraReady || videoRef.current.readyState < 2) {
      setCaptureError('Kamera bado haijawa tayari au imezuiwa. Tumia kitufe cha Pakia Picha.');
      toast.error('Kamera haipo tayari. Pakia picha ya uso au wezesha kamera.');
      return;
    }

    setStep('analyzing_mesh');
    setAnalysisProgress(20);
    speak('Inapiga picha na kupima alama za uso...');

    const extraction = await captureMultiFrameFaceEnrollment(videoRef.current, 3, true);
    if (!extraction.ok) {
      setStep('camera_capture');
      setCaptureError(extraction.message);
      toast.error(extraction.message, { icon: '⚠️' });
      speak('Hakuna uso ulioonekana wazi. Tafadhali sogea karibu kwenye mwanga mzuri.');
      return;
    }

    await finalizeBiometricEnrollment(
      extraction.descriptor,
      extraction.photoUrl,
      extraction.confidence
    );
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCaptureError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      setStep('analyzing_mesh');
      setAnalysisProgress(25);
      const extraction = await extractFaceBiometrics(dataUrl, { mirrored: false, requireSingleFace: true });
      if (!extraction.ok) {
        setStep('camera_capture');
        setCaptureError(extraction.message);
        toast.error(extraction.message, { icon: '⚠️' });
        return;
      }

      await finalizeBiometricEnrollment(
        extraction.descriptor,
        extraction.photoUrl,
        extraction.confidence
      );
    };
    reader.readAsDataURL(file);
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
                  Biometric Vector ID 128-D &bull; PapoPay Wakala
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
              1. Taarifa &amp; PIN
            </span>
            <span>&bull;</span>
            <span className={step === 'camera_capture' ? 'text-cyan-400 font-bold' : step === 'analyzing_mesh' || step === 'completed' ? 'text-emerald-400' : ''}>
              2. Nasa Uso Halisi
            </span>
            <span>&bull;</span>
            <span className={step === 'completed' ? 'text-emerald-400 font-bold' : ''}>
              3. Imekamilika
            </span>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-4">
            {/* STEP 1: FORM */}
            {step === 'info_form' && (
              <div className="space-y-3.5">
                <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p>
                    Uso wako unasomwa na kutengenezewa <strong>alama fiche 128-D</strong> ili Wakala na Kiosk wamtambue muhusika sahihi pekee wakati wa kuweka au kutoa pesa.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      Jina Kamili (Full Name): *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="k.m. Baraka Juma Mrema"
                      className="w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-sm focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-neutral-300 block mb-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-cyan-400" />
                        Namba ya Simu: *
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0754 123 456"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-neutral-300 block mb-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        PIN ya Kutoa Pesa: *
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1234"
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-sm tracking-widest focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 block mb-1">
                      Kikomo cha Malipo ya Uso kwa Siku:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[100000, 250000, 500000].map((lim) => (
                        <button
                          key={lim}
                          type="button"
                          onClick={() => setDailyLimit(lim)}
                          className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                            dailyLimit === lim
                              ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-xs'
                              : 'bg-white/5 border-white/5 text-neutral-400'
                          }`}
                        >
                          TZS {lim >= 1000000 ? `${lim / 1000000}M` : `${lim / 1000}k`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToCamera}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all mt-2 cursor-pointer"
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

                  <BiometricFaceCanvas
                    videoRef={videoRef}
                    onFaceTracked={handleFaceTracked}
                    phase="align_center"
                    isUnregistered={false}
                    hudMode="mesh"
                    faceConfidence={liveConfidence}
                    lightingQuality={liveLux}
                    distanceCm={liveDistance}
                  />

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="w-52 h-52 rounded-full border-2 border-dashed border-cyan-400/50"
                    />
                    <span className={`absolute bottom-3 text-[9px] font-mono px-2.5 py-0.5 rounded-full border ${
                      isFaceReady
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400/40'
                        : 'bg-black/80 text-cyan-300 border-cyan-500/30'
                    }`}>
                      {isFaceReady ? 'USO TAYARI ✓ • 128-D VECTOR' : 'WEKA USO KATIKATI'}
                    </span>
                  </div>
                </div>

                {(captureError || cameraError) && (
                  <div className="w-full p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{captureError || cameraError}</span>
                  </div>
                )}

                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-white">
                    {isFaceReady ? 'Uso Umeonekana Vizuri — Bofya Nasa!' : 'Weka Uso Wako Katikati ya Mduara'}
                  </p>
                  <p className="text-xs text-neutral-400">
                    Mfumo utakusanya picha 3 za uhakika na kuunda alama fiche za kukutambua kwa Wakala.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCaptureFace}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nasa Uso &amp; Sajili (Capture 128-D)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Au Pakia Picha ya Uso (Upload Photo)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadPhoto}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: ANALYZING MESH */}
            {step === 'analyzing_mesh' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative w-24 h-24 rounded-3xl bg-cyan-500/10 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 overflow-hidden">
                  {capturedPhoto ? (
                    <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover opacity-70" />
                  ) : (
                    <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                  )}
                  <Sparkles className="w-5 h-5 text-amber-300 absolute top-2 right-2 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-white">
                    Inachanganua Alama 128-D za Uso...
                  </h4>
                  <p className="text-xs text-neutral-400 font-mono">
                    Vector ID: {embeddingId}
                  </p>
                </div>

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
                    {fullName} &bull; {phone}
                  </p>
                  <p className="text-xs text-neutral-400 max-w-xs mt-2">
                    Sasa Wakala akiskani sura yako atakutambua moja kwa moja kwa kuweka na kutoa pesa!
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
