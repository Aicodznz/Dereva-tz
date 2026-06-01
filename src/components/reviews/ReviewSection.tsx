import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Image as ImageIcon, X, Send, Loader2, Filter, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Review, ReviewReply } from '../../types';
import ReviewItem from './ReviewItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'product' | 'vendor' | 'service';
  isVendor?: boolean;
}

export default function ReviewSection({ targetId, targetType, isVendor }: ReviewSectionProps) {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<Record<string, ReviewReply[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  // Form State
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('targetId', '==', targetId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      
      // Sort client-side: prioritize server timestamps, then handle JS dates
      const sortedDocs = [...docs].sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toDate === 'function') return val.toDate().getTime(); // Firebase Timestamp
          if (val.seconds) return val.seconds * 1000;
          return new Date(val).getTime(); // ISO String
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });

      setReviews(sortedDocs);
      setLoading(false);
      
      // Fetch replies for these reviews
      sortedDocs.forEach(review => fetchReplies(review.id));
    }, (error) => {
      console.error("Firestore Error in ReviewSection:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [targetId]);

  const fetchReplies = (reviewId: string) => {
    const repliesRef = collection(db, 'review_replies');
    const q = query(repliesRef, where('reviewId', '==', reviewId));
    
    onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewReply));
      setReplies(prev => ({ ...prev, [reviewId]: docs }));
    }, (error) => {
      console.warn("Restricted access or error listening to review replies:", error.message);
    });
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Tafadhali ingia ili uandike maoni');
      return;
    }
    if (!newComment.trim()) {
      toast.error('Tafadhali andika maoni yako');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        targetId,
        targetType,
        userId: user.uid,
        userName: profile?.displayName || 'User',
        userPhoto: profile?.photoURL || '',
        rating: newRating,
        comment: newComment,
        images: photos,
        likes: [],
        createdAt: serverTimestamp()
      });
      
      toast.success('Asante kwa maoni yako!');
      setShowForm(false);
      setNewComment('');
      setNewRating(5);
      setPhotos([]);
    } catch (error) {
      console.error('Error adding review:', error);
      toast.error('Imeshindwa kutuma maoni');
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : 0;

  const filteredReviews = ratingFilter 
    ? reviews.filter(r => Math.round(r.rating) === ratingFilter)
    : reviews;

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse bg-neutral-100 dark:bg-neutral-800 h-40 rounded-[2.5rem]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-orange-600/5 dark:bg-orange-600/10 p-8 rounded-[3rem] border border-orange-600/10">
        <div className="space-y-2">
          <h3 className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter italic">
            {averageRating.toFixed(1)}
          </h3>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={`w-4 h-4 ${star <= Math.round(averageRating) ? 'fill-orange-600 text-orange-600' : 'text-neutral-300'}`} 
              />
            ))}
          </div>
          <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Kulingana na maoni {reviews.length}</p>
        </div>
        
        <div className="flex flex-col justify-center">
          <Button 
            onClick={() => setShowForm(true)}
            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-900/20 group"
          >
            Andika Maoni
            <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Button
          variant={ratingFilter === null ? 'default' : 'outline'}
          onClick={() => setRatingFilter(null)}
          className={`h-10 rounded-full text-xs font-black uppercase border-none transition-all ${
            ratingFilter === null ? 'bg-orange-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          Yote
        </Button>
        {[5, 4, 3, 2, 1].map((rating) => (
          <Button
            key={rating}
            variant={ratingFilter === rating ? 'default' : 'outline'}
            onClick={() => setRatingFilter(ratingFilter === rating ? null : rating)}
            className={`h-10 rounded-full text-xs font-black uppercase border-none flex items-center gap-2 transition-all ${
              ratingFilter === rating ? 'bg-orange-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {rating} <Star className="w-3 h-3 fill-current" />
          </Button>
        ))}
      </div>

      {/* Write Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-neutral-900 p-8 rounded-[3rem] border-2 border-orange-600 shadow-2xl relative"
          >
            <button 
              onClick={() => setShowForm(false)}
              className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic mb-6">Leta Mapendekezo</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Ukadiriaji</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="transition-transform active:scale-90"
                    >
                      <Star 
                        className={`w-8 h-8 ${star <= newRating ? 'fill-orange-600 text-orange-600' : 'text-neutral-200'}`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Maoni yako</p>
                <Textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Elezea uzoefu wako..."
                  className="min-h-[120px] bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl resize-none focus-visible:ring-orange-600"
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Picha (Hiari)</p>
                <div className="flex gap-2">
                  <button className="w-16 h-16 rounded-2xl border-2 border-dashed border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-orange-600 hover:border-orange-600 transition-all">
                    <ImageIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-14 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-black uppercase tracking-widest shadow-xl"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tuma Maoni'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-950/20 rounded-[3rem] border-2 border-dashed border-neutral-100 dark:border-neutral-800">
            <MessageSquare className="w-12 h-12 text-neutral-200 dark:text-neutral-800 mx-auto mb-4" />
            <p className="text-neutral-500 font-bold">Hakuna maoni bado. Kuwa wa kwanza!</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <ReviewItem 
              key={review.id} 
              review={review} 
              replies={replies[review.id]}
              isVendor={isVendor}
            />
          ))
        )}
      </div>
    </div>
  );
}
