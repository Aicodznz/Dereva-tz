import React, { useState } from 'react';
import { Star, ThumbsUp, MessageSquare, MoreVertical, Reply, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Review, ReviewReply } from '../../types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReviewItemProps {
  review: Review;
  replies?: ReviewReply[];
  onLike?: (id: string) => void;
  onReply?: (id: string) => void;
  isVendor?: boolean;
}

export default function ReviewItem({ review, replies = [], onLike, onReply, isVendor }: ReviewItemProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const isUserLiked = review.likes?.includes(review.userId) || false;

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(review.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-800 shadow-sm">
            <img 
              src={review.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.userId}`} 
              alt={review.userName} 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-neutral-900 dark:text-white leading-none tracking-tight">{review.userName}</h4>
            </div>
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
              {review.createdAt ? format(new Date(review.createdAt), 'MMM dd, yyyy') : 'Recently'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-full">
          <Star className="w-3 h-3 text-orange-600 fill-orange-600" />
          <span className="text-xs font-black text-orange-600 leading-none">{review.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
          {review.comment}
        </p>

        {/* Photos */}
        {review.images && review.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {review.images.map((photo, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05 }}
                className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white dark:border-neutral-800 shadow-sm cursor-zoom-in"
              >
                <img src={photo} alt={`Review ${i}`} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors ${
              isLiked ? 'text-orange-600' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-orange-600' : ''}`} />
            <span>{(review.likes?.length || 0) + (isLiked && !isUserLiked ? 1 : 0)} Helpful</span>
          </button>
          
          <button 
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{replies.length} Replies</span>
          </button>
        </div>

        {isVendor && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onReply?.(review.id)}
            className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50"
          >
            <Reply className="w-3 h-3 mr-1" />
            Reply
          </Button>
        )}
      </div>

      {/* Replies Section */}
      <AnimatePresence>
        {showReplies && replies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-6 border-l-2 border-neutral-100 dark:border-neutral-800 mt-4 space-y-4">
              {replies.map((reply) => (
                <div key={reply.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-neutral-900 dark:text-white uppercase italic">
                      {reply.userName}
                    </span>
                    <Badge className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase border-none hover:bg-blue-100">
                      Vendor
                    </Badge>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-auto">
                      {reply.createdAt ? format(new Date(reply.createdAt), 'MMM dd') : 'Recently'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                    {reply.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
