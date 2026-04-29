import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, ArrowRight, User, Heart } from 'lucide-react';
import { Parcel } from '../../../types/parcel';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';

interface Props {
  parcel: Parcel;
}

const RateRecipientScreen: React.FC<Props> = ({ parcel }) => {
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const tags = [
    'Mstaarabu', 'Mpole', 'Ushirikiano mzuri', 
    'Anapatikana haraka', 'Eneo linafikika', 'Ulinzi rafiki'
  ];

  const handleRate = async () => {
    if (rating === 0) {
      toast.error('Tafadhali weka nyota angalau moja');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'parcels', parcel.id), {
        status: 'rated',
        'rating.recipient': rating,
        'rating.tags': selectedTags,
        'rating.at': new Date().toISOString()
      });
      toast.success('Asante kwa mrejesho wako!');
    } catch (error) {
      toast.error('Hitilafu ilitokea');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex-1 overflow-y-auto p-8 space-y-12 pt-24 text-center">
         {/* Recipient Identity */}
         <div className="space-y-4">
            <div className="w-24 h-24 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto shadow-2xl relative">
                <User className="text-pink-500 w-12 h-12" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center border-4 border-[#0a0a0f]">
                    <Heart size={14} className="text-white fill-white" />
                </div>
            </div>
            <div>
               <h2 className="text-2xl font-black">{parcel.recipient.name}</h2>
               <p className="text-sm text-white/40 italic">Mteja wa leo</p>
            </div>
         </div>

         {/* Star Rating */}
         <section className="space-y-6">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Mpe Nyota Mpokeaji</h3>
            <div className="flex items-center justify-center gap-3">
               {[1, 2, 3, 4, 5].map((s) => (
                  <motion.button
                    key={s}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => setRating(s)}
                    className="p-1"
                  >
                     <Star 
                        className={`w-10 h-10 transition-all ${
                          rating >= s ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'text-white/10'
                        }`} 
                     />
                  </motion.button>
               ))}
            </div>
         </section>

         {/* Tags Section */}
         <section className="space-y-6">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Pata sifa zake</h3>
            <div className="flex flex-wrap justify-center gap-3">
               {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-6 py-3 rounded-full text-xs font-bold transition-all border ${
                      selectedTags.includes(tag) 
                      ? 'bg-pink-500 border-pink-500 text-white' 
                      : 'bg-white/5 border-white/5 text-white/40'
                    }`}
                  >
                     {tag}
                  </button>
               ))}
            </div>
         </section>
      </div>

      {/* Action Footer */}
      <div className="p-8 pb-12 bg-gradient-to-t from-[#0a0a0f] pt-12">
          <motion.button
            onClick={handleRate}
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-6 rounded-[24px] bg-pink-500 text-white font-black tracking-widest uppercase flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(236,72,153,0.2)]`}
          >
             {loading ? 'INASAFIRISHA...' : 'TUMA MREJESHO'}
             {!loading && <ArrowRight className="w-6 h-6" />}
          </motion.button>
          <button className="w-full mt-6 text-[10px] font-bold text-white/20 uppercase tracking-widest">
             RUKIA HATUA HII
          </button>
      </div>
    </div>
  );
};

export default RateRecipientScreen;
