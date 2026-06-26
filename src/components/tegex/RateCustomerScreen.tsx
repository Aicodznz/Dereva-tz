import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Heart, MessageSquare, FastForward } from 'lucide-react';
import { Ride } from '../../types/ride.types';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from 'next-themes';

interface RateCustomerScreenProps {
  ride: Ride;
  onDone: () => void;
}

const TAGS = ['Salama', 'Mtupoa', 'Safi', 'Mzuri', 'Mpole'];

export default function RateCustomerScreen({ ride, onDone }: RateCustomerScreenProps) {
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!ride.id) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'rides', ride.id), {
        customerRating: { stars: rating, tags: selectedTags },
        fullyCompleted: true,
        updatedAt: serverTimestamp()
      });
      
      // Update customer aggregate rating in users collection
      if (ride.customerId) {
        const userRef = doc(db, 'users', ride.customerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentRating = userData.rating !== undefined ? Number(userData.rating) : 5.0;
          const currentCount = userData.ratingCount !== undefined ? Number(userData.ratingCount) : 0;
          
          const newCount = currentCount + 1;
          const newRating = ((currentRating * currentCount) + rating) / newCount;
          
          await updateDoc(userRef, {
            rating: parseFloat(newRating.toFixed(1)),
            ratingCount: newCount,
            updatedAt: serverTimestamp()
          });
        }
      }
      
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
      className={`fixed inset-0 z-[3000] ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-neutral-50'} flex flex-col p-6 overflow-y-auto`}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-12 py-10">
        <div className="text-center">
           <h2 className={`text-3xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'} leading-none mb-2`}>Tathmini Mteja Wako</h2>
           <p className="text-neutral-500 font-bold">Mrejesho wako unatusaidia kuwahudumia bora zaidi</p>
        </div>

        <div className="flex flex-col items-center gap-4">
           <div className={`w-32 h-32 rounded-[40px] border overflow-hidden p-2 shadow-sm ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200'}`}>
              <div className={`w-full h-full rounded-[30px] overflow-hidden relative ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
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
                      className={`w-10 h-10 ${rating >= star ? 'text-amber-500 fill-amber-500' : (theme === 'dark' ? 'text-neutral-800 hover:text-neutral-700' : 'text-neutral-200 hover:text-neutral-300')}`} 
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
                   className={`px-6 py-3 rounded-2xl border-2 font-black italic text-sm transition-all ${selectedTags.includes(tag) ? (theme === 'dark' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400 shadow-sm' : 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm') : (theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50')}`}
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
          className={`w-1/3 h-16 rounded-3xl border-2 font-black uppercase italic transition-colors ${theme === 'dark' ? 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-350' : 'border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'}`}
        >
          RUKA
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase italic text-lg shadow-lg shadow-indigo-600/10"
        >
          {isSubmitting ? 'Inatuma...' : 'TUMA'}
        </button>
      </div>
    </motion.div>
  );
}
