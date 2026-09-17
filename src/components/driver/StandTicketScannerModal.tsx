import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, QrCode, CheckCircle2, AlertCircle, ShieldCheck, 
  Search, Users, Check, Phone, ArrowRight, Sparkles, RefreshCw
} from 'lucide-react';
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
  const [ticketInput, setTicketInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSuccessMsg, setVerifiedSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const passengers = activeRoute.passengers || [];
  const bookedPassengers = passengers.filter(p => p.status === 'booked');
  const boardedPassengers = passengers.filter(p => p.status === 'boarded');

  const handleVerifyCodeOrPassenger = async (passengerIdOrCode: string) => {
    if (!passengerIdOrCode.trim()) return;

    try {
      setIsVerifying(true);
      const res = await verifyStandPassengerBoarding(activeRoute.id, passengerIdOrCode);

      if (res.success) {
        playSyntheticImportant();
        toast.success(res.message);
        setVerifiedSuccessMsg(res.message);
        setTicketInput('');
        if (res.passenger && onPassengerVerified) {
          onPassengerVerified(res.passenger);
        }
        setTimeout(() => setVerifiedSuccessMsg(null), 4000);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Hitilafu katika kuthibitisha tiketi.");
    } finally {
      setIsVerifying(false);
    }
  };

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

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Input Bar / Code Search */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
              Andika au Changanua Namba ya Tiketi (k.m. STND-A48F)
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
