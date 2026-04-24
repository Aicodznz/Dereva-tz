import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
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

  const chips = ['Salama', 'Haraka', 'Rafiki', 'Gari Safi', 'Njia Nzuri'];

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => 
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 z-[60] bg-[#0a0a0f] flex flex-col items-center justify-center p-8 overflow-hidden"
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#7F77DD]/30 bg-[#111118] flex items-center justify-center text-3xl font-black text-[#7F77DD] mb-6">
          {ride.driverInfo?.photo ? <img src={ride.driverInfo.photo} className="w-full h-full object-cover" /> : ride.driverInfo?.name.charAt(0)}
        </div>

        <h2 className="text-xl font-black text-center text-[#f0eeff] mb-2 leading-tight">
          Je, safari ilikuwaje na<br /><span className="text-[#7F77DD]">{ride.driverInfo?.name || "Dereva"}</span>?
        </h2>
        <p className="text-[#6b6b8a] text-xs font-bold mb-10">Maoni yako yanatusaidia kuboresha huduma</p>

        {/* Stars */}
        <div className="flex gap-3 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform active:scale-90"
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
                ? 'bg-[#7F77DD]/20 border-[#7F77DD] text-[#7F77DD]'
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
             placeholder="Ongeza maoni..."
             className="w-full bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4 text-sm font-bold text-[#f0eeff] placeholder-[#6b6b8a] outline-none focus:border-[#7F77DD]/50 resize-none h-24"
           />
        </div>

        <button
          onClick={() => rating > 0 && onSubmit(rating, selectedChips)}
          disabled={rating === 0}
          className="w-full h-14 bg-white text-[#0a0a0f] rounded-[50px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl disabled:opacity-20 transition-all active:scale-95"
        >
          Tuma Rating →
        </button>

        <button
          onClick={onSkip}
          className="mt-6 text-[10px] font-black text-[#6b6b8a] uppercase tracking-widest hover:text-[#f0eeff] transition-colors"
        >
          Ruka
        </button>
      </div>
    </motion.div>
  );
};
