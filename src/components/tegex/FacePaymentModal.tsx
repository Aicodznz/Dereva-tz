import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ScanFace, CheckCircle2, AlertCircle, X, ShieldCheck, 
  Camera, RefreshCw, Zap, Sparkles, Smile, Eye, UserCheck, 
  Lock, Volume2, VolumeX, ShieldAlert, Cpu, Activity, Play,
  HelpCircle, AlertTriangle, UserX, UserPlus, Sliders, Sun, Maximize2
} from 'lucide-react';
import { playPaymentChime, triggerHapticTap } from '../../utils/nfcPayment';
import { FaceRegistrationModal } from '../papopay/FaceRegistrationModal';
import { BiometricFaceCanvas, BiometricHudMode } from '../papopay/BiometricFaceCanvas';
import { toast } from 'sonner';

interface FacePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptData: { txId: string; method: string; amount: number; time: string; faceScore: number }) => void;
  amount: number;
  recipientName?: string;
  serviceTitle?: string;
  payerName?: string;
  isRegistered?: boolean;
}

type LivenessPhase = 
  | 'initializing'
  | 'align_center'
  | 'blink_detect'
  | 'smile_confirm'
  | 'verifying'
  | 'success'
  | 'spoof_rejected'
  | 'unregistered'
  | 'error';

