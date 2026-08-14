import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle2, ArrowRight } from 'lucide-react';
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
      className={`h-full w-full ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col p-8 overflow-y-auto no-scrollbar relative z-[60]`}
    >
      <div className="w-full flex-1 flex flex-col items-center justify-center py-10">
        <div className="relative mb-8">
          <div className={`w-24 h-24 rounded-full overflow-hidden ring-4 ${theme === 'dark' ? 'ring-indigo-950/40 bg-neutral-800 text-indigo-400' : 'ring-indigo-100 bg-neutral-100 text-indigo-600'} flex items-center justify-center text-3xl font-black`}>
            {ride.driverInfo?.photo ? <img src={ride.driverInfo.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : ride.driverInfo?.name?.charAt(0) || 'D'}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2 rounded-xl border-2 border-white shadow-md">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <h2 className={`text-2xl font-black text-center ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'} mb-2 leading-tight italic uppercase`}>
          Je, safari ilikuwaje na {ride.driverInfo?.name.split(' ')[0] || "Dereva"}?
        </h2>
        <p className="text-neutral-400 text-[10px] font-black uppercase tracking-widest mb-10 text-center px-4 italic">
          (gusa nyota — 1 mpaka 5)
        </p>

        {/* Stars */}
        <div className="flex gap-4 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="p-1 active:scale-125 transition-transform"
            >
              <Star 
                className={`w-10 h-10 transition-colors ${
                  star <= (hovered || rating) 
                  ? 'fill-amber-500 text-amber-500' 
                  : (theme === 'dark' ? 'text-neutral-800 hover:text-neutral-700' : 'text-neutral-200 hover:text-neutral-300')
                }`} 
              />
            </button>
          ))}
        </div>

        <div className="w-full mb-4">
           <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center mb-4">Chagua (unaweza chagua mengi):</p>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => toggleChip(chip)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                selectedChips.includes(chip)
                ? (theme === 'dark' ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400 font-bold' : 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold')
                : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')
              }`}
            >
              [{chip}]
            </button>
          ))}
        </div>

        {/* Comment Box */}
        <div className="w-full mb-8">
           <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">Maoni (hiari):</p>
           <textarea 
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             placeholder="Andika maoni yako hapa..."
             className={`w-full ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-200 placeholder-neutral-550' : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'} border rounded-3xl p-5 text-sm font-bold outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 resize-none h-32 transition-colors`}
           />
        </div>

        <div className="w-full flex flex-col gap-4">
          <button
            onClick={() => rating > 0 && onSubmit(rating, selectedChips)}
            disabled={rating === 0}
            className="w-full h-16 bg-indigo-600 text-white rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-indigo-600/10 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            TUMA TATHMINI
          </button>

          <button
            onClick={onSkip}
            className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'} transition-colors`}
          >
            Ruka →
          </button>
        </div>
      </div>
    </div>
  );
}
