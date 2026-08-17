import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Sparkles, 
  Gift, 
  CheckCircle2, 
  X, 
  Coins, 
  Zap, 
  Store, 
  Search, 
  Loader2,
  HelpCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorProfile, CustomerLoyaltyCard } from '../types';
import { loyaltyService } from '../services/loyaltyService';

interface LoyaltyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorProfile;
  initialPhone?: string;
  onApplyRewardDiscount?: (discountAmount: number, description: string) => void;
}

export const LoyaltyCardModal: React.FC<LoyaltyCardModalProps> = ({
  isOpen,
  onClose,
  vendor,
  initialPhone = '',
  onApplyRewardDiscount
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [card, setCard] = useState<CustomerLoyaltyCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loyaltyConfig = vendor?.loyaltyProgram || {
    enabled: true,
    programType: 'stamps',
    stampsRequired: 5,
    rewardDescription: 'Mlo au Kinywaji cha 6 BURE!',
    pointsPer1000Tzs: 10,
    pointValueTzs: 1
  };

  const totalSlots = loyaltyConfig.stampsRequired || 5;

  // Search card on open if phone provided
  useEffect(() => {
    if (isOpen && initialPhone) {
      setPhoneNumber(initialPhone);
      handleSearchCard(initialPhone);
    }
  }, [isOpen, initialPhone]);

  if (!isOpen) return null;

  const handleSearchCard = async (overridePhone?: string) => {
    const target = (overridePhone || phoneNumber).replace(/[^0-9]/g, '');
    if (!target || target.length < 9) {
      toast.error('Weka nambari sahihi ya simu (mfano 0712345678)');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await loyaltyService.getLoyaltyCard(vendor.id!, target);
      setCard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStamps = card?.currentStamps || 0;
  const availableRewards = card?.availableRewards || 0;
  const currentPoints = card?.currentPoints || 0;
  const stampsRemaining = Math.max(0, totalSlots - currentStamps);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border border-amber-500/40 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-950/50 text-black font-black shrink-0">
            <Award className="w-6 h-6 text-black" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              Kadi ya Uaminifu & Stempu
            </h3>
            <p className="text-xs text-neutral-400 font-medium">
              {vendor.businessName || 'Mgahawa'} • Kusanya stempu na upate zawadi BURE!
            </p>
          </div>
        </div>

        {/* Phone Lookup Input if not loaded */}
        <div className="mb-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
            Namba ya Simu ya Mteja:
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Mfano: 0712345678"
              className="flex-1 bg-black/60 border border-neutral-800 focus:border-amber-500 h-12 px-4 rounded-2xl text-white font-bold text-sm placeholder:text-neutral-600 focus:outline-none"
            />
            <Button
              type="button"
              onClick={() => handleSearchCard()}
              disabled={isLoading}
              className="h-12 px-5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black uppercase text-xs rounded-2xl cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Search className="w-4 h-4 text-black" />}
            </Button>
          </div>
        </div>

        {/* The Digital Stamp Card Component */}
        <div 
          className="p-6 rounded-3xl border relative overflow-hidden shadow-2xl text-amber-100"
          style={{
            background: 'radial-gradient(ellipse at top, #2b1809 0%, #150d06 50%, #080503 100%)',
            borderColor: '#f59e0b80',
            boxShadow: '0 0 35px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <span className="text-[9px] font-mono tracking-widest uppercase text-amber-400 font-bold block">
                VIP REWARD PASS
              </span>
              <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white drop-shadow-md">
                {vendor.businessName || 'MGAHAWA'}
              </h4>
            </div>

            <Badge className="bg-amber-500 text-black font-black text-[9px] uppercase px-2.5 py-0.5">
              {loyaltyConfig.programType === 'points' ? 'Cashback Points' : 'Stamps Card'}
            </Badge>
          </div>

          {/* Stamp slots grid */}
          <div className="py-3">
            <p className="text-[10px] text-neutral-300 font-medium mb-3 text-center">
              Nunua mara {totalSlots} na ujishindie: <strong className="text-amber-300">{loyaltyConfig.rewardDescription}</strong>
            </p>

            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
              {Array.from({ length: totalSlots }).map((_, i) => {
                const isStamped = i < currentStamps;
                const isRewardSlot = i === totalSlots - 1;

                return (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.08 }}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-all relative ${
                      isStamped 
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-300 text-black shadow-lg shadow-amber-950/60' 
                        : isRewardSlot 
                          ? 'bg-amber-950/40 border-dashed border-amber-500/60 text-amber-400' 
                          : 'bg-black/40 border-neutral-700/60 text-neutral-500'
                    }`}
                  >
                    {isStamped ? (
                      <>
                        <Sparkles className="w-5 h-5 text-black" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-black mt-0.5">
                          STEMPU #{i + 1}
                        </span>
                      </>
                    ) : isRewardSlot ? (
                      <>
                        <Gift className="w-5 h-5 text-amber-400 animate-bounce" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-amber-300">
                          BURE! 🎁
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-black text-neutral-600">{i + 1}</span>
                        <span className="text-[7.5px] uppercase font-bold text-neutral-600">Agiza</span>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Progress summary banner */}
          <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-neutral-400 text-[11px] block">
                {currentStamps === 0 && !card 
                  ? 'Kadi mpya (bado haina stempu)' 
                  : stampsRemaining === 0 
                    ? '🎉 Hongera! Kadi yako imekamilika!' 
                    : `Umebakisha oda ${stampsRemaining} tu kupata zawadi!`}
              </span>
              {card && card.currentPoints > 0 && (
                <span className="text-amber-300 font-bold text-[10px] flex items-center gap-1 mt-0.5">
                  <Coins className="w-3 h-3 text-amber-400" /> Pointi Zako: {card.currentPoints} pts (= TZS {(card.currentPoints * (loyaltyConfig.pointValueTzs || 1)).toLocaleString()})
                </span>
              )}
            </div>

            {availableRewards > 0 && (
              <div className="bg-emerald-500/20 border border-emerald-500/50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-emerald-300 font-black text-[10px] uppercase">
                <Gift className="w-3.5 h-3.5" /> Zawadi {availableRewards} Tayari!
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          {availableRewards > 0 && onApplyRewardDiscount && (
            <Button
              type="button"
              onClick={() => {
                onApplyRewardDiscount(5000, `Zawadi ya Uaminifu (${loyaltyConfig.rewardDescription})`);
                toast.success('🎉 Zawadi yako ya Bure imetumika kwenye bili hii!');
                onClose();
              }}
              className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" /> Tumia Zawadi Yako ya BURE Kwenye Oda Hii!
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full h-12 border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white font-black uppercase text-xs rounded-2xl cursor-pointer"
          >
            Funga Kadi
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
