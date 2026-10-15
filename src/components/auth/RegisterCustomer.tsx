import React, { useState, useEffect, useRef } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  User, Mail, Phone, Lock, Loader2, Camera, ScanFace, 
  CheckCircle2, RefreshCw, X, ShieldCheck, AlertCircle, 
  Sparkles, Upload, Eye, EyeOff
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function RegisterCustomer() {
  const { t } = useLanguage();
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: 'male' as 'male' | 'female',
    password: '',
    confirmPassword: ''
  });

  // Face Registration Option ('now' or 'later')
  const [faceOption, setFaceOption] = useState<'later' | 'now'>('later');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Kamera haikuweza kufunguka. Unaweza kupakia picha ya uso kutoka kwenye faili au kuchagua kuweka baadaye.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas (unmirrored if needed, or matched)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(dataUrl);
    stopCamera();
    toast.success('Picha ya uso imenaswa kikamilifu!', { icon: '📸' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCapturedPhoto(result);
        stopCamera();
        toast.success('Picha ya uso imepakiwa kikamilifu!', { icon: '✅' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('passwords_dont_match'));
      return;
    }

    if (!formData.email || !formData.email.includes('@') || formData.email.length < 5) {
      toast.error('Tafadhali weka barua pepe sahihi.');
      return;
    }

    const hasFace = faceOption === 'now' && Boolean(capturedPhoto);

    setLoading(true);
    try {
      const extraPayload: any = {
        fullName: formData.fullName,
        phoneNumber: formData.phone,
        phone: formData.phone,
        gender: formData.gender,
        hasFaceEnrolled: hasFace,
        facePhotoUrl: hasFace ? capturedPhoto : '',
        faceEmbeddingId: hasFace ? `EMB-TZ-${Date.now()}` : '',
        faceRegisteredAt: hasFace ? new Date().toISOString() : ''
      };

      await signUp(formData.email.trim(), formData.password, 'customer', extraPayload);

      // Manage local persistent biometric record for immediate offline & kiosk recognition
      if (hasFace && capturedPhoto) {
        try {
          const faceRecord = {
            isEnrolled: true,
            name: formData.fullName,
            phone: formData.phone,
            photoUrl: capturedPhoto,
            embeddingId: `EMB-TZ-${Date.now()}`,
            dailyLimit: 500000,
            enrolledAt: new Date().toISOString()
          };
          localStorage.setItem('papopay_registered_face', JSON.stringify(faceRecord));

          // Also save in customer registry for Wakala/Merchant lookup
          const regString = localStorage.getItem('papopay_customers_registry');
          let registry: any[] = [];
          if (regString) {
            try { registry = JSON.parse(regString); } catch {}
          }
          registry = [faceRecord, ...registry.filter(r => r.phone !== formData.phone)];
          localStorage.setItem('papopay_customers_registry', JSON.stringify(registry));
        } catch {}

        toast.success('🎉 Hongera! Akaunti na Uso vimesajiliwa kikamilifu!', {
          description: 'Sasa unaweza kuweka pesa kwa Wakala na kulipa bila simu wala kadi.'
        });
      } else {
        // Customer chose not to enroll face now
        try {
          localStorage.setItem('papopay_registered_face', JSON.stringify({
            isEnrolled: false,
            name: formData.fullName,
            phone: formData.phone
          }));
        } catch {}

        toast.info('Akaunti imefanikiwa kutengenezwa!', {
          description: 'Hujaweka uso bado. Unaweza kuweka uso wako wakati wowote kwenye Wasifu wako.'
        });
      }

      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorCode = error.code || '';
      const errorMessage = error.message || '';

      if (errorCode === 'auth/operation-not-allowed') {
        toast.error(t('auth_disabled_instructions'), { duration: 8000 });
      } else if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        toast.error(t('email_already_exists'));
      } else if (errorCode === 'auth/weak-password') {
        toast.error(t('weak_password_error'));
      } else if (errorCode === 'auth/invalid-email') {
        toast.error(t('invalid_email_error'));
      } else {
        toast.error(errorMessage || t('signup_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={t('sign_up')} 
      subtitle="Tengeneza Akaunti ya Mteja"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="relative">
          <User className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
          <Input 
            required
            placeholder="Jina Kamili (Full Name)" 
            className="pl-10 h-12 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            value={formData.fullName}
            onChange={e => setFormData({...formData, fullName: e.target.value})}
          />
        </div>
        
        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
          <Input 
            type="email" 
            required
            placeholder="Barua Pepe (Email Address)" 
            className="pl-10 h-12 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>

        {/* Phone Number */}
        <div className="relative">
          <Phone className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
          <Input 
            type="tel" 
            required
            placeholder="Namba ya Simu (Mfano: 0754 000 000)" 
            className="pl-10 h-12 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>

        {/* Gender Selection */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 block">
            Jinsia / Gender <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, gender: 'male' })}
              className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                formData.gender === 'male'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500'
                  : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <span className="text-base">👨</span>
              <span>Mwanaume</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, gender: 'female' })}
              className={`h-11 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                formData.gender === 'female'
                  ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300 shadow-xs ring-1 ring-pink-500'
                  : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <span className="text-base">👩</span>
              <span>Mwanamke</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPTION YA KUWEKA USO (BIOMETRIC FACE ENROLLMENT OPTION) */}
        {/* ========================================================================= */}
        <div className="pt-2 pb-1">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-neutral-900/40 to-cyan-900/20 border border-cyan-500/30 dark:border-cyan-500/40 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center shrink-0">
                  <ScanFace className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
                    <span>Sajili Uso wa PapoPay</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                      Hiari / Option
                    </span>
                  </h4>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-tight">
                    Hukuwezesha kutambuliwa na Wakala na kulipa bila simu wala kadi.
                  </p>
                </div>
              </div>
            </div>

            {/* Option Radio Choice: 'now' vs 'later' */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFaceOption('now');
                  if (!capturedPhoto && !isCameraActive) {
                    startCamera();
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  faceOption === 'now'
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-800 dark:text-cyan-200 ring-1 ring-cyan-500/50 font-bold shadow-xs'
                    : 'bg-white/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-500" />
                    Weka Uso Sasa
                  </span>
                  {faceOption === 'now' && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                  )}
                </div>
                <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400 mt-1">
                  Inapendekezwa kwa Wakala & POS
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFaceOption('later');
                  stopCamera();
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  faceOption === 'later'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/50 font-bold shadow-xs'
                    : 'bg-white/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Nitaweka Baadaye
                  </span>
                </div>
                <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400 mt-1">
                  Ruka kwa sasa (Hiari)
                </span>
              </button>
            </div>

            {/* EXPANDABLE SECTION: WHEN FACE OPTION IS 'NOW' */}
            <AnimatePresence>
              {faceOption === 'now' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 overflow-hidden"
                >
                  {/* Photo Already Captured */}
                  {capturedPhoto ? (
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-md">
                          <img 
                            src={capturedPhoto} 
                            alt="Captured Face" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-black text-cyan-900 dark:text-cyan-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Uso Umenaswa Kikamilifu!
                          </p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Tayari kutumika kwa Wakala na madukani
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRetake}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Piga Upya
                      </button>
                    </div>
                  ) : (
                    /* Camera / Capture Controls */
                    <div className="space-y-2">
                      {isCameraActive ? (
                        <div className="relative rounded-2xl overflow-hidden bg-black border border-cyan-500/50 shadow-inner">
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            className="w-full h-48 sm:h-56 object-cover -scale-x-100"
                          />

                          {/* Oval Biometric Guide Target */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-44 rounded-[50%] border-2 border-dashed border-cyan-400/80 animate-pulse flex items-center justify-center">
                              <span className="text-[9px] font-mono text-cyan-300 uppercase bg-black/60 px-1.5 py-0.5 rounded">
                                Weka Uso Hapa
                              </span>
                            </div>
                          </div>

                          {/* Top Controls Overlay */}
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="p-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Bottom Capture Button Overlay */}
                          <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2 z-10 px-3">
                            <button
                              type="button"
                              onClick={handleCapturePhoto}
                              className="w-full py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 cursor-pointer active:scale-95 transition-all"
                            >
                              <Camera className="w-4 h-4" />
                              Piga Picha ya Uso Sasa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {cameraError && (
                            <p className="text-[11px] text-amber-500 font-medium">
                              {cameraError}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Fungua Kamera
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="py-2.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Pakia Picha
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hidden file input for uploading photo */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* NOTICE WHEN 'LATER' IS SELECTED */}
            {faceOption === 'later' && (
              <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 block">
                    Kumbuka / Note:
                  </span>
                  <span>
                    Ukiruka sasa, hutaweza kuweka/kutoa pesa kwa Wakala kwa kutumia uso mpaka utakapoweka uso wako kwenye Wasifu wako.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
          <Input 
            type={showPassword ? 'text' : 'password'} 
            required
            placeholder="Nenosiri (Password)" 
            className="pl-10 pr-10 h-12 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3.5 text-neutral-400 hover:text-neutral-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <Lock className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
          <Input 
            type={showPassword ? 'text' : 'password'} 
            required
            placeholder="Thibitisha Nenosiri (Confirm Password)" 
            className="pl-10 h-12 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
            value={formData.confirmPassword}
            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
          />
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-base sm:text-lg font-black mt-4 shadow-lg shadow-orange-600/20 cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Inatengeneza Akaunti...</span>
            </div>
          ) : (
            faceOption === 'now' && capturedPhoto 
              ? "Tengeneza Akaunti & Hifadhi Uso" 
              : "Sign Up / Tengeneza Akaunti"
          )}
        </Button>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:underline">
            Sign in / Ingia
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
