import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage, auth } from '../firebase';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, MapPin, Clock, Phone, Info, 
  ShoppingBag, Plus, Camera, X, MessageSquare,
  ThumbsUp, Share2, Trash2, Reply
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

  useEffect(() => {
    if (!id) return;

    // Fetch Vendor
    const fetchVendor = async () => {
      try {
        const docRef = doc(db, 'vendors', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setVendor({ id: docSnap.id, ...docSnap.data() } as VendorProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `vendors/${id}`);
      }
    };

    fetchVendor();

    // Fetch Products
    const qProducts = query(collection(db, 'products'), where('vendorId', '==', id));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Fetch Reviews with Replies
    const qReviews = query(collection(db, 'reviews'), where('targetId', '==', id), where('targetType', '==', 'vendor'), orderBy('createdAt', 'desc'));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      const reviewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      
      // For each review, fetch replies
      reviewData.forEach(review => {
        const qReplies = query(collection(db, 'reviews', review.id, 'replies'), orderBy('createdAt', 'asc'));
        onSnapshot(qReplies, (replySnap) => {
          const replies = replySnap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewReply));
          setReviews(prev => prev.map(r => r.id === review.id ? { ...r, replies } : r));
        });
      });

      setReviews(reviewData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reviews');
    });

    return () => {
      unsubProducts();
      unsubReviews();
    };
  }, [id]);

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        const storageRef = ref(storage, `reviews/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', null, reject, async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setReviewImages(prev => [...prev, url]);
            resolve();
          });
        });
      } catch (error) {
        toast.error('Imeshindwa kupakia picha');
      }
    }
    setIsUploading(false);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('Tafadhali ingia ili uweze kutoa maoni');
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Mteja',
        userPhoto: auth.currentUser.photoURL || '',
        targetId: id,
        targetType: 'vendor',
        rating,
        comment,
        images: reviewImages,
        likes: [],
        createdAt: serverTimestamp()
      });
      
      toast.success('Asante kwa maoni yako!');
      setIsReviewModalOpen(false);
      setComment('');
      setRating(5);
      setReviewImages([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    }
  };

  const handleLikeReview = async (reviewId: string, isLiked: boolean) => {
    if (!auth.currentUser) {
      toast.error('Tafadhali ingia ili uweze kulike');
      return;
    }

    try {
      const reviewRef = doc(db, 'reviews', reviewId);
      await updateDoc(reviewRef, {
        likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      toast.success('Maoni yamefutwa');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    if (!auth.currentUser) {
      toast.error('Tafadhali ingia ili uweze kujibu');
      return;
    }
    if (!replyText.trim()) return;

    try {
      await addDoc(collection(db, 'reviews', reviewId, 'replies'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'User',
        userPhoto: auth.currentUser.photoURL || '',
        text: replyText,
        createdAt: serverTimestamp()
      });
      setReplyText('');
      setReplyingTo(null);
      toast.success('Jibu lako limetumwa');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `reviews/${reviewId}/replies`);
    }
  };

  const handleDeleteReply = async (reviewId: string, replyId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId, 'replies', replyId));
      toast.success('Jibu limefutwa');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}/replies/${replyId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header Image */}
      <div className="h-64 md:h-80 w-full relative overflow-hidden">
        <img 
          src={vendor.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'} 
          alt={vendor.businessName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all z-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Vendor Profile Card */}
      <div className="max-w-5xl mx-auto px-4 -mt-20 relative z-10">
        <Card className="bg-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
                <div className="w-32 h-32 rounded-[2rem] border-4 border-white shadow-lg overflow-hidden bg-white shrink-0">
                  <img 
                    src={vendor.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
                    alt={vendor.businessName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-center md:text-left space-y-2">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h1 className="text-3xl font-black text-neutral-900">{vendor.businessName}</h1>
                    <Badge className="bg-orange-100 text-orange-600 border-none px-3 py-1 text-xs font-bold uppercase">
                      {vendor.category}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-neutral-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-orange-500 fill-current" />
                      <span className="text-neutral-900 font-bold">{vendor.rating || '4.5'}</span>
                      <span>({reviews.length} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span>{vendor.address}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>{vendor.operatingHours || '08:00 - 22:00'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-2xl h-12 px-6 border-neutral-200 font-bold gap-2">
                  <Share2 className="w-4 h-4" /> Share
                </Button>
                <Link to={`/chat?to=${id}`}>
                  <Button className="bg-orange-600 hover:bg-orange-700 rounded-2xl h-12 px-8 font-bold gap-2 shadow-lg shadow-orange-200">
                    <MessageSquare className="w-4 h-4" /> Chat
                  </Button>
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-8 border-b border-neutral-100 mt-12">
              {[
                { id: 'products', label: 'Bidhaa', icon: ShoppingBag },
                { id: 'reviews', label: 'Maoni', icon: Star },
                { id: 'info', label: 'Kuhusu', icon: Info },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 text-sm font-bold flex items-center gap-2 transition-all relative ${
                    activeTab === tab.id ? 'text-orange-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTab"
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6"
                  >
                    {products.map((product) => (
                      <Link 
                        key={product.id} 
                        to={`/product/${product.id}`}
                        className="group"
                      >
                        <Card className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-lg transition-all h-full">
                          <div className="aspect-square relative overflow-hidden bg-neutral-100">
                            <img 
                              src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                            <button className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all">
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          <CardContent className="p-4">
                            <h4 className="font-bold text-sm text-neutral-900 truncate group-hover:text-orange-600 transition-colors">{product.name}</h4>
                            <p className="text-xs text-orange-600 font-black mt-1">
                              TZS {product.price.toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    {products.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                        <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                        <p className="text-neutral-500 font-medium">Hakuna bidhaa zilizopatikana kwa sasa.</p>
                      </div>
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
                        const isLiked = review.likes?.includes(auth.currentUser?.uid || '');
                        const isOwner = review.userId === auth.currentUser?.uid;
                        const isVendorOwner = vendor.ownerUid === auth.currentUser?.uid;

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
                                      <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-orange-500 fill-current' : 'text-neutral-300'}`} />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm text-neutral-600 leading-relaxed">{review.comment}</p>
                                
                                {review.images && review.images.length > 0 && (
                                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                                    {review.images.map((img, idx) => img && (
                                      <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-neutral-200">
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
                                        {reply.userId === auth.currentUser?.uid && (
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
                    {reviewImages.map((url, idx) => (
                      <div key={idx} className="w-20 h-20 rounded-2xl overflow-hidden relative group">
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