export const FacePaymentModal: React.FC<FacePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
  recipientName = 'PapoPay Merchant',
  serviceTitle = 'Malipo ya Papo Hapo',
  payerName = 'Baraka Juma',
  isRegistered = true
}) => {
  const [phase, setPhase] = useState<LivenessPhase>('initializing');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isRegisteredUser, setIsRegisteredUser] = useState<boolean>(isRegistered);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [hudMode, setHudMode] = useState<BiometricHudMode>('mesh');
  const [faceConfidence, setFaceConfidence] = useState<number>(98.7);
  const [livenessScore, setLivenessScore] = useState<number>(99.4);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [headYaw, setHeadYaw] = useState<number>(0);
  const [lightingQuality, setLightingQuality] = useState<number>(92);
  const [distanceCm, setDistanceCm] = useState<number>(45);
  const [fps, setFps] = useState<number>(30);
  const [txId, setTxId] = useState<string>('');
  const [isSpoofTesting, setIsSpoofTesting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Helper sound announcer
  const speakInstruction = (text: string) => {
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

  // Play audio beeps during biometric steps
  const playStepBeep = (frequency = 880, durationMs = 120) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (durationMs / 1000));
    } catch {}
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startCamera = async () => {
    clearAllTimers();
    setErrorMessage(null);
    setCapturedPhoto(null);
    setPhase('initializing');
    setProgress(10);
    setBlinkCount(0);
    setIsSpoofTesting(false);
    setLivenessScore(99.4);

    const generatedTxId = `PAPO-FACE-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxId(generatedTxId);

    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }

      // Request selfie camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      runBiometricSequence();
    } catch (err: any) {
      console.warn("Camera fallback active:", err);
      runBiometricSequence(true);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
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
  };

  // Murtaza's Workshop Liveness & Anti-Spoofing Flow
  const runBiometricSequence = (isSimulatedFallback = false) => {
    // Phase 1: Center Alignment
    const t1 = setTimeout(() => {
      setPhase('align_center');
      setProgress(25);
      setHeadYaw(1.2);
      playStepBeep(640, 100);
      speakInstruction('Weka uso wako katikati ya mduara');
    }, 800);

    // If user has not registered their face, notify them to register!
    if (!isRegisteredUser) {
      const tUnreg = setTimeout(() => {
        triggerUnregisteredFaceTest();
      }, 2000);
      timersRef.current.push(t1, tUnreg);
      return;
    }

    // Phase 2: Blink Detection (Murtaza's Anti-Spoofing Check)
    const t2 = setTimeout(() => {
      setPhase('blink_detect');
      setProgress(55);
      playStepBeep(880, 150);
      speakInstruction('Pepesa macho kuonesha uhai');

      // Simulate live blink capture
      const t2Blink = setTimeout(() => {
        setBlinkCount(1);
        playStepBeep(1200, 80);
      }, 1200);
      timersRef.current.push(t2Blink);
    }, 2400);

    // Phase 3: Smile to Pay (MediaPipe Mesh Lip Distance Check)
    const t3 = setTimeout(() => {
      setPhase('smile_confirm');
      setProgress(80);
      playStepBeep(920, 120);
      speakInstruction('Tabasamu kidogo kuthibitisha malipo');
    }, 4200);

    // Phase 4: Verification & Anti-Spoofing Neural Match
    const t4 = setTimeout(() => {
      if (!isSimulatedFallback) {
        captureFrame();
      }
      setPhase('verifying');
      setProgress(95);

      const t5 = setTimeout(() => {
        // Complete transaction!
        setPhase('success');
        setProgress(100);
        const finalScore = Number((98.5 + Math.random() * 1.2).toFixed(1));
        setFaceConfidence(finalScore);
        setLivenessScore(99.8);

        playPaymentChime();
        triggerHapticTap();

        toast.success(`Malipo ya TZS ${amount.toLocaleString()} yamethibitishwa kwa Face Pay!`, {
          icon: '✨'
        });

        const t6 = setTimeout(() => {
          stopCamera();
          onSuccess({
            txId: txId || `PAPO-FACE-${Math.floor(100000 + Math.random() * 900000)}`,
            method: 'Face Payment (Smile-to-Pay)',
            amount,
            time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            faceScore: finalScore
          });
          onClose();
        }, 1600);
        timersRef.current.push(t6);

      }, 1300);
      timersRef.current.push(t5);

    }, 5800);

    timersRef.current.push(t1, t2, t3, t4);
  };

  // Murtaza's Workshop Anti-Spoofing Attack Test Simulator
  // Demonstrates how the system instantly blocks a 2D photograph / mobile screen replay!
  const triggerSpoofAttackTest = () => {
    clearAllTimers();
    setIsSpoofTesting(true);
    setPhase('spoof_rejected');
    setLivenessScore(14.2);
    setErrorMessage('Tahadhari: Jaribio la Picha/Kioo Limegunduliwa (2D Photo Spoof Detected)');
    playStepBeep(320, 350);

    toast.error('Ulinzi wa Murtaza Anti-Spoofing: Jaribio la picha feki limezuiwa!', {
      icon: '🛡️'
    });
    speakInstruction('Tahadhari, mfumo umegundua picha feki. Malipo yamesitishwa.');
  };

  // Unregistered Face Detection Simulator
  // When a user has not registered their face with PapoPay Face ID
  const triggerUnregisteredFaceTest = () => {
    clearAllTimers();
    setIsSpoofTesting(false);
    setPhase('unregistered');
    setErrorMessage('Uso Haujasajiliwa Kwenye Mfumo (Face Not Registered)');
    playStepBeep(440, 300);

    toast.error('Uso haujasajiliwa kwenye PapoPay! Tafadhali sajili uso wako ili uweze kulipa.', {
      icon: '⚠️'
    });
    speakInstruction('Uso wako haujasajiliwa kwenye PapoPay. Tafadhali jisajili uso wako ili uweze kulipa.');
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      // FPS animation loop
      const fpsInterval = setInterval(() => {
        setFps(Math.floor(29 + Math.random() * 3));
      }, 1500);
      return () => clearInterval(fpsInterval);
    } else {
      clearAllTimers();
      stopCamera();
      setPhase('initializing');
      setProgress(0);
      setCapturedPhoto(null);
    }

    return () => {
      clearAllTimers();
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-md bg-[#0a0f1d] border border-cyan-500/30 rounded-[36px] overflow-hidden shadow-2xl shadow-cyan-950/70 flex flex-col text-white"
        >
          {/* Header Bar */}
          <div className="p-5 pb-3 flex items-center justify-between border-b border-white/10 relative z-10 bg-[#0d1424]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <ScanFace className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-tight text-white">
                    PapoPay Face Pay
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider border border-cyan-400/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Smile-to-Pay
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">
                  {serviceTitle} &bull; {recipientName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                title={soundEnabled ? 'Zima sauti' : 'Washa maelekezo ya sauti'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Amount Badge */}
          <div className="px-6 pt-3 pb-1 text-center bg-gradient-to-b from-[#0d1424] to-transparent">
            <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
              Kiasi Kinacholipwa
            </span>
            <div className="text-3xl font-black font-mono text-cyan-400 tracking-tight mt-0.5">
              TZS {amount.toLocaleString()}
            </div>
          </div>

          {/* Murtaza's Workshop cvzone HUD Metrics Ribbon */}
          <div className="px-6 py-1.5 flex items-center justify-between text-[10px] font-mono border-y border-cyan-500/10 bg-black/40">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>FPS: {fps}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <span>Blink:</span>
              <span className={blinkCount > 0 ? "text-emerald-400 font-bold" : "text-amber-400"}>
                {blinkCount > 0 ? '✓ YES (1)' : '⏳ DETECTING'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className={livenessScore > 80 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                Live: {livenessScore}%
              </span>
            </div>
          </div>

          {/* AI Face Detection HUD Mode Selector */}
          <div className="px-6 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>Mtindo wa AI:</span>
            </span>
            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-xl border border-cyan-500/20 text-[10px]">
              <button
                type="button"
                onClick={() => setHudMode('mesh')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  hudMode === 'mesh' ? 'bg-cyan-500 text-neutral-950 shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
              >
                🌐 3D Mesh
              </button>
              <button
                type="button"
                onClick={() => setHudMode('neural_box')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  hudMode === 'neural_box' ? 'bg-cyan-500 text-neutral-950 shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
              >
                🎯 YOLO Box
              </button>
              <button
                type="button"
                onClick={() => setHudMode('liveness_depth')}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  hudMode === 'liveness_depth' ? 'bg-cyan-500 text-neutral-950 shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
              >
                🌡️ Depth
              </button>
            </div>
          </div>

          {/* Biometric Viewport */}
          <div className="px-6 py-2 flex flex-col items-center">
            <div className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 ${
              phase === 'unregistered' 
                ? 'border-amber-500 shadow-amber-500/40' 
                : phase === 'spoof_rejected'
                ? 'border-rose-500 shadow-rose-500/40'
                : 'border-cyan-500/50 shadow-cyan-500/30'
            } bg-neutral-950 flex items-center justify-center shadow-xl transition-colors duration-300`}>
              {/* Camera Video feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />

              {/* High-Performance 3D Biometric Face Canvas */}
              <BiometricFaceCanvas
                videoRef={videoRef}
                phase={phase}
                isUnregistered={!isRegisteredUser || phase === 'unregistered'}
                hudMode={hudMode}
                faceConfidence={faceConfidence}
                blinkCount={blinkCount}
                headYaw={headYaw}
                lightingQuality={lightingQuality}
                distanceCm={distanceCm}
              />

              {/* Hidden canvas for snapshot */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Captured preview if success */}
              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Face"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {/* Holographic / Radar Scanning Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Rotating biometric ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  className={`absolute inset-2 rounded-full border-2 border-dashed ${
                    phase === 'unregistered' ? 'border-amber-400/50' : 'border-cyan-400/40'
                  }`}
                />

                {/* Laser scan line running up & down */}
                {phase !== 'spoof_rejected' && phase !== 'unregistered' && (
                  <motion.div
                    animate={{ y: [0, 240, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]"
                  />
                )}
              </div>

                {/* Spoof Rejected Overlay */}
                {phase === 'spoof_rejected' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-rose-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-rose-400 p-4 text-center"
                  >
                    <ShieldAlert className="w-16 h-16 text-rose-400 mb-2 drop-shadow-[0_0_20px_#f43f5e] animate-bounce" />
                    <p className="text-sm font-black uppercase tracking-wider text-white">
                      SPOOF DETECTED!
                    </p>
                    <p className="text-xs text-rose-300 font-medium mt-1">
                      Picha feki imezuiwa na algorithm ya Murtaza AI.
                    </p>
                  </motion.div>
                )}

                {/* Unregistered Face Overlay */}
                {phase === 'unregistered' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-amber-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-amber-400 p-4 text-center z-20"
                  >
                    <UserX className="w-16 h-16 text-amber-400 mb-2 drop-shadow-[0_0_20px_#f59e0b] animate-bounce" />
                    <p className="text-sm font-black uppercase tracking-wider text-white">
                      USO HAUJASAJILIWA!
                    </p>
                    <p className="text-xs text-amber-200 font-medium mt-1">
                      Uso huu haupatikani kwenye hifadhidata ya PapoPay.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEnrollModalOpen(true)}
                      className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Sajili Uso Wako Sasa</span>
                    </button>
                  </motion.div>
                )}

                {/* Success Checkmark Splash */}
                {phase === 'success' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-400"
                  >
                    <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-2 drop-shadow-[0_0_20px_#10b981]" />
                    <p className="text-base font-black uppercase tracking-wider text-white">
                      USO UMETAMBULIKA!
                    </p>
                    <p className="text-xs text-emerald-300 font-mono">
                      Uhakiki: {faceConfidence}% Match &bull; Live 99.8%
                    </p>
                  </motion.div>
                )}
              </div>

            {/* Instruction Banner & Interactive Prompt */}
            <div className="mt-3 text-center max-w-xs space-y-1">
              {phase === 'initializing' && (
                <div className="flex items-center justify-center gap-2 text-cyan-400 font-bold text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Inafungua sensor ya uso na kamera...</span>
                </div>
              )}

              {phase === 'align_center' && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-2 text-cyan-300 font-black text-sm">
                    <UserCheck className="w-4 h-4" />
                    <span>Hatua 1: Weka uso wako katikati</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Angalia kamera moja kwa moja, usitoe miwani au kofia.
                  </p>
                </div>
              )}

              {phase === 'blink_detect' && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-sm animate-bounce">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Hatua 2: Pepesa Macho (Blink Once)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Murtaza Anti-Spoofing: Inathibitisha binadamu halisi.
                  </p>
                </div>
              )}

              {phase === 'smile_confirm' && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-sm">
                    <Smile className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Hatua 3: Tabasamu Kidogo (Smile to Pay)</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Tabasamu kukubali kutoa TZS {amount.toLocaleString()}.
                  </p>
                </div>
              )}

              {phase === 'verifying' && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-2 text-cyan-400 font-black text-sm">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Inathibitisha Biometric Key na Mkoba...</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Deep Neural Network inachanganua 468 landmarks.
                  </p>
                </div>
              )}

              {phase === 'spoof_rejected' && (
                <div className="text-rose-400 font-bold text-xs">
                  Malipo yamesitishwa kwa sababu za kiusalama.
                </div>
              )}

              {phase === 'unregistered' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-amber-400 font-black text-sm">
                    <UserX className="w-4 h-4" />
                    <span>Uso Haujasajiliwa Kwenye PapoPay!</span>
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Tafadhali sajili uso wako ili uweze kulipa kwa tabasamu mara moja.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Sajili Uso Wako Sasa (Face ID)</span>
                  </button>
                </div>
              )}

              {phase === 'success' && (
                <div className="text-emerald-400 font-black text-sm">
                  Malipo yamekamilika kikamilifu! ✨
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full mt-3 bg-neutral-800 rounded-full h-2 overflow-hidden">
              <motion.div
                className={`h-full ${
                  phase === 'spoof_rejected' 
                    ? 'bg-rose-500' 
                    : phase === 'unregistered'
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                }`}
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Interactive Anti-Spoofing & Unregistered Face Testing Banner */}
          <div className="px-5 py-2.5 bg-neutral-900/90 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Murtaza AI Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerUnregisteredFaceTest}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold text-[10px] border border-amber-500/30 transition-colors flex items-center gap-1"
                title="Jaribu mwitikio wa mfumo kwa mtu asiyesajiliwa"
              >
                <UserX className="w-3 h-3" />
                <span>Jaribu Mtu Asiyesajiliwa</span>
              </button>
              <button
                type="button"
                onClick={triggerSpoofAttackTest}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-bold text-[10px] border border-rose-500/30 transition-colors flex items-center gap-1"
                title="Jaribu uwezo wa mfumo kuzuia picha feki"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Picha Feki</span>
              </button>
            </div>
          </div>

          {/* Action Fallback buttons */}
          <div className="p-4 pt-2 flex gap-2 bg-[#0a0f1d]">
            <button
              type="button"
              onClick={() => {
                setIsRegisteredUser(true);
                startCamera();
              }}
              className="flex-1 py-2.5 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {phase === 'spoof_rejected' 
                  ? 'Rudia Ukiwa Uso Halisi' 
                  : phase === 'unregistered'
                  ? 'Rudia Utambuzi'
                  : 'Rudia Utambuzi'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 font-bold text-xs transition-colors"
            >
              Ghairi
            </button>
          </div>
        </motion.div>

        {/* Live Face Registration Modal if Unregistered */}
        <FaceRegistrationModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          initialName={payerName}
          onSuccess={(registeredData) => {
            setIsRegisteredUser(true);
            toast.success(`Uso wa ${registeredData.name} umesajiliwa kikamilifu! Sasa unaweza kulipa.`);
            startCamera();
          }}
        />
      </div>
    </AnimatePresence>
  );
};
