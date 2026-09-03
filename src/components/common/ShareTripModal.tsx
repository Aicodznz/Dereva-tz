import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  ShieldCheck, 
  Navigation, 
  Eye, 
  X, 
  Phone, 
  Car, 
  Link as LinkIcon,
  Send,
  Share
} from 'lucide-react';
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedFullText, setCopiedFullText] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const cleanRideId = rideId || "TGX-" + Math.floor(100000 + Math.random() * 900000);
  const shareUrl = `${window.location.origin}/track?rideId=${cleanRideId}`;
  const shareText = `🚗 Fuatilia safari yangu ya Tegex kwa muda wote (Real-time Tracking):\n📍 Kutoka: ${pickupAddress || "Eneo la Pickup"}\n🏁 Kwenda: ${dropoffAddress || "Eneo la Drop-off"}\n🚘 Gari: ${vehicleModel} (${vehiclePlate})\n\nLink ya live tracking: ${shareUrl}`;

  // Keyboard shortcut (Escape) to close modal and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Robust, cross-device multi-tier clipboard copy helper
  const copyToClipboard = async (textToCopy: string, isFullText = false): Promise<boolean> => {
    let success = false;

    // 1. Try modern async Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch (err) {
        console.warn('Clipboard API writeText failed, using fallback:', err);
      }
    }

    // 2. Fallback using temporary textarea and document.execCommand('copy')
    if (!success && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2em';
        textarea.style.height = '2em';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        textarea.style.opacity = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textToCopy.length);
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.error('execCommand copy fallback failed:', err);
      }
    }

    // Trigger haptic vibration on mobile if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch (e) {
        // ignore vibrate restrictions
      }
    }

    if (isFullText) {
      setCopiedFullText(true);
      toast.success("Ujumbe mzima wa safari umenakiliwa!", {
        description: "Ujumbe wenye maelezo ya gari na link uko tayari kubandikwa.",
      });
      setTimeout(() => setCopiedFullText(false), 2500);
    } else {
      setCopiedLink(true);
      toast.success("Link ya ufuatiliaji imenakiliwa!", {
        description: shareUrl,
      });
      setTimeout(() => setCopiedLink(false), 2500);
    }

    return success;
  };

  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  const handleSMSShare = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`sms:?body=${encodedText}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Fuatilia Safari Yangu ya Live Map - Tegex',
          text: shareText,
          url: shareUrl,
        });
        toast.success("Imeshirikiwa kwa mafanikio!");
      } catch (err) {
        // If user cancelled, do nothing
      }
    } else {
      // If native share not supported, copy link directly
      copyToClipboard(shareUrl);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div 
        id="share-trip-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          id="share-trip-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-5 my-auto max-h-[92dvh] overflow-y-auto"
        >
          {/* Header with Prominent, Accessible Close Button */}
          <div className="flex items-center justify-between pb-1 border-b border-neutral-100 dark:border-neutral-800/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.2em] block">
                  USALAMA WA SAFARI
                </span>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-neutral-900 dark:text-white">
                  Kushiriki Safari Live
                </h3>
              </div>
            </div>

            {/* High-visibility Close Button (Min 44x44px touch target) */}
            <button
              id="share-trip-close-btn"
              type="button"
              onClick={onClose}
              aria-label="Funga"
              title="Funga dirisha hili"
              className="w-11 h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white flex items-center justify-center transition-all active:scale-90 border border-neutral-200 dark:border-neutral-700 cursor-pointer shadow-xs shrink-0"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Ride Details Summary Card */}
          <div className="bg-neutral-50 dark:bg-neutral-950/80 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">
                ID ya Safari: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{cleanRideId}</span>
              </span>
              <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-tight flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Tracking
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

            <div className="pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{driverName}</span>
              </div>
              <span className="font-mono font-black text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md text-[10px] border border-indigo-500/20">
                {vehiclePlate}
              </span>
            </div>
          </div>

          {/* Direct Share Options (WhatsApp & SMS) */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.15em] block text-center">
              TUMA LINK YA UFUATILIAJI KWA
            </span>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 border-0 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={handleSMSShare}
                className="h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 border-0 cursor-pointer"
              >
                <Phone className="w-4 h-4" /> Ujumbe (SMS)
              </button>
            </div>

            {/* Quick URL Display & Direct Copy Box */}
            <div className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
              <input
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="bg-transparent text-[11px] font-mono font-semibold text-neutral-700 dark:text-neutral-300 flex-1 outline-none truncate select-all cursor-text"
                title="Bofya kuchagua link yote"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(shareUrl)}
                className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600 shadow-xs'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Imenakiliwa" : "Nakili"}</span>
              </button>
            </div>

            {/* Primary Large Copy Button */}
            <button
              id="copy-live-link-btn"
              type="button"
              onClick={() => copyToClipboard(shareUrl)}
              className={`w-full h-12 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm ${
                copiedLink 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' 
                  : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-white stroke-[3] animate-bounce" />
                  <span>Link Imenakiliwa!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  <span>Nakili Link ya Live Map</span>
                </>
              )}
            </button>

            {/* Extra Options: Full text copy or Native Share */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => copyToClipboard(shareText, true)}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800/50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedFullText ? "Ujumbe Umenakiliwa!" : "Nakili Ujumbe Kamili"}</span>
              </button>

              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  <span>App Nyingine</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Preview Toggle Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowLivePreview(!showLivePreview)}
              className="w-full text-center text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1.5 border-0 bg-transparent cursor-pointer py-1"
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

          {/* Bottom Thumb-Friendly Close/Exit Button for Easy Mobile Use */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
            <button
              id="share-trip-bottom-close-btn"
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 hover:dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all border border-neutral-200 dark:border-neutral-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Funga Dirisha</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  // Use createPortal to mount directly to body, escaping any transformed/draggable container
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
