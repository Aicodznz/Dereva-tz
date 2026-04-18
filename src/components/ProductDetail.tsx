import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth, storage } from '../firebase';
import { initiatePayment } from '../services/paymentService';
import { Product, VendorProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight,
  Star, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Info, 
  Calendar, 
  Clock, 
  Users,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  ThumbsUp,
  MessageSquare,
  Trash2,
  Reply,
  Megaphone,
  Smartphone,
  Phone,
  Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  // Adaptive States
  const [selectedSize, setSelectedSize] = useState('Normal');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'dine_in' | 'takeaway'>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [tableSession, setTableSession] = useState<any>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('papo_hapo_table_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      // Only use if same vendor
      if (session.vendorId === id || session.vendorId === product?.vendorId) {
        setTableSession(session);
        setOrderType('dine_in');
        setTableNumber(session.tableId);
      }
    }
  }, [id, product]);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const pData = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(pData);
          
          // Fetch Vendor
          const vRef = doc(db, 'vendors', pData.vendorId);
          const vSnap = await getDoc(vRef);
          if (vSnap.exists()) {
            setVendor({ id: vSnap.id, ...vSnap.data() } as VendorProfile);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'products');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();

    // Fetch Reviews with Replies
    const qReviews = query(collection(db, 'reviews'), where('targetId', '==', id), where('targetType', '==', 'product'), orderBy('createdAt', 'desc'));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      const reviewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(reviewData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reviews');
    });

    return () => unsubReviews();
  }, [id]);

  // Separate effect for fetching replies when reviews change
  useEffect(() => {
    if (reviews.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    reviews.forEach(review => {
      const qReplies = query(collection(db, 'reviews', review.id, 'replies'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(qReplies, (replySnap) => {
        const replies = replySnap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewReply));
        setReviews(prev => prev.map(r => r.id === review.id ? { ...r, replies } : r));
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [reviews.map(r => r.id).join(',')]);

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
        targetType: 'product',
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

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error('Msimbo huu wa punguzo haupo au haufanyi kazi');
        setAppliedCoupon(null);
      } else {
        const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        
        // Check if coupon is valid for this vendor/product
        if (coupon.vendorId && coupon.vendorId !== product?.vendorId) {
          toast.error('Msimbo huu haufanyi kazi kwa muuzaji huyu');
          setIsApplyingCoupon(false);
          return;
        }
        if (coupon.productId && coupon.productId !== product?.id) {
          toast.error('Msimbo huu haufanyi kazi kwa bidhaa hii');
          setIsApplyingCoupon(false);
          return;
        }
        
        setAppliedCoupon(coupon);
        toast.success('Punguzo limetumika!');
      }
    } catch (error) {
      toast.error('Hitilafu imetokea wakati wa kuhakiki msimbo');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const calculateDiscountedPrice = () => {
    if (!product) return 0;
    let basePrice = product.price;
    
    // Add variations price
    const selectedVar = product.variations?.find(v => v.name === selectedSize);
    if (selectedVar) basePrice += selectedVar.price;
    
    // Add addons price
    selectedAddons.forEach(addonName => {
      const addon = product.addOns?.find(a => a.name === addonName);
      if (addon) basePrice += addon.price;
    });

    const totalBeforeCoupon = basePrice * quantity;

    if (!appliedCoupon) return totalBeforeCoupon;

    if (appliedCoupon.discountType === 'percentage') {
      return totalBeforeCoupon * (1 - appliedCoupon.discountValue / 100);
    } else {
      return Math.max(0, totalBeforeCoupon - appliedCoupon.discountValue);
    }
  };

  const handleBuyNow = async () => {
    if (!auth.currentUser) {
      toast.error('Tafadhali ingia ili uweze kuagiza');
      navigate('/login');
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  const processPayment = async () => {
    if (!buyerPhone.trim()) {
      toast.error('Tafadhali ingia namba yako ya simu');
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      const orderData = {
        vendorId: product.vendorId,
        customerId: auth.currentUser?.uid,
        customerName: auth.currentUser?.displayName || 'Mteja',
        customerPhone: buyerPhone,
        items: [{
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          variation: selectedSize,
          addons: selectedAddons
        }],
        orderType: orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : null,
        totalAmount: calculateDiscountedPrice(),
        status: 'pending',
        paymentStatus: 'pending',
        orderSource: 'app_direct',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      const formattedPhone = buyerPhone.startsWith('0') 
        ? '255' + buyerPhone.substring(1) 
        : buyerPhone.replace('+', '');

      toast.info('Inatuma ombi la malipo kwenye simu yako...');
      
      await initiatePayment({
        order_id: docRef.id,
        amount: Math.round(calculateDiscountedPrice()),
        buyer_phone: formattedPhone,
        fee_payer: 'CUSTOMER'
      });

      toast.success('Ombi la malipo limetumwa! Tafadhali weka siri kwenye simu yako.');
      setIsCheckoutModalOpen(false);
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error('Checkout failed: ' + error.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Bidhaa haijapatikana</h2>
        <Button onClick={() => navigate(-1)} className="mt-4">Rudi Nyuma</Button>
      </div>
    );
  }

  const toggleAddon = (addon: string) => {
    setSelectedAddons(prev => 
      prev.includes(addon) ? prev.filter(a => a !== addon) : [...prev, addon]
    );
  };

  const getCategoryLabel = () => {
    if (!vendor) return 'product';
    return vendor.category;
  };

  const renderAdaptiveOptions = () => {
    const category = getCategoryLabel();

    return (
      <div className="space-y-8">
        {/* Dynamic Variations (Sizes) */}
        {product.variations && product.variations.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Chagua Ukubwa (Size)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {product.variations.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSize(v.name)}
                  className={`py-3 px-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedSize === v.name 
                      ? 'border-orange-600 bg-orange-50 text-orange-600' 
                      : 'border-neutral-100 text-neutral-500'
                  }`}
                >
                  <span className="font-bold text-sm">{v.name}</span>
                  {v.price > 0 && (
                    <span className="text-[10px] font-medium">+{v.price.toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Add-ons (Vionjo) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Vionjo vya Ziada (Add-ons)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.addOns.map((addon, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleAddon(addon.name)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                    selectedAddons.includes(addon.name)
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-neutral-100'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${selectedAddons.includes(addon.name) ? 'text-orange-600' : 'text-neutral-700'}`}>
                      {addon.name}
                    </span>
                    {addon.price > 0 && (
                      <span className="text-[10px] text-neutral-500 font-medium">TZS {addon.price.toLocaleString()}</span>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedAddons.includes(addon.name) ? 'border-orange-600 bg-orange-600' : 'border-neutral-300'
                  }`}>
                    {selectedAddons.includes(addon.name) && <Plus className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Specific Info */}
        {category === 'pharmacy' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100">
            <h3 className="font-bold text-lg">Taarifa za Dawa</h3>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 font-medium">Aina ya Dawa:</span>
                <span className="font-bold text-blue-900">{product.medicationType === 'prescription' ? 'Prescription-only' : 'Over-the-counter'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 font-medium">Expiry Date:</span>
                <span className="font-bold text-blue-900">{product.expiryDate || 'N/A'}</span>
              </div>
            </div>
            {product.medicationType === 'prescription' && (
              <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl gap-2 shadow-lg shadow-blue-200">
                <Camera className="w-5 h-5" />
                Pakia Prescription Yako Hapa
              </Button>
            )}
          </div>
        )}

        {category === 'hotel' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100">
            <h3 className="font-bold text-lg">Weka Tarehe Zako</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Check-in</label>
                <div className="h-12 bg-neutral-100 rounded-xl flex items-center px-4 gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <input type="date" className="bg-transparent border-none text-sm w-full focus:ring-0" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Check-out</label>
                <div className="h-12 bg-neutral-100 rounded-xl flex items-center px-4 gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <input type="date" className="bg-transparent border-none text-sm w-full focus:ring-0" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white lg:bg-neutral-50 pb-80 lg:pb-32">
      <div className="max-w-7xl mx-auto lg:px-8 lg:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* 1. Image Gallery */}
          <div className="space-y-4">
            <div className="relative h-[300px] md:h-[450px] lg:h-[600px] w-full bg-neutral-100 lg:rounded-[40px] overflow-hidden shadow-sm lg:shadow-xl group">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={activeImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  src={(product.imageUrls?.[activeImageIndex] || product.imageUrl) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
              
              <button 
                onClick={() => navigate(-1)}
                className="absolute top-6 left-6 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all z-30"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {product.imageUrls && product.imageUrls.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImageIndex(prev => (prev === 0 ? product.imageUrls!.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setActiveImageIndex(prev => (prev === product.imageUrls!.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
                {(product.imageUrls || [product.imageUrl]).map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeImageIndex === idx ? 'w-8 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Thumbnails */}
            {product.imageUrls && product.imageUrls.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-4 lg:px-0">
                {product.imageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${
                      activeImageIndex === idx ? 'border-orange-600 scale-105' : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 lg:px-0 space-y-6 lg:space-y-8">
            {/* 2. Core Info */}
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 flex-1">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-neutral-900 leading-tight">
                    {product.name}
                  </h1>
                  <Link to={`/vendor/${vendor?.id}`} className="block text-sm md:text-base text-neutral-500 hover:text-orange-600 transition-colors underline decoration-neutral-200 underline-offset-4">
                    by {vendor?.businessName || 'Papo Hapo Store'}
                  </Link>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl md:text-2xl lg:text-3xl font-black text-orange-600">
                    TZS {product.price.toLocaleString()}
                  </p>
                  <Badge variant="secondary" className="mt-1 bg-orange-100 text-orange-700 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {product.category}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4 text-orange-500 fill-current" />
                  <span className="text-sm font-bold text-orange-700">4.8</span>
                </div>
                <span className="text-xs text-neutral-400 font-medium">(215 reviews)</span>
              </div>
            </div>

            {/* 3. Description */}
            <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-neutral-100 shadow-sm space-y-4">
              <h3 className="font-bold text-lg lg:text-xl">Maelezo</h3>
              <div className="relative">
                <p className={`text-neutral-600 leading-relaxed text-sm lg:text-base ${!isDescExpanded && 'line-clamp-3 lg:line-clamp-4'}`}>
                  {product.description || 'Hii ni bidhaa bora kabisa inayopatikana Papo Hapo. Imetengenezwa kwa weledi na ubora wa hali ya juu ili kukidhi mahitaji yako ya kila siku.'}
                </p>
                <button 
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-3 text-orange-600 text-xs lg:text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  {isDescExpanded ? 'Read Less' : 'Read More'}
                  {isDescExpanded ? <ChevronUp className="w-3 h-3 lg:w-4 lg:h-4" /> : <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4" />}
                </button>
              </div>
            </div>

            {/* 4. Adaptive Options */}
            <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-neutral-100 shadow-sm space-y-6">
              {renderAdaptiveOptions()}
              
              <div className="pt-6 border-t border-neutral-100">
                <h3 className="font-bold text-lg mb-4">Tumia Kuponi (Coupon)</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Megaphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text"
                      placeholder="Ingiza msimbo (mfano: KARIBU2024)"
                      className="w-full h-12 pl-10 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-600 outline-none transition-all"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Button 
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponCode.trim()}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-12 px-6 font-bold"
                  >
                    {isApplyingCoupon ? '...' : 'Tumia'}
                  </Button>
                </div>
                {appliedCoupon && (
                  <div className="mt-3 flex items-center justify-between bg-green-50 p-3 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-green-700">
                        Punguzo la {appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `TZS ${appliedCoupon.discountValue.toLocaleString()}`} limetumika!
                      </span>
                    </div>
                    <button onClick={() => setAppliedCoupon(null)} className="text-green-700 hover:text-green-900">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Reviews Section */}
            <div className="space-y-8 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900">Maoni ya Wateja</h3>
                  <p className="text-neutral-500 text-sm mt-1">Wateja wanasemaje kuhusu bidhaa hii.</p>
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
                  const isVendorOwner = vendor?.ownerUid === auth.currentUser?.uid;

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
                                    {reply.userId === vendor?.ownerUid && (
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
                  <div className="py-20 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                    <Star className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-500 font-medium">Hakuna maoni bado. Kuwa wa kwanza kutoa maoni!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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

      {/* 6. Action Bar - Positioned above mobile nav */}
      <div className="fixed bottom-[88px] md:bottom-0 left-0 right-0 p-4 md:p-8 bg-white/80 backdrop-blur-xl border-t border-neutral-100 z-[999] shadow-[0_-20px_50px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto flex gap-4 md:gap-8 items-center">
          <div className="flex items-center bg-neutral-100 rounded-[2rem] p-1.5 md:p-2 shrink-0 border border-neutral-200">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-neutral-400 hover:text-orange-600 hover:bg-white rounded-2xl transition-all shadow-sm active:scale-90"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="w-10 md:w-14 text-center font-black text-xl md:text-2xl text-neutral-900 italic tracking-tighter">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-neutral-400 hover:text-orange-600 hover:bg-white rounded-2xl transition-all shadow-sm active:scale-90"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <Button 
            onClick={handleBuyNow}
            className="flex-1 h-14 md:h-18 bg-orange-600 hover:bg-neutral-900 text-white rounded-[2rem] font-black text-base md:text-xl shadow-2xl shadow-orange-600/30 gap-3 md:gap-4 transition-all transform active:scale-[0.96] uppercase italic tracking-tighter"
          >
            <Smartphone className="w-5 h-5 md:w-8 md:h-8" />
            <span className="truncate">
               Agiza Sasa
            </span>
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
            >
               <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-neutral-900">Kamilisha Malipo</h3>
                <button onClick={() => setIsCheckoutModalOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {tableSession && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Self-Service Active</p>
                      <p className="text-sm font-black text-blue-900 uppercase italic">Meza: {tableSession.tableId}</p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div className="flex justify-between items-center text-sm font-bold text-neutral-500 uppercase tracking-widest">
                    <span>Jumla:</span>
                    <span className="text-xl font-black text-orange-600 italic">TZS {calculateDiscountedPrice().toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Chagua Aina ya Oda</label>
                    <div className="flex p-1 bg-neutral-100 rounded-2xl">
                      {[
                        { id: 'delivery', label: 'Delivery' },
                        { id: 'takeaway', label: 'Takeaway' },
                        { id: 'dine_in', label: 'Dine-in' }
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setOrderType(type.id as any)}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                            orderType === type.id ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {orderType === 'dine_in' && !tableSession && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Namba ya Meza</label>
                      <input 
                        type="text"
                        placeholder="Ingiza namba ya meza"
                        className="w-full h-14 px-6 bg-neutral-50 border border-neutral-200 rounded-2xl text-lg font-black uppercase italic focus:ring-2 focus:ring-orange-600 outline-none"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Namba ya Simu (Mobile Money)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                      <input 
                        type="tel"
                        placeholder="07XXXXXXXX"
                        className="w-full h-14 pl-12 pr-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-lg font-black italic focus:ring-2 focus:ring-orange-500 outline-none"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  disabled={isProcessingPayment}
                  onClick={processPayment}
                  className="w-full h-18 bg-orange-600 hover:bg-neutral-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-orange-600/20 uppercase italic tracking-tighter"
                >
                  {isProcessingPayment ? 'Inatuma Ombi...' : 'Lipa Sasa'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
