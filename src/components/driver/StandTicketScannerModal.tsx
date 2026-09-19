import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, QrCode, CheckCircle2, AlertCircle, ShieldCheck, 
  Search, Users, Check, Phone, ArrowRight, Sparkles, RefreshCw,
  Camera, CameraOff, Flashlight, Zap, CheckCircle, Smartphone
} from 'lucide-react';
import jsQR from 'jsqr';
import { toast } from 'sonner';
import { StandPoolingRoute, StandPassenger, verifyStandPassengerBoarding } from '../../services/standPoolingService';
import { playSyntheticImportant } from '../../utils/soundAlert';

interface StandTicketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: StandPoolingRoute;
  onPassengerVerified?: (passenger: StandPassenger) => void;
}

export const StandTicketScannerModal: React.FC<StandTicketScannerModalProps> = ({
  isOpen,
  onClose,
  activeRoute,
  onPassengerVerified
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [ticketInput, setTicketInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccessMsg, setVerifiedSuccessMsg] = useState<string | null>(null);
  const [lastVerifiedPassenger, setLastVerifiedPassenger] = useState<StandPassenger | null>(null);

  // Camera & Video States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const passengers = activeRoute?.passengers || [];
  const bookedPassengers = passengers.filter(p => p.status === 'booked');
  const boardedPassengers = passengers.filter(p => p.status === 'boarded');

  // Stop camera helper
  const stopCamera = () => {
    isScanningActiveRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setIsTorchOn(false);
  };

  // Start Camera Stream
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Kivinjari hiki hakitumii kamera ya moja kwa moja.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      // Check for torch/flashlight capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        isScanningActiveRef.current = true;
        requestScanFrame();
      }
    } catch (err: any) {
      console.warn("Camera start failed in scanner modal:", err);
      const msg = err.name === 'NotAllowedError'
        ? "Ufikiaji wa kamera umezuiwa. Tafadhali ruhusu kamera kwenye mipangilio au tumia uthibitisho kwa orodha/namba."
        : "Imeshindikana kufungua kamera. Tafadhali tumia namba ya tiketi au orodha ya abiria.";
      setCameraError(msg);
      setActiveTab('manual');
    }
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn("Could not toggle torch:", err);
      toast.error("Taa ya kamera haipatikani.");
    }
  };

  // Switch between front and back camera
  const toggleCameraFacing = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Extract raw ticket code or passenger ID from QR data
  const extractTicketCodeOrId = (qrText: string): string => {
    const raw = (qrText || '').trim();
    if (!raw) return '';

    // Check if JSON
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.ticketCode) return parsed.ticketCode;
        if (parsed.passengerId) return parsed.passengerId;
      } catch (e) {
        // not valid JSON, proceed to string patterns
      }
    }

    // Pattern: STAND_PASS:STND-XXXXX
    if (raw.includes('STAND_PASS:')) {
      return raw.replace('STAND_PASS:', '').trim();
    }

    // Pattern: STND-XXXXX
    const match = raw.match(/STND-[A-Z0-9_-]+/i);
    if (match) {
      return match[0].toUpperCase();
    }

    return raw;
  };

  // QR Scanning Loop
  const requestScanFrame = () => {
    if (!isScanningActiveRef.current) return;

    const video = videoRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && isScanningActiveRef.current) {
          const extracted = extractTicketCodeOrId(code.data);
          if (extracted) {
            // Pause scanning during verification
            isScanningActiveRef.current = false;
            handleVerifyCodeOrPassenger(extracted, true);
            return;
          }
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(requestScanFrame);
  };

  // Main verification handler
  const handleVerifyCodeOrPassenger = async (passengerIdOrCode: string, isFromCamera = false) => {
    if (!passengerIdOrCode.trim()) return;

    try {
      setIsVerifying(true);
      const res = await verifyStandPassengerBoarding(activeRoute.id, passengerIdOrCode);

      if (res.success) {
        playSyntheticImportant();
        // Haptic feedback if on mobile
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch (e) {
            // ignore
          }
        }

        toast.success(res.message);
        setVerifiedSuccessMsg(res.message);
        setTicketInput('');
        if (res.passenger) {
          setLastVerifiedPassenger(res.passenger);
          if (onPassengerVerified) {
            onPassengerVerified(res.passenger);
          }
        }

        // Keep celebration banner for 4s
        setTimeout(() => {
          setVerifiedSuccessMsg(null);
        }, 5000);

        // If from camera, resume scanner after 2.5s for next passenger
        if (isFromCamera && activeTab === 'camera') {
          setTimeout(() => {
            if (isOpen && activeTab === 'camera') {
              isScanningActiveRef.current = true;
              requestScanFrame();
            }
          }, 2600);
        }
      } else {
        toast.error(res.message);
        // Resume camera scan if failed
        if (isFromCamera && activeTab === 'camera') {
          setTimeout(() => {
            if (isOpen && activeTab === 'camera') {
              isScanningActiveRef.current = true;
              requestScanFrame();
            }
          }, 2000);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Hitilafu katika kuthibitisha tiketi.");
      if (isFromCamera && activeTab === 'camera') {
        setTimeout(() => {
          if (isOpen && activeTab === 'camera') {
            isScanningActiveRef.current = true;
            requestScanFrame();
          }
        }, 2000);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Manage camera on modal open / tab change / facing change
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, cameraFacing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-[#12121c] rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">KAGUA TIKETI ZA ABIRIA</h2>
              <p className="text-[11px] text-emerald-100 font-medium">
                PapoShare Stendi • Thibitisha abiria kabla ya kuingia garini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Camera Live Scanner vs Orodha & Namba */}
        <div className="p-2.5 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera ya QR (Live)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Orodha & Namba ({bookedPassengers.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: LIVE CAMERA QR SCANNER */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Kagua kwa Namba au Orodha
                  </button>
                </div>
              ) : (
                <div className="relative w-full aspect-square max-h-[300px] rounded-3xl overflow-hidden bg-black border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Targeting Viewfinder Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Darkened Vignette */}
                    <div className="absolute inset-0 bg-black/40" />

                    {/* Clear Target Window */}
                    <div className="relative w-56 h-56 rounded-2xl border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)] overflow-hidden bg-transparent">
                      {/* Animated Laser Scanning Line */}
                      <motion.div
                        animate={{ y: [0, 220, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                        className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                      />

                      {/* Corner Accents */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                    </div>
                  </div>

                  {/* Camera Controls Overlay (Torch & Flip) */}
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer ${
                          isTorchOn
                            ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-md shadow-amber-400/30'
                            : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                        }`}
                        title="Washa Taa"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="w-9 h-9 rounded-xl bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer"
                      title="Badili Kamera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Guidance hint badge */}
                  <div className="absolute bottom-3 inset-x-4 flex justify-center z-10">
                    <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-white font-bold text-[10.5px] border border-white/15 tracking-wide flex items-center gap-1.5 shadow-md">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Weka QR Code ya abiria ndani ya kisanduku
                    </span>
                  </div>
                </div>
              )}

              {/* Verified Passenger Spotlight Card (when just verified) */}
              {lastVerifiedPassenger && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border-2 border-emerald-500/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Abiria Amethibitishwa Garini!
                    </span>
                    <span className="bg-amber-400 text-neutral-950 font-black text-[10px] px-2 py-0.5 rounded-md">
                      {lastVerifiedPassenger.seatNumbers || 'Siti #1'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-neutral-900 dark:text-neutral-100">
                        {lastVerifiedPassenger.passengerName}
                      </p>
                      <p className="text-[10.5px] text-neutral-500">
                        Kushukia: {lastVerifiedPassenger.dropoffName} • TZS {lastVerifiedPassenger.fare?.toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                      {lastVerifiedPassenger.ticketCode}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Quick Input Bar / Code Search */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
              Andika au Tafuta Namba ya Tiketi (k.m. STND-A48F)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyCodeOrPassenger(ticketInput);
                    }
                  }}
                  placeholder="STND-XXXXX..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-mono font-bold uppercase placeholder:normal-case placeholder:font-sans placeholder:text-neutral-400 outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                disabled={!ticketInput.trim() || isVerifying}
                onClick={() => handleVerifyCodeOrPassenger(ticketInput)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>Thibitisha</span>
              </button>
            </div>
          </div>

          {/* Success Banner */}
          <AnimatePresence>
            {verifiedSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{verifiedSuccessMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Boarding Counter Progress */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                Waliothibitishwa Kupanda:
              </span>
            </div>
            <span className="font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full text-xs">
              {boardedPassengers.length} / {passengers.length} Abiria
            </span>
          </div>

          {/* List of Booked Passengers Waiting for Boarding Verification */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
              <span>Wanaosubiri Kupanda ({bookedPassengers.length})</span>
              <span className="text-[10px] text-amber-600 font-bold">Kagua tiketi kabla ya kuruhusu</span>
            </h4>

            {bookedPassengers.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-400 font-medium">
                Hakuna abiria anayesubiri kukaguliwa kwa sasa.
              </div>
            ) : (
              <div className="space-y-2">
                {bookedPassengers.map((p, idx) => {
                  const tCode = p.ticketCode || `STND-${(p.passengerId || '12345').slice(-5).toUpperCase()}`;
                  const sLabel = p.seatNumbers || `Siti #${idx + 1}`;

                  return (
                    <div
                      key={p.passengerId || idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-neutral-200/80 dark:border-neutral-800 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-neutral-950 font-black text-[10px]">
                            {sLabel}
                          </span>
                          <span className="font-mono font-bold text-[11px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                            {tCode}
                          </span>
                          <span className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                            {p.passengerName}
                          </span>
                        </div>

                        <p className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 mt-1">
                          Kushukia: <span className="text-neutral-900 dark:text-neutral-200">{p.dropoffName}</span> • TZS {p.fare?.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.passengerPhone && (
                          <a
                            href={`tel:${p.passengerPhone}`}
                            className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center transition-colors"
                            title={`Piga simu kwa ${p.passengerName}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          disabled={isVerifying}
                          onClick={() => handleVerifyCodeOrPassenger(p.ticketCode || p.passengerId)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Amepanda ✓</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* List of Already Verified & Boarded Passengers */}
          {boardedPassengers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Waliothibitishwa Garini ({boardedPassengers.length})</span>
              </h4>

              <div className="space-y-1.5">
                {boardedPassengers.map((p, idx) => (
                  <div
                    key={p.passengerId || idx}
                    className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        ✓
                      </span>
                      <div className="truncate">
                        <span className="font-extrabold text-neutral-900 dark:text-neutral-100">
                          {p.passengerName}
                        </span>
                        <span className="text-[10px] text-neutral-400 ml-1.5">
                          ({p.seatNumbers || `Siti #${idx + 1}`})
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md shrink-0">
                      Amepanda Garini
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-black uppercase tracking-wider transition-opacity hover:opacity-90 cursor-pointer"
          >
            Funga
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default StandTicketScannerModal;
