import React, { useState } from 'react';
import { useBusinessConfig } from '../BusinessConfigContext';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, ArrowRight, ShieldCheck, Star } from 'lucide-react';

interface AppDownloadButtonProps {
  className?: string;
  variant?: 'floating' | 'outline' | 'compact';
}

export default function AppDownloadButton({ className = "", variant = "floating" }: AppDownloadButtonProps) {
  const { config } = useBusinessConfig();
  const [isOpen, setIsOpen] = useState(false);

  // If download feature is disabled by Admin, don't render anything
  if (!config?.enableAppDownload) return null;

  const handleDownloadApk = () => {
    const url = config.apkDownloadUrl || 'https://example.com/download/app-release.apk';
    window.open(url, '_blank', 'noreferrer,noopener');
  };

  const downloadOptions = [
    {
      title: "Android Direct APK",
      sub: "Pakua faili la APK moja kwa moja, salama na haraka",
      badge: "Inapendekezwa",
      action: handleDownloadApk,
      icon: "🤖",
      color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
    },
    {
      title: "Google Play Store",
      sub: "Kupitia Google Play Store rasmi",
      action: () => window.open(config.playStoreUrl || 'https://play.google.com', '_blank'),
      icon: "🏪",
      color: "bg-blue-500/10 text-blue-400 border border-blue-500/20"
    },
    {
      title: "Apple App Store",
      sub: "Kwa iOS (iPhone & iPad)",
      action: () => window.open(config.appStoreUrl || 'https://apps.apple.com', '_blank'),
      icon: "🍎",
      color: "bg-neutral-500/10 text-neutral-300 border border-neutral-500/25"
    }
  ];

  return (
    <>
      {variant === 'floating' && (
        <motion.button
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
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 border border-neutral-700/60 rounded-xl text-neutral-300 font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-800/80 hover:text-white transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          onClick={() => setIsOpen(true)}
          className={className ? className : `flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600/15 border border-orange-500/20 text-orange-400 hover:bg-orange-600/25 hover:scale-105 active:scale-95 transition-all`}
          title="Pakua Application yetu"
        >
          <Smartphone className={className ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4"} />
        </button>
      )}

      {/* Modal Overlay / Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Content Card */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full sm:max-w-md bg-[#111118] border-t sm:border border-[#1e1e2e] rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 text-white z-10 shadow-3xl text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute right-6 top-6 w-10 h-10 rounded-full bg-[#1e1e2e] border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-black shadow-lg">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight">Pakua Application Rasmi</h2>
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Toleo la Simu (Madereva & Abiria)</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {downloadOptions.map((opt, idx) => (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    key={idx}
                    onClick={() => {
                      opt.action();
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-4 rounded-3xl bg-[#161622] border border-[#232335] hover:border-amber-400/40 cursor-pointer active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{opt.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{opt.title}</h4>
                          {opt.badge && (
                            <span className="text-[8px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-black uppercase">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-medium leading-tight mt-0.5">{opt.sub}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-500" />
                  </motion.div>
                ))}
              </div>

              {/* PWA Section */}
              <div className="p-5 rounded-3xl bg-[#1a111a]/40 border border-[#de42cb]/10 shadow-sm space-y-3 mb-6">
                <div className="flex items-center gap-2 text-[#de42cb] font-extrabold uppercase text-[10px] tracking-widest">
                  <Star className="w-4 h-4" />
                  <span>Ongeza kwenye Skrini ya Kwanza</span>
                </div>
                <p className="text-[11px] text-neutral-300 font-medium leading-relaxed">
                  Kama hupendi kupakua, weka alama hii kwenye skrini yako: <br />
                  <span className="text-neutral-400 font-bold">Android:</span> Fungua kivinjari cha Chrome → Bonyeza vitufe 3 juu kulia → Chagua <strong>Weka kwenye Skrini ya Nyumbani (Install App)</strong>.<br />
                  <span className="text-neutral-400 font-bold">iOS (iPhone):</span> Fungua Safari → Bonyeza kitufe cha <strong>Shiriki (Share)</strong> chini → Chagua <strong>Weka kwenye Skrini ya Nyumbani (Add to Home Screen)</strong>.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-500 font-extrabold uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Faili zote zimechunguzwa na ni salama</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
