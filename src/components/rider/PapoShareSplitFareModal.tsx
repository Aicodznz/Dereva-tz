import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Users, Share2, Copy, Check, MessageSquare, 
  Sparkles, DollarSign, ArrowRight, UserPlus, Phone, 
  ShieldCheck, Calculator, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateCarpoolSplitFare, CarpoolSplitCalculation } from '../../services/papoShareEngine';

interface PapoShareSplitFareModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseFare: number;
  pickupAddress?: string;
  destinationAddress?: string;
  rideId?: string;
  theme?: 'dark' | 'light';
}

export const PapoShareSplitFareModal: React.FC<PapoShareSplitFareModalProps> = ({
  isOpen,
  onClose,
  baseFare = 8000,
  pickupAddress = 'Eneo la Kuanzia',
  destinationAddress = 'Mwisho wa Safari',
  rideId,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';
  const [passengerCount, setPassengerCount] = useState<number>(2);
  const [copiedLink, setCopiedLink] = useState(false);
  const [coRiders, setCoRiders] = useState<{ id: string; name: string; phone: string }[]>([
    { id: '1', name: 'Wewe (Mwenye Safari)', phone: '' }
  ]);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [paymentSplitType, setPaymentSplitType] = useState<'individual' | 'host_pays_all'>('individual');

  const calculation: CarpoolSplitCalculation = useMemo(() => {
    return calculateCarpoolSplitFare(baseFare || 6000, passengerCount);
  }, [baseFare, passengerCount]);

  const cleanRideId = rideId || `SPLIT-${Math.floor(100000 + Math.random() * 900000)}`;
  const inviteUrl = `${window.location.origin}/track?rideId=${cleanRideId}&split=true`;

  const inviteText = `🚗 Habari! Nimepanga safari ya PapoShare kutoka ${pickupAddress} kuelekea ${destinationAddress}.\n\n👥 Safari ya pamoja (watu ${passengerCount}): Kila mtu analipa TZS ${calculation.farePerPerson.toLocaleString()} TU (Badala ya TZS ${calculation.totalSoloFare.toLocaleString()})!\n💰 Unaokoa TZS ${calculation.savingsPerPerson.toLocaleString()}!\n\nJiunge na safari hii kwa link:\n${inviteUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast.success("Link ya safari ya PapoShare imenakiliwa!");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      toast.error("Imeshindikana kunakili link.");
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(inviteText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleAddCoRider = () => {
    if (!newRiderName.trim()) {
      toast.error("Tafadhali weka jina la msafiri mwenzako.");
      return;
    }
    if (coRiders.length >= passengerCount) {
      setPassengerCount(prev => Math.min(4, prev + 1));
    }
    setCoRiders(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name: newRiderName.trim(),
        phone: newRiderPhone.trim()
      }
    ]);
    setNewRiderName('');
    setNewRiderPhone('');
    toast.success(`Msafiri mwenzako ${newRiderName} ameongezwa!`);
  };

  const handleRemoveCoRider = (id: string) => {
    if (id === '1') return; // cannot remove host
    setCoRiders(prev => prev.filter(r => r.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-[#12121c] rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">GAWANA NAULI (PAPOSHARE)</h2>
                <span className="bg-amber-400 text-neutral-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-2xs">
                  -35% Punguzo
                </span>
              </div>
              <p className="text-[11px] text-purple-100 font-medium">
                Punguza gharama kwa kushiriki safari na wenzako au marafiki
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Passenger Count Selection (2, 3, 4) */}
          <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-purple-600" />
                <span>Idadi ya Wasafiri Wanaogawana:</span>
              </label>
              <span className="text-xs font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60 px-2.5 py-0.5 rounded-full">
                Abiria {passengerCount}
              </span>
            </div>

            {/* Quick 2, 3, 4 Selector Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPassengerCount(num)}
                  className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                    passengerCount === num
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20 font-black'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:border-purple-300'
                  }`}
                >
                  <span className="text-xs">{num} Watu</span>
                  <p className="text-[9px] opacity-80">
                    {num === 2 ? '35% punguzo' : num === 3 ? '40% punguzo' : '45% punguzo'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Transparent Live Calculation Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-[#181226] text-white space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <span className="text-xs text-neutral-400 font-bold">Nauli ya Kawaida (Solo):</span>
              <span className="text-xs font-mono line-through text-neutral-400">
                TZS {calculation.totalSoloFare.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Punguzo la PapoShare ({calculation.discountPercentage}%):
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                - TZS {calculation.discountAmount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                  KILA MTU ANALIPA TU:
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-400">
                    TZS {calculation.farePerPerson.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-neutral-400">/ mtu</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-neutral-400 font-bold block">Unaokoa:</span>
                <span className="text-sm font-black font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  TZS {calculation.savingsPerPerson.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Co-Riders List & Quick Add */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span>Orodha ya Wasafiri ({coRiders.length} / {passengerCount})</span>
              </h4>
              <span className="text-[10.5px] text-neutral-500 font-medium">
                Kila mmoja atalipa TZS {calculation.farePerPerson.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              {coRiders.map((rider, idx) => (
                <div
                  key={rider.id}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="truncate">
                      <p className="font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                        {rider.name}
                      </p>
                      {rider.phone && (
                        <p className="text-[10px] text-neutral-500 font-mono">
                          {rider.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-2 py-0.5 rounded text-[11px]">
                      TZS {calculation.farePerPerson.toLocaleString()}
                    </span>
                    {rider.id !== '1' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCoRider(rider.id)}
                        className="text-neutral-400 hover:text-rose-500 p-1 transition-colors"
                        title="Ondoa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Co-Rider Inputs */}
            {coRiders.length < 4 && (
              <div className="p-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-500 block">
                  Ongeza Jina au Namba ya Rafiki Anayejiunga:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newRiderName}
                    onChange={(e) => setNewRiderName(e.target.value)}
                    placeholder="Jina (k.m. Neema au Juma)..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold outline-none focus:border-purple-500"
                  />
                  <input
                    type="tel"
                    value={newRiderPhone}
                    onChange={(e) => setNewRiderPhone(e.target.value)}
                    placeholder="Simu (Hiari: 07XX...)"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={!newRiderName.trim()}
                  onClick={handleAddCoRider}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Ongeza Msafiri</span>
                </button>
              </div>
            )}
          </div>

          {/* WhatsApp & Link Sharing Action Strip */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" />
                <span>Alika Wenzako Wajiunge</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                WhatsApp au SMS
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Tuma WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 px-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:bg-neutral-50 active:scale-95"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Imenakiliwa!' : 'Nakili Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 font-bold">
            Jumla: <span className="text-neutral-900 dark:text-neutral-100 font-mono font-black">TZS {calculation.discountedTotalFare.toLocaleString()}</span> ({passengerCount} Wasafiri)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shadow-purple-600/20"
          >
            Thibitisha Gawana ✓
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PapoShareSplitFareModal;
