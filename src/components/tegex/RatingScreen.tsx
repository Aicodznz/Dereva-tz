import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle2, ArrowRight } from 'lucide-react';
import { Ride } from '../../types/trip.types';

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

  const chips = ['Salama', 'Haraka', 'Rafiki', 'Gari Safi', 'Njia Nzuri'];

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => 
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  return (
    <div 
      className="flex-1 w-full bg-[#0a0a0f] flex flex-col p-8 overflow-y-auto no-scrollbar relative z-[60]"
    >
      <div className="w-full flex-1 flex flex-col items-center justify-center py-10">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#7F77DD]/20 bg-[#111118] flex items-center justify-center text-3xl font-black text-[#7F77DD]">
            {ride.driverInfo?.photo ? <img src={ride.driverInfo.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : ride.driverInfo?.name.charAt(0)}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-[#1D9E75] text-white p-2 rounded-xl border-2 border-[#0a0a0f]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-center text-[#f0eeff] mb-2 leading-tight">
          Je, {ride.driverInfo?.name || "Dereva"} alikuwaje?
        </h2>
        <p className="text-[#6b6b8a] text-xs font-bold mb-10 text-center px-4">Shiriki uzoefu wako ili kusaidia kuboresha safari zijazo</p>

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
                  ? 'fill-[#D85A30] text-[#D85A30]' 
                  : 'text-[#1e1e2e]'
                }`} 
              />
            </button>
          ))}
        </div>

        {/* Chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => toggleChip(chip)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                selectedChips.includes(chip)
                ? 'bg-[#1D9E75]/20 border-[#1D9E75] text-[#1D9E75]'
                : 'bg-[#111118] border-[#1e1e2e] text-[#6b6b8a]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Comment Box */}
        <div className="w-full mb-8">
           <textarea 
             value={comment}
             onChange={(e) => setComment(e.target.value)}
             placeholder="Tuambie zaidi (hiari)..."
             className="w-full bg-[#111118] border border-[#1e1e2e] rounded-3xl p-5 text-sm font-bold text-[#f0eeff] placeholder-[#6b6b8a] outline-none focus:border-[#7F77DD]/30 resize-none h-32 transition-colors"
           />
        </div>

        <button
          onClick={() => rating > 0 && onSubmit(rating, selectedChips)}
          disabled={rating === 0}
          className="w-full h-16 bg-[#7F77DD] text-white rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-[0_10px_30px_rgba(127,119,221,0.3)] disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          Kamilisha kwa Tuma
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={onSkip}
          className="mt-8 text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest hover:text-[#f0eeff] transition-colors"
        >
          Ruka kwa Sasa
        </button>
      </div>
    </div>
  );
};
