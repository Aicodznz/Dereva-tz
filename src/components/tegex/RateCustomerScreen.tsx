import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Heart, MessageSquare, FastForward } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface RateCustomerScreenProps {
  ride: Ride;
  onDone: () => void;
}

const TAGS = ['Mpole', 'Mwepesi', 'Safi', 'Mzuri', 'Hana Tabu'];

export default function RateCustomerScreen({ ride, onDone }: RateCustomerScreenProps) {
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'rides', ride.id), {
        customerRating: { stars: rating, tags: selectedTags },
        fullyCompleted: true,
        updatedAt: serverTimestamp()
      });
      
      onDone();
    } catch (e) {
      console.error("Rating submission failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[3000] bg-[#0a0a0f] flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-12 py-10">
        <div className="text-center">
           <h2 className="text-3xl font-black italic tracking-tighter text-white leading-none mb-2">Tathmini Mteja Wako</h2>
           <p className="text-neutral-500 font-bold">Mrejesho wako unatusaidia kuwahudumia bora zaidi</p>
        </div>

        <div className="flex flex-col items-center gap-4">
           <div className="w-32 h-32 rounded-[40px] bg-[#111118] border border-[#1e1e2e] overflow-hidden p-2">
              <div className="w-full h-full rounded-[30px] bg-neutral-800 overflow-hidden relative">
                 <img 
                   src={ride.customerInfo?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ride.customerId}`} 
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center">
                    <p className="text-xs font-black italic text-white truncate">{ride.customerInfo?.name}</p>
                 </div>
              </div>
           </div>
           
           <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                 <button 
                   key={star}
                   onClick={() => setRating(star)}
                   className="p-1 active:scale-125 transition-transform"
                 >
                    <Star 
                      className={`w-10 h-10 ${rating >= star ? 'text-amber-500 fill-amber-500' : 'text-neutral-800'}`} 
                    />
                 </button>
              ))}
           </div>
        </div>

        <div className="w-full">
           <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest text-center mb-4">LEBO ZA MTEJA</p>
           <div className="flex flex-wrap justify-center gap-3">
              {TAGS.map(tag => (
                 <button
                   key={tag}
                   onClick={() => toggleTag(tag)}
                   className={`px-6 py-3 rounded-2xl border-2 font-black italic text-sm transition-all ${selectedTags.includes(tag) ? 'bg-[#7F77DD]/10 border-[#7F77DD] text-[#7F77DD]' : 'bg-[#111118] border-[#1e1e2e] text-neutral-500'}`}
                 >
                    {tag}
                 </button>
              ))}
           </div>
        </div>
      </div>

      <div className="flex gap-4 mt-auto">
        <button 
          onClick={onDone}
          className="w-1/3 h-16 rounded-3xl border-2 border-[#1e1e2e] text-neutral-500 font-black uppercase italic"
        >
          RUKA
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 h-16 rounded-3xl bg-[#7F77DD] text-white font-black uppercase italic text-lg shadow-[0_20px_50px_rgba(127,119,221,0.3)]"
        >
          {isSubmitting ? 'Inatuma...' : 'TUMA'}
        </button>
      </div>
    </motion.div>
  );
}
