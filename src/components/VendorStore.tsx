import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, MapPin, Clock, Phone, Info, 
  ShoppingBag, Plus, Camera, X, MessageSquare,
  ThumbsUp, Share2, Trash2, Reply, ShoppingBasket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useCart } from '../CartContext';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';

interface ReviewReply {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: any;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  targetId: string;
  targetType: 'vendor' | 'product';
  rating: number;
  comment: string;
  images: string[];
  likes?: string[];
  replies?: ReviewReply[];
  createdAt: any;
}

export default function VendorStore() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'info'>('products');

  // Review Form State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reply State
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [tableSession, setTableSession] = useState<any>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('papo_hapo_table_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      if (session.vendorId === id) {
        setTableSession(session);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const fetchVendor = async () => {
      try {
        const vSnap = await getDoc(doc(db, 'vendors', id));
        if (vSnap.exists()) {
          setVendor({ id: vSnap.id, ...vSnap.data() } as VendorProfile);
        }
      } catch (error) {
        console.error('Error fetching vendor:', error);
      }
    };

    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('vendorId', '==', id));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
        setLoading(false);
      }
    };

    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, 'reviews'),
          where('targetId', '==', id),
          where('targetType', '==', 'vendor')
        );
        const snap = await getDocs(q);
        const reviewsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        
        // Sort client-side to avoid index requirement
        const sortedReviewsData = reviewsData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        // Fetch replies for each review
        const reviewsWithReplies = await Promise.all(sortedReviewsData.map(async (review) => {
          const rq = query(
            collection(db, 'review_replies'),
            where('reviewId', '==', review.id)
          );
          const rSnap = await getDocs(rq);
          const repliesData = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewReply));
          
          // Sort client-side
          const sortedReplies = repliesData.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB;
          });

          return { ...review, replies: sortedReplies };
        }));

        setReviews(reviewsWithReplies);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }
    };

    fetchVendor();
    fetchProducts();
    fetchReviews();

    const pUnsub = onSnapshot(
      query(collection(db, 'products'), where('vendorId', '==', id)), 
      () => fetchProducts(),
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );
    const rUnsub = onSnapshot(
      query(collection(db, 'reviews'), where('targetId', '==', id), where('targetType', '==', 'vendor')), 
      () => fetchReviews(),
      (error) => handleFirestoreError(error, OperationType.LIST, 'reviews')
    );

    return () => {
      pUnsub();
      rUnsub();
    };
  }, [id]);

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0 || !user) return;
    setIsUploading(true);
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        const path = storageService.getReviewPath(user.uid, file.name);
        const publicUrl = await storageService.uploadFile('reviews', path, file);
        setReviewImages(prev => [...prev, publicUrl]);
      } catch (error) {
        toast.error('Imeshindwa kupakia picha');
      }
    }
    setIsUploading(false);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Tafadhali ingia ili uweze kutoa maoni');
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        userName: user.displayName || 'Mteja',
        userPhoto: user.photoURL || '',
        targetId: id,
        targetType: 'vendor',
        rating,
        comment,
        images: reviewImages,
        likes: [],
        createdAt: new Date().toISOString()
      });

      toast.success('Asante kwa maoni yako!');
      setIsReviewModalOpen(false);
      setComment('');
      setRating(5);
      setReviewImages([]);
    } catch (error) {
      console.error('Create review error:', error);
    }
  };

  const handleLikeReview = async (reviewId: string, isLiked: boolean) => {
    if (!user) {
      toast.error('Tafadhali ingia ili uweze kulike');
      return;
    }

    try {
      const review = reviews.find(r => r.id === reviewId);
      if (!review) return;

      const newLikes = isLiked 
        ? (review.likes || []).filter(uid => uid !== user.uid)
        : [...(review.likes || []), user.uid];

      await updateDoc(doc(db, 'reviews', reviewId), { likes: newLikes });
    } catch (error) {
      console.error('Like review error:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      toast.success('Maoni yamefutwa');
    } catch (error) {
      console.error('Delete review error:', error);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    if (!user) {
      toast.error('Tafadhali ingia ili uweze kujibu');
      return;
    }
    if (!replyText.trim()) return;

    try {
      await addDoc(collection(db, 'review_replies'), {
        reviewId: reviewId,
        userId: user.uid,
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || '',
        text: replyText,
        createdAt: new Date().toISOString()
      });

      setReplyText('');
      setReplyingTo(null);
      toast.success('Jibu lako limetumwa');
    } catch (error) {
      console.error('Reply review error:', error);
    }
  };

  const handleDeleteReply = async (_reviewId: string, replyId: string) => {
    try {
      await deleteDoc(doc(db, 'review_replies', replyId));
      toast.success('Jibu limefutwa');
    } catch (error) {
      console.error('Delete reply error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background dark:bg-neutral-950 transition-colors">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-20 transition-colors">
      {/* Header Image */}
      <div className="h-56 md:h-80 w-full relative overflow-hidden bg-neutral-200">
        <img 
          src={vendor.bannerUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'} 
          alt={vendor.businessName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';
          }}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all z-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Vendor Profile Section */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 -mt-12 relative z-10">
        <Card className="bg-white dark:bg-neutral-900 border-none shadow-2xl shadow-neutral-900/10 rounded-[2rem] overflow-hidden">
          <CardContent className="p-5 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-white dark:border-neutral-800 shadow-xl overflow-hidden bg-white shrink-0 -mt-12 md:-mt-16">
                  <img 
                    src={vendor.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${vendor.businessName}`} 
                    alt={vendor.businessName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${vendor.businessName}`;
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                    <h1 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">{vendor.businessName}</h1>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border-none px-2 py-0.5 text-[10px] uppercase font-black">
                      {vendor.category}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-[11px] md:text-xs text-neutral-500 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-orange-500 fill-current" />
                      <span className="text-neutral-900 dark:text-white">{vendor.rating || '4.5'}</span>
                      <span className="text-neutral-400">({reviews.length})</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-neutral-300" />
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-600" />
                      <span className="truncate">{vendor.address}</span>
                    </div>
                  </div>

                  <p className="text-xs md:text-sm text-neutral-500 line-clamp-2 md:line-clamp-none max-w-xl mx-auto md:mx-0">
                    {vendor.description || 'Sisi ni wataalamu wa kutoa huduma bora na bidhaa za hali ya juu kwa wateja wetu. Karibu ujionee tofauti.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" className="flex-1 md:flex-none rounded-xl h-11 border-neutral-200 dark:border-neutral-800 font-black text-[10px] uppercase tracking-widest gap-2">
                  <Share2 className="w-3.5 h-3.5" /> {t('share') || 'Share'}
                </Button>
                <Link to={vendor?.ownerUid ? `/chat?to=${vendor.ownerUid}` : '#'} className="flex-1 md:flex-none">
                  <Button disabled={!vendor?.ownerUid} className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-orange-600/20">
                    <MessageSquare className="w-3.5 h-3.5" /> {t('chat') || 'Chat'}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 md:gap-8 border-b border-neutral-100 dark:border-neutral-800 mt-8 md:mt-12 overflow-x-auto no-scrollbar">
              {[
                { id: 'products', label: t('products') || 'Bidhaa', icon: ShoppingBag },
                { id: 'reviews', label: t('reviews') || 'Maoni', icon: Star },
                { id: 'info', label: t('info') || 'Kuhusu', icon: Info },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all relative shrink-0 ${
                    activeTab === tab.id ? 'text-orange-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTabVendor"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 rounded-full" 
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="mt-8">
              <AnimatePresence mode="wait">
                {activeTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-6"
                  >
                    {products.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * idx }}
                      >
                        <Link 
                          to={`/product/${product.id}`}
                          className="group"
                        >
                          <Card className="overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-lg shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all h-full group/card border-2 hover:border-orange-500/10">
                            <div className="aspect-square relative overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                              <img 
                                src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                }}
                                referrerPolicy="no-referrer"
                              />
                              <motion.button 
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addItem(product);
                                }}
                                className="absolute bottom-3 right-3 md:bottom-4 md:right-4 w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl shadow-xl flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all transform overflow-hidden group/btn"
                              >
                                <div className="absolute inset-0 bg-orange-600 -translate-x-full group-hover/btn:translate-x-0 transition-transform" />
                                <ShoppingBasket className="w-5 h-5 md:w-6 md:h-6 relative z-10" />
                              </motion.button>
                            </div>
                            <CardContent className="p-3 md:p-5">
                              <h4 className="font-black text-xs md:text-sm text-neutral-900 truncate group-hover/card:text-orange-600 transition-colors uppercase tracking-tight">{product.name}</h4>
                              <div className="flex items-center justify-between mt-1 md:mt-2">
                                <p className="text-[10px] md:text-xs text-orange-600 font-black">
                                  TZS {product.price.toLocaleString()}
                                </p>
                                <span className="text-[9px] md:text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">Qty: 1</span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                    {products.length === 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="col-span-full py-20 text-center bg-neutral-50 rounded-[2.5rem] border-2 border-dashed border-neutral-200"
                      >
                        <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                        <p className="text-neutral-500 font-medium font-bold uppercase tracking-widest text-xs">Hakuna bidhaa zilizopatikana.</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'reviews' && (
                  <motion.div
                    key="reviews"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-neutral-900">Maoni ya Wateja</h3>
                        <p className="text-neutral-500 text-sm mt-1">Wateja wanasemaje kuhusu duka hili.</p>
                      </div>
                      <Button 
                        onClick={() => setIsReviewModalOpen(true)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl h-12 px-6 font-bold gap-2"
                      >
                        <Plus className="w-4 h-4" /> Andika Maoni
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {reviews.map((review) => {
                        const isLiked = review.likes?.includes(user?.uid || '');
                        const isOwner = review.userId === user?.uid;
                        const isVendorOwner = vendor.ownerUid === user?.uid;

                        return (
                          <Card key={review.id} className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                                <img src={review.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.userId}`} alt={review.userName} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-neutral-900">{review.userName}</h4>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star key={`review-star-${review.id}-${i}`} className={`w-3 h-3 ${i < review.rating ? 'text-orange-500 fill-current' : 'text-neutral-300'}`} />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm text-neutral-600 leading-relaxed">{review.comment}</p>
                                
                                {review.images && review.images.length > 0 && (
                                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                                    {review.images.map((img, idx) => img && (
                                      <div key={`review-img-${review.id}-${idx}`} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-neutral-200">
                                        <img src={img} alt="Review" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center gap-4 pt-2">
                                  <button 
                                    onClick={() => handleLikeReview(review.id, !!isLiked)}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${isLiked ? 'text-orange-600' : 'text-neutral-400 hover:text-orange-600'}`}
                                  >
                                    <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} /> 
                                    {review.likes?.length || 0} Likes
                                  </button>
                                  
                                  <button 
                                    onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                                    className="flex items-center gap-1.5 text-xs text-neutral-400 font-bold hover:text-orange-600 transition-colors"
                                  >
                                    <Reply className="w-3.5 h-3.5" /> Reply
                                  </button>

                                  {isOwner && (
                                    <button 
                                      onClick={() => handleDeleteReview(review.id)}
                                      className="flex items-center gap-1.5 text-xs text-red-400 font-bold hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  )}

                                  <span className="text-[10px] text-neutral-300 font-medium ml-auto">
                                    {review.createdAt?.toDate().toLocaleDateString()}
                                  </span>
                                </div>

                                {/* Replies Section */}
                                {review.replies && review.replies.length > 0 && (
                                  <div className="mt-4 space-y-3 pl-6 border-l-2 border-neutral-100">
                                    {review.replies.map((reply) => (
                                      <div key={reply.id} className="bg-neutral-50 p-3 rounded-2xl relative group">
                                        <div className="flex items-center gap-2 mb-1">
                                          <img src={reply.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.userId}`} alt={reply.userName} className="w-5 h-5 rounded-full" />
                                          <span className="text-xs font-bold text-neutral-900">{reply.userName}</span>
                                          {reply.userId === vendor.ownerUid && (
                                            <Badge className="bg-orange-100 text-orange-600 border-none text-[8px] px-1.5 py-0">Muuzaji</Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-neutral-600">{reply.text}</p>
                                        {reply.userId === user?.uid && (
                                          <button 
                                            onClick={() => handleDeleteReply(review.id, reply.id)}
                                            className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reply Input */}
                                {replyingTo === review.id && (
                                  <div className="mt-4 flex gap-2">
                                    <input 
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Andika jibu lako..."
                                      className="flex-1 bg-neutral-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-orange-500"
                                      autoFocus
                                    />
                                    <Button 
                                      onClick={() => handleReplyReview(review.id)}
                                      className="h-8 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold"
                                    >
                                      Tuma
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                      {reviews.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                          <Star className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                          <p className="text-neutral-500 font-medium">Hakuna maoni bado. Kuwa wa kwanza kutoa maoni!</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-2xl space-y-8"
                  >
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-neutral-900">Kuhusu Sisi</h3>
                      <p className="text-neutral-600 leading-relaxed">
                        {vendor.description || 'Sisi ni wataalamu wa kutoa huduma bora na bidhaa za hali ya juu kwa wateja wetu. Karibu ujionee tofauti.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-6 bg-neutral-50 rounded-3xl space-y-3">
                        <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-neutral-900">Mahali</h4>
                        <p className="text-sm text-neutral-500">{vendor.address}</p>
                      </div>
                      <div className="p-6 bg-neutral-50 rounded-3xl space-y-3">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                          <Phone className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-neutral-900">Mawasiliano</h4>
                        <p className="text-sm text-neutral-500">0712 345 678</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-neutral-900">Andika Maoni</h3>
                <button onClick={() => setIsReviewModalOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-bold text-neutral-500 uppercase">Gusa nyota kutoa alama</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="transition-transform active:scale-90"
                      >
                        <Star className={`w-10 h-10 ${star <= rating ? 'text-orange-500 fill-current' : 'text-neutral-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Maoni Yako</label>
                  <textarea 
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full min-h-[120px] p-4 bg-neutral-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                    placeholder="Elezea uzoefu wako..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Picha za Bidhaa (Optional)</label>
                  <div className="flex flex-wrap gap-3">
                    {reviewImages.map((url, idx) => url && (
                      <div key={`review-img-${idx}-${url.slice(-20)}`} className="w-20 h-20 rounded-2xl overflow-hidden relative group">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setReviewImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-20 h-20 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 hover:text-orange-600 hover:border-orange-600 transition-all"
                    >
                      {isUploading ? (
                        <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6" />
                          <span className="text-[8px] font-bold mt-1">Add Photo</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    accept="image/*" 
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)} 
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200"
                >
                  Tuma Maoni
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
