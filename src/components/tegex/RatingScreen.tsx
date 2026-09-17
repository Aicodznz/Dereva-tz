import React, { useState, useEffect } from 'react';
import { Star, CheckCircle2, Heart, DollarSign, Sparkles, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Ride } from '../../types/trip.types';
import { useTheme } from '../../ThemeContext';
import { 
  getLocalFavoriteDrivers, 
  saveCustomerFavoriteDriver, 
  removeCustomerFavoriteDriver 
} from '../../utils/customerPreferences';

interface RatingScreenProps {
  ride: Ride;
  onSubmit: (rating: number, feedback: string[], comment?: string, tipAmount?: number) => void;
  onSkip: () => void;
}

export const RatingScreen: React.FC<RatingScreenProps> = ({ ride, onSubmit, onSkip }) => {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [selectedChips, setSelectedChips] = useState<string[]>(['Salama', 'Gari Safi']);
  const [comment, setComment] = useState('');
  const [tipAmount, setTipAmount] = useState<number>(1000); // Default friendly 1,000 TZS tip
  const [customTip, setCustomTip] = useState<string>('');
  const [isCustomTip, setIsCustomTip] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    const list = getLocalFavoriteDrivers();
    const isFav = list.some(
      d => (ride.driverId && d.driverId === ride.driverId) || (ride.driverInfo?.phone && d.phone === ride.driverInfo.phone)
    );
    setIsFavorite(isFav);
  }, [ride]);

  const handleToggleFavorite = async () => {
    const driverName = ride.driverInfo?.name || (ride as any).driverName;
    if (!driverName) {
      toast.error('Taarifa za dereva hazijapatikana');
      return;
    }

    const driverPhone = ride.driverInfo?.phone || (ride as any).driverPhone || '0700000000';

    if (isFavorite) {
      const list = getLocalFavoriteDrivers();
      const match = list.find(
        d => (ride.driverId && d.driverId === ride.driverId) || (driverPhone && d.phone === driverPhone)
      );
      if (match) {
        await removeCustomerFavoriteDriver(match.id, ride.customerId);
        setIsFavorite(false);
        toast.info(`${driverName} ameondolewa kwenye madereva unaowapenda.`);
      }
    } else {
      await saveCustomerFavoriteDriver(
        {
          driverId: ride.driverId,
          name: driverName,
          phone: driverPhone,
          photo: ride.driverInfo?.photo,
          vehicleType: ride.vehicleType || 'mini',
          vehiclePlate: ride.driverInfo?.vehicle?.plate || (ride as any).vehiclePlate || 'T 842 DKP',
          vehicleModel: ride.driverInfo?.vehicle?.model || (ride as any).vehicleModel || 'Toyota IST',
          vehicleColor: ride.driverInfo?.vehicle?.color,
          rating: ride.driverInfo?.rating || (ride as any).driverRating || 5,
          notes: 'Alitoa huduma nzuri na salama.',
        },
        ride.customerId
      );
      setIsFavorite(true);
      toast.success(`${driverName} amehifadhiwa kwenye Madereva Ninaowapenda! ❤️`);
    }
  };

  const chips = [
    { id: 'Salama', label: 'Uendeshaji Salama 🛡️' },
    { id: 'Gari Safi', label: 'Gari Safi ✨' },
    { id: 'Mstaarabu', label: 'Mstaarabu & Mpole 😊' },
    { id: 'Haraka', label: 'Haraka & Wakati ⚡' },
    { id: 'Njia Nzuri', label: 'Njia Nzuri 🗺️' },
    { id: 'Muziki Mzuri', label: 'Muziki Mzuri 🎵' },
  ];

  const toggleChip = (chipId: string) => {
    setSelectedChips(prev => 
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    );
  };

  const tipOptions = [
    { label: 'Bila Tip', value: 0 },
    { label: '+500', value: 500 },
    { label: '+1,000', value: 1000 },
    { label: '+2,000', value: 2000 },
    { label: '+5,000', value: 5000 },
  ];

  const currentScore = hovered || rating;
  const ratingLabels: Record<number, string> = {
    1: 'Haikuridhisha 😕',
    2: 'Inahitaji Maboresho 😐',
    3: 'Nzuri / Wastani 🙂',
    4: 'Nzuri Sana! 😃',
    5: 'Huduma Bora Kabisa! 🌟✨',
  };

  const effectiveTip = isCustomTip ? (parseInt(customTip) || 0) : tipAmount;
  const driverDisplayName = ride.driverInfo?.name || (ride as any).driverName || "Dereva";

  return (
    <div 
      className={`h-full w-full max-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col justify-between p-3 sm:p-5 overflow-y-auto select-none relative z-[60]`}
    >
      <div className="w-full flex-1 flex flex-col items-center justify-center max-w-sm mx-auto gap-2.5 my-auto py-2">
        {/* Driver Photo & Verified Badge */}
        <div className="relative shrink-0 mt-1">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-3 ${theme === 'dark' ? 'ring-indigo-950/60 bg-neutral-800 text-indigo-400' : 'ring-indigo-100 bg-neutral-100 text-indigo-600'} flex items-center justify-center text-xl font-black shadow-sm`}>
            {ride.driverInfo?.photo ? (
              <img src={ride.driverInfo.photo} alt={driverDisplayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              driverDisplayName.charAt(0) || 'D'
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-lg border-2 border-white dark:border-neutral-900 shadow-md">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center">
          <h2 className={`text-sm sm:text-base font-black uppercase font-heading leading-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
            Je, safari ilikuwaje na {driverDisplayName.split(' ')[0]}?
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="text-[11px] font-black text-amber-500 dark:text-amber-400">
              {ratingLabels[currentScore] || 'Gusa nyota kupima'}
            </span>
          </div>
        </div>

        {/* Stars Row */}
        <div className="flex items-center gap-2 sm:gap-3 py-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="p-1 active:scale-125 transition-transform cursor-pointer"
            >
              <Star 
                className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                  star <= currentScore 
                  ? 'fill-amber-500 text-amber-500 drop-shadow-sm' 
                  : (theme === 'dark' ? 'text-neutral-800 hover:text-neutral-700' : 'text-neutral-200 hover:text-neutral-300')
                }`} 
              />
            </button>
          ))}
        </div>

        {/* Favorite Driver Toggle Pill */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          className={`px-3 py-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all active:scale-95 shadow-xs cursor-pointer ${
            isFavorite 
              ? 'bg-rose-600 text-white border-rose-600 shadow-rose-500/25'
              : (theme === 'dark' 
                ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-rose-500/50 hover:text-rose-400' 
                : 'bg-white border-neutral-200 text-neutral-700 hover:border-rose-300 hover:text-rose-600')
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white text-white' : 'text-rose-500'}`} />
          <span>{isFavorite ? 'Dereva Wangu Mpendwa ❤️' : 'Hifadhi Dereva Ninayempenda'}</span>
        </button>

        {/* 4. BAKSHISHI / TIP YA DEREVA */}
        <div className="w-full p-2.5 rounded-2xl bg-neutral-100/90 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Toa Bakshishi / Tip kwa Dereva</span>
            </span>
            <span className="text-[10px] font-extrabold text-neutral-700 dark:text-neutral-300">
              {effectiveTip > 0 ? `+TZS ${effectiveTip.toLocaleString()}` : 'Hiari'}
            </span>
          </div>

          {/* Quick Tip Chips */}
          <div className="grid grid-cols-5 gap-1">
            {tipOptions.map((opt) => {
              const isSelected = !isCustomTip && tipAmount === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setIsCustomTip(false);
                    setTipAmount(opt.value);
                  }}
                  className={`py-1.5 px-0.5 rounded-xl text-[9.5px] font-black border transition-all text-center cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : (theme === 'dark' 
                        ? 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:bg-neutral-700' 
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50')
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Custom Tip Input Toggle */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setIsCustomTip(!isCustomTip)}
              className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
            >
              {isCustomTip ? '← Chagua viwango vilivyopo' : 'Au weka kiasi kingine'}
            </button>
            {isCustomTip && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-neutral-500">TZS</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="Mfano: 3000"
                  className="w-24 p-1 text-xs font-bold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Chips Selector (Sifa za Safari) */}
        <div className="w-full">
          <p className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest text-center mb-1.5">
            Sifa za safari (chagua unazopenda):
          </p>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            {chips.map((chip) => {
              const isSelected = selectedChips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleChip(chip.id)}
                  className={`py-1.5 px-2 rounded-xl text-[9.5px] font-black tracking-wide border transition-all text-left flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? (theme === 'dark' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-xs' : 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs')
                      : (theme === 'dark' ? 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-white border-neutral-200/80 text-neutral-500 hover:bg-neutral-50')
                  }`}
                >
                  <ThumbsUp className={`w-3 h-3 shrink-0 ${isSelected ? 'text-emerald-500' : 'text-neutral-400'}`} />
                  <span className="truncate">{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment Box */}
        <div className="w-full">
          <p className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest mb-1">
            Ujumbe / Maoni kwa Dereva (hiari):
          </p>
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Andika ujumbe wa pongezi au maoni..."
            rows={2}
            className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200 placeholder-neutral-500' : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'} border rounded-2xl p-2.5 text-xs font-medium outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none h-12 sm:h-14 transition-colors`}
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => rating > 0 && onSubmit(rating, selectedChips, comment, effectiveTip)}
            disabled={rating === 0}
            className="w-full h-11 sm:h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-md shadow-indigo-600/20 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>TUMA TATHMINI</span>
            {effectiveTip > 0 && (
              <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[9.5px]">
                +TZS {effectiveTip.toLocaleString()} TIP
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onSkip}
            className={`text-[9.5px] font-bold uppercase tracking-wider text-center py-1 ${theme === 'dark' ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-700'} transition-colors cursor-pointer`}
          >
            Ruka Sasa →
          </button>
        </div>
      </div>
    </div>
  );
};


