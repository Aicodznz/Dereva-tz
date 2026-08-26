import React, { useState, useEffect } from 'react';
import { useBusinessConfig } from '../BusinessConfigContext';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, ArrowRight, ShieldCheck, Star, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AppDownloadButtonProps {
  className?: string;
  variant?: 'floating' | 'outline' | 'compact';
}

export default function AppDownloadButton({ className = "", variant = "floating" }: AppDownloadButtonProps) {
  const { config } = useBusinessConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // If download feature is disabled by Admin, don't render anything
  if (!config?.enableAppDownload) return null;

  const handleDownloadApk = async () => {
    const rawUrl = config.apkDownloadUrl?.trim();
    const isRealUrl = rawUrl && !rawUrl.includes('example.com') && rawUrl !== '';

    if (isRealUrl) {
      toast.success("Inaanza kupakua faili la APK rasmi...", { duration: 3500 });
      window.open(rawUrl, '_blank', 'noreferrer,noopener');
      return;
    }

    // If PWA native install prompt is available
    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          toast.success("Asante! Programu inasakinishwa kwenye simu yako.");
          setIsOpen(false);
          return;
        }
      } catch (e) {
        console.error("Install prompt error:", e);
      }
    }

    // Direct browser install guidance toast
    toast.info("Weka kwenye Skrini ya Nyumbani (Install App)", {
      description: "Bonyeza vitufe 3 vya kivinjari chako (juu kulia) kisha chagua 'Weka kwenye Skrini ya Nyumbani' au 'Sakinisha Programu'.",
      duration: 6000
    });
  };

  const handlePlayStore = () => {
    const rawUrl = config.playStoreUrl?.trim();
    if (rawUrl && !rawUrl.includes('example.com')) {
      window.open(rawUrl, '_blank', 'noreferrer,noopener');
    } else {
      toast.info("Inaelekeza Google Play Store rasmi...", { duration: 2500 });
      window.open('https://play.google.com/store/apps', '_blank', 'noreferrer,noopener');
    }
  };

  const handleAppStore = () => {
    const rawUrl = config.appStoreUrl?.trim();
    if (rawUrl && !rawUrl.includes('example.com')) {
      window.open(rawUrl, '_blank', 'noreferrer,noopener');
    } else {
      toast.info("Inaelekeza Apple App Store rasmi...", { duration: 2500 });
      window.open('https://apps.apple.com', '_blank', 'noreferrer,noopener');
    }
  };

  const downloadOptions = [
    {
      title: "Android Direct APK",
      sub: "Sakinisha moja kwa moja kwenye simu yako ya Android (Haraka & Salama)",
      badge: "Inapendekezwa",
      action: handleDownloadApk,
      icon: "🤖",
      color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    },
    {
      title: "Google Play Store",
      sub: "Pakua kupitia Google Play Store rasmi",
      action: handlePlayStore,
      icon: "🏪",
      color: "bg-blue-500/10 text-blue-400 border border-blue-500/20"
    },
    {
      title: "Apple App Store",
      sub: "Kwa watumiaji wa iOS (iPhone & iPad)",
      action: handleAppStore,
      icon: "🍎",
      color: "bg-neutral-500/10 text-neutral-300 border border-neutral-500/25"
    }
  ];

  return (
    <>
      {variant === 'floating' && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black uppercase tracking-wider text-[11px] px-5 py-3 rounded-full shadow-2xl shadow-orange-500/30 border border-amber-400/30 relative z-40 active:scale-95 transition-all ${className}`}
        >
          <Smartphone className="w-4 h-4 animate-bounce" />
          <span>Pakua App</span>
        </motion.button>
      )}

      {variant === 'outline' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 border border-neutral-700/60 rounded-xl text-neutral-300 font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-800/80 hover:text-white transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={className ? className : `flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600/15 border border-orange-500/20 text-orange-400 hover:bg-orange-600/25 hover:scale-105 active:scale-95 transition-all`}
          title="Pakua Application yetu"
        >
          <Smartphone className={className ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4"} />
        </button>
      )}

      {/* Modal Overlay / Bottom Sheet with Highest Z-Index */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-3 sm:p-5 select-none overflow-y-auto bg-black/85 backdrop-blur-xl">
            {/* Backdrop Click */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-transparent"
            />

            {/* Modal Dialog Box */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#111118] border border-neutral-800 rounded-[28px] p-5 sm:p-6 text-white z-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] my-auto max-h-[92vh] flex flex-col justify-between overflow-y-auto no-scrollbar"
            >
              {/* Header with Close Button */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-black shadow-md shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black uppercase font-heading tracking-tight leading-tight">
                      Toleo la Simu (App)
                    </h2>
                    <p className="text-[9.5px] text-amber-400 font-bold uppercase tracking-wider">
                      Madereva & Abiria
                    </p>
                  </div>
                </div>

                {/* Primary Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/80 transition-all active:scale-90 text-[10px] font-bold uppercase shrink-0 shadow-sm"
                  title="Funga"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Funga</span>
                </button>
              </div>

              {/* Download / Install Options */}
              <div className="space-y-2.5 mb-3.5">
                {downloadOptions.map((opt, idx) => (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    key={idx}
                    onClick={() => {
                      opt.action();
                    }}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#161622] hover:bg-[#1a1a2b] border border-neutral-800 hover:border-amber-400/50 cursor-pointer active:scale-98 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl shrink-0">{opt.icon}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-neutral-100 uppercase tracking-wide truncate">
                            {opt.title}
                          </h4>
                          {opt.badge && (
                            <span className="text-[7.5px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-black uppercase tracking-wider leading-none">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium leading-tight mt-0.5">
                          {opt.sub}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
                  </motion.div>
                ))}
              </div>

              {/* PWA Direct Pin / Home Screen Section */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/25 border border-indigo-500/20 shadow-xs mb-3.5">
                <div className="flex items-center gap-1.5 text-indigo-300 font-black uppercase text-[9px] tracking-wider mb-1">
                  <Star className="w-3.5 h-3.5 fill-indigo-400 text-indigo-400" />
                  <span>Weka kwenye Skrini ya Nyumbani (Bila Kupakua)</span>
                </div>
                <p className="text-[10px] text-neutral-300 font-medium leading-relaxed">
                  <span className="text-amber-400 font-bold">Android (Chrome):</span> Bonyeza vitufe 3 vya kivinjari juu kulia → Chagua <strong>Weka kwenye Skrini ya Nyumbani (Install App)</strong>.<br />
                  <span className="text-amber-400 font-bold">iPhone (Safari):</span> Bonyeza kitufe cha <strong>Shiriki (Share)</strong> chini → Chagua <strong>Add to Home Screen</strong>.
                </p>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-between pt-1 text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Salama & Imethibitishwa</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-neutral-400 hover:text-neutral-200 underline cursor-pointer"
                >
                  Rudi Nyuma
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
