import React, { useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { Ride } from '../../types/trip.types';
import { useTheme } from '../../ThemeContext';

interface RatingScreenProps {
  ride: Ride;
  onSubmit: (rating: number, feedback: string[]) => void;
  onSkip: () => void;
}

export const RatingScreen: React.FC<RatingScreenProps> = ({ ride, onSubmit, onSkip }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const chips = ['Salama', 'Haraka', 'Rafiki', 'Gari Safi', 'Njia Nzuri', 'Mpole'];

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => 
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  return (
    <div 
      className={`h-full w-full max-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none relative z-[60]`}
    >
      <div className="w-full flex-1 flex flex-col items-center justify-center max-w-sm mx-auto gap-2 sm:gap-2.5 my-auto">
        {/* Driver Photo & Verified Badge */}
        <div className="relative shrink-0">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-3 ${theme === 'dark' ? 'ring-indigo-950/60 bg-neutral-800 text-indigo-400' : 'ring-indigo-100 bg-neutral-100 text-indigo-600'} flex items-center justify-center text-xl font-black shadow-sm`}>
            {ride.driverInfo?.photo ? (
              <img src={ride.driverInfo.photo} alt={ride.driverInfo?.name || 'Driver'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              ride.driverInfo?.name?.charAt(0) || 'D'
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-lg border-2 border-white dark:border-neutral-900 shadow-md">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center">
          <h2 className={`text-sm sm:text-base font-black uppercase font-heading leading-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
            Je, safari ilikuwaje na {ride.driverInfo?.name?.split(' ')[0] || "Dereva"}?
          </h2>
          <p className="text-neutral-400 text-[8.5px] font-black uppercase tracking-widest mt-0.5">
            (Gusa nyota — 1 mpaka 5)
          </p>
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
              className="p-1 active:scale-125 transition-transform"
            >
              <Star 
                className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                  star <= (hovered || rating) 
                  ? 'fill-amber-500 text-amber-500' 
                  : (theme === 'dark' ? 'text-neutral-800 hover:text-neutral-700' : 'text-neutral-200 hover:text-neutral-300')
                }`} 
              />
            </button>
          ))}
        </div>

        {/* Chips Selector */}
        <div className="w-full">
          <p className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest text-center mb-1.5">
            Chagua (unaweza chagua mengi):
          </p>
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {chips.map((chip) => {
              const isSelected = selectedChips.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  className={`py-1.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all text-center ${
                    isSelected
                      ? (theme === 'dark' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-xs' : 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs')
                      : (theme === 'dark' ? 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-white border-neutral-200/80 text-neutral-500 hover:bg-neutral-50')
                  }`}
                >
                  [{chip}]
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment Box */}
        <div className="w-full">
          <p className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest mb-1">
            Maoni (hiari):
          </p>
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Andika maoni yako hapa..."
            rows={2}
            className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200 placeholder-neutral-500' : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'} border rounded-2xl p-2.5 text-xs font-medium outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none h-14 sm:h-16 transition-colors`}
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => rating > 0 && onSubmit(rating, selectedChips)}
            disabled={rating === 0}
            className="w-full h-11 sm:h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-md shadow-indigo-600/20 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center"
          >
            TUMA TATHMINI
          </button>

          <button
            type="button"
            onClick={onSkip}
            className={`text-[9.5px] font-bold uppercase tracking-wider text-center py-1 ${theme === 'dark' ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-700'} transition-colors`}
          >
            Ruka →
          </button>
        </div>
      </div>
    </div>
  );
};

