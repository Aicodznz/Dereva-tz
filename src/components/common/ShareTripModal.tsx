import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Copy, Check, MessageSquare, ShieldCheck, MapPin, Navigation, Eye, X, Phone, Car } from 'lucide-react';
import { toast } from 'sonner';

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverName?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  status?: string;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  isOpen,
  onClose,
  rideId,
  pickupAddress,
  dropoffAddress,
  driverName = "Dereva Swahili",
  vehiclePlate = "T 882 DKN",
  vehicleModel = "Toyota Ist (White)",
  status = "Safari Inaendelea"
}) => {
  const [copied, setCopied] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const cleanRideId = rideId || "TGX-" + Math.floor(100000 + Math.random() * 900000);
  const shareUrl = `${window.location.origin}/track?rideId=${cleanRideId}`;
  const shareText = `🚗 Fuatilia safari yangu ya Tegex kwa muda wote (Real-time Tracking):\n📍 Kutoka: ${pickupAddress}\n🏁 Kwenda: ${dropoffAddress}\n🚘 Gari: ${vehicleModel} (${vehiclePlate})\n\nLink ya live tracking: ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Link ya ufuatiliaji imenakiliwa!", {
      description: "Tuma kwa ndugu au rafiki kufuatilia safari yako.",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleSMSShare = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`sms:?body=${encodedText}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-6 space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.2em] block">USALAMA WA SAFARI</span>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-neutral-900 dark:text-white">Kushiriki Safari Live</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center border-0 outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ride Details Summary Card */}
          <div className="bg-neutral-50 dark:bg-neutral-950/80 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">ID ya Safari: <span className="text-emerald-600 font-mono">{cleanRideId}</span></span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-tight">
                ● Live Tracking
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase text-neutral-400 block">Kutoka</span>
                  <p className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{pickupAddress || "Eneo la Pickup"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase text-neutral-400 block">Kwenda</span>
                  <p className="font-bold text-neutral-800 dark:text-neutral-200 truncate">{dropoffAddress || "Eneo la Drop-off"}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{driverName}</span>
              </div>
              <span className="font-mono font-black text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md text-[10px]">{vehiclePlate}</span>
            </div>
          </div>

          {/* Direct Share Options */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.15em] block text-center">TUMA LINK YA UFUATILIAJI KWA</span>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleWhatsAppShare}
                className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 border-0 outline-none"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={handleSMSShare}
                className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 border-0 outline-none"
              >
                <Phone className="w-4 h-4" /> Ujumbe (SMS)
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="w-full h-12 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border-0 outline-none"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500 stroke-[3]" /> : <Copy className="w-4 h-4 text-neutral-500" />}
              {copied ? "Link Imenakiliwa!" : "Nakili Link ya Live Map"}
            </button>
          </div>

          {/* Live Preview Toggle Button */}
          <div className="pt-2">
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className="w-full text-center text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1.5 border-0 bg-transparent"
            >
              <Eye className="w-3.5 h-3.5" />
              {showLivePreview ? "Ficha Muonekano wa Rafiki" : "Angalia Muonekano wa Rafiki (Live Tracking Preview)"}
            </button>

            {showLivePreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2 text-xs"
              >
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-extrabold text-[11px] uppercase">
                  <Navigation className="w-4 h-4 animate-spin" /> Live Spectator View
                </div>
                <p className="text-neutral-300 text-[10px] leading-relaxed">
                  Mtu mwenye link hii ataona msogeo wa gari kwenye ramani, spidi, na muda uliobaki wa kufika bila kuwa na haja ya ku-download app!
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
