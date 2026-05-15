import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import { initiatePayment } from '../services/paymentService';
import { Product, VendorProfile, FAQ, Review, ReviewReply } from '../types';
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
  MapPin,
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
  Utensils,
  ShoppingBag,
  Store,
  Package,
  Armchair,
  CheckCircle2,
  Share2,
  Box,
  Layout,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const formatCurrency = (amount: number) => {
  return `TZS ${amount.toLocaleString()}`;
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config: businessConfig } = useBusinessConfig();
  const { user, profile } = useAuth();
  const { addItem, setIsCartOpen } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showARView, setShowARView] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');
  const arViewerRef = useRef<any>(null);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({ ...product, quantity });
    toast.success('Added to your basket', {
      description: `${quantity}x ${product.name} has been added.`,
      icon: <ShoppingBag className="w-5 h-5 text-orange-600" />
    });
  };

  const isModelValid = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.split('?')[0].toLowerCase();
    return lowerUrl.endsWith('.glb') || lowerUrl.endsWith('.gltf');
  };

  useEffect(() => {
    if (showARView && product) {
      const viewer = document.getElementById('main-ar-viewer');
      if (viewer) {
        const handleError = (e: any) => {
          console.error('Model viewer error:', e);
          if (!isModelValid(product?.model3dUrl || '')) {
            toast.error('Faili uliyoweka siyo ya 3D (AR). Tafadhali tumia faili la .glb badala ya picha.', {
              duration: 5000
            });
          } else {
            toast.error('Imeshindwa kupakia model ya 3D. Hakikisha internet ni nzuri.');
          }
        };
        viewer.addEventListener('error', handleError);
        return () => viewer.removeEventListener('error', handleError);
      }
    }
  }, [showARView, product?.model3dUrl]);

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
  const [orderType, setOrderType] = useState<'delivery' | 'walk_in' | 'pickup'>('delivery');
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
        setOrderType('walk_in');
        setTableNumber(session.tableId);
      }
    }
  }, [id, product]);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const pSnap = await getDoc(doc(db, 'products', id));
        if (pSnap.exists()) {
          const pData = { id: pSnap.id, ...pSnap.data() } as Product;
          setProduct(pData);
          
          const vSnap = await getDoc(doc(db, 'vendors', pData.vendorId));
          if (vSnap.exists()) {
            setVendor({ id: vSnap.id, ...vSnap.data() } as VendorProfile);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();

    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, 'reviews'),
          where('targetId', '==', id),
          where('targetType', '==', 'product')
        );
        const snap = await getDocs(q);
        const reviewsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        
        // Sort client-side to avoid index requirement
        const sortedReviews = reviewsData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setReviews(sortedReviews);
      } catch (error) {
        console.error(error);
      }
    };

    const fetchSimilarProducts = async (category: string) => {
      try {
        const q = query(
          collection(db, 'products'),
          where('category', '==', category),
          limit(6)
        );
        const snap = await getDocs(q);
        const products = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.id !== id);
        setSimilarProducts(products);
      } catch (error) {
        console.error(error);
      }
    };

    fetchReviews();

    const q = query(
      collection(db, 'reviews'),
      where('targetId', '==', id),
      where('targetType', '==', 'product')
    );
    
    const unsub = onSnapshot(
      q, 
      () => {
        fetchReviews();
      },
      (error: any) => {
        if (error.message?.includes('permission')) {
          console.warn("Reviews live updates restricted by rules");
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );

    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (product?.category) {
      const fetchSimilarProducts = async (category: string) => {
        try {
          const q = query(
            collection(db, 'products'),
            where('category', '==', category),
            limit(6)
          );
          const snap = await getDocs(q);
          const products = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.id !== id);
          setSimilarProducts(products);
        } catch (error) {
          console.error(error);
        }
      };
      fetchSimilarProducts(product.category);
    }
  }, [id, product?.category]);

  // Separate effect for fetching replies when reviews change
  useEffect(() => {
    if (reviews.length === 0) return;

    const fetchReplies = async () => {
      const reviewsWithReplies = await Promise.all(reviews.map(async (review) => {
        const q = query(
          collection(db, 'review_replies'),
          where('reviewId', '==', review.id)
        );
        const snap = await getDocs(q);
        const repliesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewReply));
        
        // Sort client-side
        const sortedReplies = repliesData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });

        return { ...review, replies: sortedReplies };
      }));
      setReviews(reviewsWithReplies);
    };

    fetchReplies();
  }, [reviews.length]);

  const handleFileUpload = async (files: FileList) => {
    if (!files || !user || files.length === 0) return;
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
      if (!product) return;
      const newReviewRef = await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Mteja',
        userPhoto: profile?.photoURL || user.photoURL || '',
        targetId: id,
        targetType: 'product',
        rating,
        comment,
        images: reviewImages,
        likes: [],
        createdAt: new Date().toISOString()
      });

      // Update Product Rating
      if (id) {
        const q = query(
          collection(db, 'reviews'),
          where('targetId', '==', id),
          where('targetType', '==', 'product')
        );
        const snap = await getDocs(q);
        const reviewsData = snap.docs.map(doc => doc.data());
        
        const alreadyInSnap = snap.docs.some(d => d.id === newReviewRef.id);
        const allRatings = reviewsData.map(r => Number(r.rating) || 0);
        
        if (!alreadyInSnap) {
          allRatings.push(Number(rating));
        }

        const newRating = allRatings.length > 0 
          ? allRatings.reduce((acc, curr) => acc + curr, 0) / allRatings.length 
          : Number(rating);
        
        await updateDoc(doc(db, 'products', id), {
          rating: parseFloat(newRating.toFixed(1)),
          ratingCount: allRatings.length
        });

        // ALSO update vendor rating aggregate
        if (product.vendorId) {
          try {
            const vq = query(
              collection(db, 'reviews'),
              where('targetId', '==', product.vendorId),
              where('targetType', '==', 'vendor')
            );
            const vsnap = await getDocs(vq);
            const vReviews = vsnap.docs.map(doc => doc.data());
            
            // For now, let's just make sure we update the count and average correctly
            // if we want to include product reviews in vendor rating, we'd query all reviews for this vendor's products too.
            // But let's just update based on direct vendor reviews for now as a baseline.
            const vRatings = vReviews.map(r => Number(r.rating) || 0);
            if (vRatings.length > 0) {
              const vAvg = vRatings.reduce((a, b) => a + b, 0) / vRatings.length;
              await updateDoc(doc(db, 'vendors', product.vendorId), {
                rating: parseFloat(vAvg.toFixed(1)),
                ratingCount: vRatings.length
              });
            }
          } catch (err) {
            console.error("Error updating vendor aggregate:", err);
          }
        }
      }
      
      toast.success('Asante kwa maoni yako!');
      setIsReviewModalOpen(false);
      setComment('');
      setRating(5);
      setReviewImages([]);
    } catch (error) {
      console.error(error);
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
      console.error(error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      toast.success('Maoni yamefutwa');
    } catch (error) {
      console.error(error);
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
        reviewId,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'User',
        userPhoto: profile?.photoURL || user.photoURL || '',
        text: replyText,
        createdAt: new Date().toISOString()
      });
      setReplyText('');
      setReplyingTo(null);
      toast.success('Jibu lako limetumwa');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteReply = async (reviewId: string, replyId: string) => {
    try {
      await deleteDoc(doc(db, 'review_replies', replyId));
      toast.success('Jibu limefutwa');
    } catch (error) {
      console.error(error);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', couponCode.toUpperCase()),
        where('active', '==', true)
      );
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
    if (selectedVar && typeof selectedVar.price === 'number') basePrice += selectedVar.price;
    
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
    if (!user) {
      toast.error('Tafadhali ingia ili uweze kuagiza');
      navigate('/login');
      return;
    }
    setIsCheckoutModalOpen(true);
  };

  const processPayment = async () => {
    if (!product) return;
    if (!buyerPhone.trim()) {
      toast.error('Tafadhali ingia namba yako ya simu');
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      const orderData = {
        vendorId: product.vendorId,
        vendorOwnerUid: vendor?.ownerUid,
        customerId: user?.uid,
        customerName: profile?.displayName || user?.displayName || 'Mteja',
        customerPhone: buyerPhone,
        branchId: product?.branchId || null,
        items: [{
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          variation: selectedSize,
          addons: selectedAddons
        }],
        orderType: orderType,
        tableNumber: orderType === 'walk_in' ? tableNumber : null,
        totalAmount: calculateDiscountedPrice(),
        status: 'pending',
        paymentStatus: 'pending',
        orderSource: 'app_direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderRef.id;
      
      const formattedPhone = buyerPhone.startsWith('0') 
        ? '255' + buyerPhone.substring(1) 
        : buyerPhone.replace('+', '');

      toast.info('Inatuma ombi la malipo kwenye simu yako...');
      
      await initiatePayment({
        order_id: orderId,
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `Angalia bidhaa hii kwenye Papo Hapo: ${product?.name}`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link imenakiliwa!');
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
      <div className="space-y-4">
        {/* Dynamic Variations (Sizes) */}
        {product.variations && product.variations.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-400">Chagua Ukubwa (Size)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {product.variations.map((v, idx) => (
                <button
                  key={`variation-${v.name}-${idx}`}
                  onClick={() => setSelectedSize(v.name)}
                  className={`py-3 px-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedSize === v.name 
                      ? 'border-orange-600 bg-orange-50 text-orange-600' 
                      : 'border-neutral-100 text-neutral-500'
                  }`}
                >
                  <span className="font-bold text-sm">{v.name}</span>
                  {(v.price ?? 0) > 0 && (
                    <span className="text-[10px] font-medium">+{(v.price ?? 0).toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Add-ons (Vionjo) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-400">Vionjo vya Ziada (Add-ons)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {product.addOns.map((addon, idx) => (
                <button
                  key={`addon-${addon.name}-${idx}`}
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

        {category === 'bus_ticket' && (
          <div className="space-y-6 pt-4 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Maelezo ya Safari</h3>
              <Badge className="bg-green-50 text-green-600 border-none font-black text-[10px] uppercase">Active Trip</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Boarding Point</p>
                <p className="text-sm font-bold text-neutral-900 line-clamp-1">{(product as any).boardingPoint || 'Main Office, Ubungo'}</p>
                <div className="flex items-center gap-1 mt-1 text-orange-600">
                  <MapPin className="w-3 h-3" />
                  <span className="text-[10px] font-bold">Open in Maps</span>
                </div>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Departure Time</p>
                <p className="text-sm font-bold text-neutral-900">{(product as any).departureTime || '06:00 AM'}</p>
                <div className="flex items-center gap-1 mt-1 text-orange-600">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold">Local Time</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-neutral-900 uppercase italic">Chagua Kiti (Select Seat)</h4>
                <p className="text-[10px] font-bold text-neutral-500">{(product as any).availableSeats || '45'} available</p>
              </div>
              <div className="grid grid-cols-5 gap-2 h-48 overflow-y-auto p-4 bg-neutral-900 rounded-3xl no-scrollbar border-4 border-neutral-800">
                {Array.from({ length: 48 }).map((_, i) => {
                  const isBooked = [3, 7, 12, 14, 22, 23, 30].includes(i);
                  return (
                    <button 
                      key={`bus-seat-${i}`}
                      disabled={isBooked}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${
                        isBooked 
                        ? 'bg-neutral-800 text-neutral-700 cursor-not-allowed' 
                        : 'bg-neutral-700 text-white hover:bg-orange-600 hover:scale-110 active:scale-95'
                      }`}
                    >
                      <Armchair className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-800" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-600" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Selected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white lg:bg-neutral-50 pb-12">
      {/* AR Viewer Overlay */}
      <AnimatePresence>
        {showARView && product?.model3dUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black flex flex-col"
          >
            <div className="p-6 flex items-center justify-between z-[2001] bg-gradient-to-b from-black/90 via-black/40 to-transparent absolute top-0 inset-x-0 h-32">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
                  <Box className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-white font-black italic text-xl uppercase tracking-tighter leading-none">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">AR Experience Live</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowARView(false)}
                className="w-12 h-12 bg-white/10 hover:bg-white text-white hover:text-black rounded-2xl flex items-center justify-center backdrop-blur-xl transition-all active:scale-90 border border-white/20"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 relative">
              {/* @ts-ignore */}
              <model-viewer
                id="main-ar-viewer"
                src={product?.model3dUrl}
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-placement="floor"
                camera-controls
                touch-action="pan-y"
                poster={product?.imageUrl}
                shadow-intensity="1"
                autoplay
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <button 
                  slot="ar-button" 
                  onClick={() => {
                    const viewer = document.getElementById('main-ar-viewer') as any;
                    if (viewer && viewer.canActivateAR) {
                      viewer.activateAR();
                    }
                  }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-4 rounded-full font-black uppercase italic tracking-tighter shadow-2xl flex items-center gap-3 border-4 border-orange-600 animate-bounce active:scale-95 transition-all z-[2005]"
                >
                  <Smartphone className="w-5 h-5 text-orange-600" />
                  View in Space / TAZAMA AR
                </button>
                
                <div slot="ar-failure" className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center gap-4 z-[2003]">
                   <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center text-red-500 mb-4">
                      <Box className="w-10 h-10" />
                   </div>
                   <h4 className="text-white font-black italic text-xl uppercase tracking-tighter">AR haipatikani</h4>
                   <p className="text-white/60 text-sm max-w-xs">
                     {isModelValid(product?.model3dUrl || '') 
                       ? "Simu yako huenda haisupport AR au unapaswa kutoa ruhusa ya kamera kwenye browser yako."
                       : "Bidhaa hii haina faili halali la 3D (GLB). Huwezi kutumia picha ya PNG/JPG kwa AR."
                     }
                   </p>
                   {!isModelValid(product?.model3dUrl || '') && (
                     <div className="bg-orange-600/10 border border-orange-600/20 p-4 rounded-2xl max-w-xs">
                        <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-1">Kidokezo (Tip)</p>
                        <p className="text-white/80 text-xs text-left">Huwezi kutumia picha (PNG/JPG) kwa AR. Bidhaa hii inahitaji faili la 3D (.glb). Unaweza kutumia <b>Luma AI</b>, <b>Meshy.ai</b>, au <b>Polycam</b> kubadilisha picha kuwa GLB.</p>
                     </div>
                   )}
                   <button 
                     onClick={() => setShowARView(false)}
                     className="mt-4 px-6 py-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl font-bold transition-all"
                   >
                     Rudi nyuma
                   </button>
                </div>
                {/* @ts-ignore */}
              </model-viewer>

              <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-4 pointer-events-none">
                 <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
                    <p className="text-white/60 text-[10px] font-medium text-center">Use your fingers to rotate and zoom • Bonyeza 'View in your space' kwa AR</p>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4 lg:pt-8">
        {/* Back & Home Buttons */}
        <div className="mb-6 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 group text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-900 group-hover:text-white transition-all">
              <ChevronLeft className="w-4 h-4" />
            </div>
            <span className="font-black uppercase text-[10px] tracking-widest">Rudi Nyuma</span>
          </button>

          <Link 
            to="/"
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all active:scale-95 group"
          >
            <Home className="w-4 h-4" />
            <span className="font-black uppercase text-[10px] tracking-widest">Rudi Nyumbani</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-neutral-100 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden relative group shadow-2xl shadow-neutral-200">
              <img 
                src={(product.imageUrls?.[activeImageIndex] || product.imageUrl) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay sharing */}
              <button 
                onClick={handleShare}
                className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-neutral-900 shadow-xl hover:bg-white transition-all active:scale-90"
              >
                <Share2 className="w-5 h-5" />
              </button>

              {/* 3D/AR Trigger */}
              {product?.model3dUrl && businessConfig?.enableAR === true && (
                <button 
                  onClick={() => setShowARView(true)}
                  className="absolute bottom-6 left-6 px-5 py-2.5 bg-orange-600 text-white rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-600/30 hover:bg-orange-700 transition-all hover:scale-105 active:scale-95"
                >
                  <Box className="w-4 h-4" />
                  View in Space
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {product.imageUrls && product.imageUrls.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-2">
                {product.imageUrls.map((url, idx) => (
                  <button 
                    key={`thumb-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-24 h-24 rounded-3xl overflow-hidden border-2 flex-shrink-0 cursor-pointer transition-all ${activeImageIndex === idx ? 'border-orange-500 ring-8 ring-orange-500/5 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={url} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Right: Product Content */}
          <div className="space-y-6 lg:pl-0">
            {/* Category & Title */}
            <div className="space-y-1">
              <span className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.2em]">{product.category || 'Daily Meals'}</span>
              <h1 className="text-2xl lg:text-4xl font-black text-neutral-900 leading-tight tracking-tight font-display italic uppercase">{product.name}</h1>
              <p className="text-neutral-500 text-sm lg:text-base leading-relaxed max-w-xl font-medium">
                {product.description || 'Flavorful and freshly prepared meal made with premium ingredients and handpicked spices — a comforting and satisfying choice for every occasion.'}
              </p>
            </div>

            {/* Rating & Veg/Non-Veg Indicator */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex items-center gap-1.5 bg-neutral-100 px-3 py-1.5 rounded-xl">
                <Star className="w-4 h-4 text-orange-500 fill-current" />
                <span className="font-bold text-neutral-900 text-xs">{(product.ratingCount || 0) > 0 ? (product.rating || 0).toFixed(1) : '0'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest underline underline-offset-4 decoration-neutral-100">({(product.ratingCount || 0)} Reviews)</span>
                <div className="w-px h-4 bg-neutral-200 mx-1" />
                <div className="w-5 h-5 border border-red-500 rounded-md flex items-center justify-center p-1 shadow-sm">
                  <div className="w-full h-full bg-red-500 rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Price section */}
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl lg:text-4xl font-black text-neutral-900 italic tracking-tighter">
                  {formatCurrency(calculateDiscountedPrice())}
                </span>
                {product.discountPrice && (
                  <span className="text-lg text-neutral-300 line-through font-bold italic">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
              <p className="text-neutral-400 text-[9px] font-black uppercase tracking-widest">( Include all taxes )</p>
            </div>

            <div className="h-px bg-neutral-100 w-full" />

            {/* Options Selector Section */}
            <div className="space-y-8">
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black text-neutral-900 uppercase tracking-widest">Select Options</h3>
                   <div className="flex items-center gap-3">
                     <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Stock: <span className="text-neutral-900">{product.stock || 848} items</span></span>
                     <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">SKU: <span className="text-neutral-900">PPH-{id?.slice(0, 4).toUpperCase()}</span></span>
                   </div>
                 </div>

                 {/* Use Adaptive Options based on category */}
                 <div className="space-y-6">
                    {renderAdaptiveOptions()}
                 </div>
              </div>

              {/* Action and Delivery info */}
              <div className="flex flex-wrap items-center gap-6 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Quantity:</span>
                  <div className="flex items-center gap-4 bg-neutral-100 p-1.5 rounded-full border border-neutral-200/50 shadow-inner">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-orange-600 disabled:opacity-50"
                      disabled={quantity <= 1}
                    >
                      <Minus size={16} strokeWidth={3} />
                    </button>
                    <span className="w-4 text-center font-black text-lg italic tabular-nums text-neutral-900 text-display">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-orange-600"
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5" />
                  Delivery: 55 Mins
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button 
                  onClick={handleAddToCart}
                  className="flex-1 h-16 bg-neutral-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-black/10 gap-2 transition-all active:scale-[0.98]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to Bucket
                </Button>
                <Button 
                  onClick={() => {
                      handleAddToCart();
                      setIsCartOpen(true);
                  }}
                  className="flex-1 h-16 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 gap-2 transition-all active:scale-[0.98]"
                >
                  Buy Now <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Tabs Section */}
        <div className="mt-4 lg:mt-6 border-t border-neutral-100 pt-4 lg:pt-6">
           <div className="flex flex-wrap gap-2 mb-4 p-1.5 bg-neutral-100/50 rounded-2xl w-full lg:w-fit border border-neutral-200/50">
              {['Details', 'Reviews', 'FAQs', 'Sold By'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 lg:flex-none px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all duration-300 ${activeTab === tab ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/50' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {tab === 'Details' && <Info className="w-4 h-4" />}
                    {tab === 'Reviews' && <Star className="w-4 h-4" />}
                    {tab === 'FAQs' && <MessageSquare className="w-4 h-4" />}
                    {tab === 'Sold By' && <Store className="w-4 h-4" />}
                    {tab}
                  </div>
                </button>
              ))}
           </div>

           <div className="space-y-4 max-w-6xl">
              {activeTab === 'Details' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl lg:text-3xl font-black text-neutral-900 uppercase italic tracking-tighter">Additional Details</h2>
                    <p className="text-neutral-400 font-black uppercase text-[9px] tracking-widest">Find the additional info of the Product</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-base lg:text-lg text-neutral-800 leading-relaxed font-bold italic tracking-tight">
                        {product.story || (
                          <>
                            Our <span className="text-orange-600 font-black underline decoration-orange-200 underline-offset-8">{product.name}</span> is a signature creation from Papo Hapo. Prepared using premium ingredients, authentic spices, and time-honored techniques. Every bite delivers a perfect balance of taste, aroma, and texture.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4 bg-white p-5 lg:p-6 rounded-[2rem] border border-neutral-100 shadow-xl shadow-neutral-100">
                        <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2 italic tracking-tighter uppercase">
                          ✨ Why You'll Love It:
                        </h3>
                        <ul className="space-y-3">
                          {(product.highlights && product.highlights.length > 0) ? (
                            product.highlights.map((highlight, idx) => (
                              <li key={`highlight-${idx}`} className="flex items-center gap-4 text-neutral-600 font-bold group">
                                <div className="w-8 h-8 shrink-0 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors text-[10px]">{idx + 1}</div>
                                <span className="text-sm">{highlight}</span>
                              </li>
                            ))
                          ) : (
                            <>
                              <li className="flex items-center gap-4 text-neutral-600 font-bold group">
                                <div className="w-8 h-8 shrink-0 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors text-[10px]">1</div>
                                <span className="text-sm">Premium quality sourced ingredients</span>
                              </li>
                              <li className="flex items-center gap-4 text-neutral-600 font-bold group">
                                <div className="w-8 h-8 shrink-0 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors text-[10px]">2</div>
                                <span className="text-sm">Authentic and traditional preparation</span>
                              </li>
                              <li className="flex items-center gap-4 text-neutral-600 font-bold group">
                                <div className="w-8 h-8 shrink-0 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors text-[10px]">3</div>
                                <span className="text-sm">Fast delivery within 55 minutes</span>
                              </li>
                            </>
                          )}
                        </ul>
                      </div>

                      <div className="space-y-4 bg-neutral-900 p-5 lg:p-6 rounded-[2rem] text-white shadow-2xl">
                        <h3 className="text-lg font-black text-white flex items-center gap-2 italic tracking-tighter uppercase">
                          📝 Step-by-Step Excellence:
                        </h3>
                        <div className="space-y-3">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-neutral-400 italic font-medium leading-relaxed text-sm">
                              {product.qualityPromise?.description || (
                                `"At Papo Hapo, we follow a strict quality standard. From selecting the freshest eggs to aging our basmati rice, every step is monitored to ensure the biryani you receive is of export quality."`
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 px-1">
                            <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-[9px] text-neutral-300">
                              {product.qualityPromise?.certifiedBy || "Quality Certified by Papo Hapo Express"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Reviews' && (
                <div className="space-y-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-4xl lg:text-5xl font-black text-neutral-900 uppercase italic tracking-tighter">Customer Reviews</h2>
                      <p className="text-neutral-400 font-black uppercase text-[10px] tracking-widest mt-2">Real feedback from actual buyers</p>
                    </div>
                    <Button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="h-14 px-8 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 gap-3"
                    >
                      <Plus className="w-5 h-5" /> Give Feedback
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 bg-neutral-50 p-10 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-4 border border-neutral-100">
                      <span className="text-7xl font-black text-neutral-900 italic tracking-tighter">
                         {(product?.ratingCount || 0) > 0 ? (Number(product?.rating) || 0).toFixed(1) : '0.0'}
                      </span>
                      <div className="flex gap-1.5">
                         {[...Array(5)].map((_, i) => (
                           <Star key={`summary-star-${i}`} className={`w-6 h-6 ${i < Math.round((product?.ratingCount || 0) > 0 ? (product?.rating || 0) : 0) ? 'text-orange-500 fill-current' : 'text-neutral-200'}`} />
                         ))}
                      </div>
                      <p className="text-neutral-400 font-black uppercase tracking-widest text-xs">Based on {(product?.ratingCount || 0)} verified reviews</p>
                    </div>

                    <div className="md:col-span-2 space-y-6">
                       {reviews.map((review, idx) => (
                         <div key={review.id} className="p-8 bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all group">
                             <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 rounded-full border-2 border-orange-100 p-1">
                                      <img src={review.userPhoto || `https://ui-avatars.com/api/?name=${review.userName}`} className="w-full h-full rounded-full object-cover" alt="" />
                                   </div>
                                   <div>
                                      <h4 className="font-black text-neutral-900 uppercase italic tracking-tight">{review.userName}</h4>
                                      <div className="flex gap-0.5">
                                         {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-orange-500 fill-current' : 'text-neutral-200'}`} />)}
                                      </div>
                                   </div>
                                </div>
                                <span className="text-[10px] font-black text-neutral-300 uppercase">{new Date(review.createdAt).toLocaleDateString()}</span>
                             </div>
                             <p className="text-neutral-600 font-medium leading-relaxed">{review.comment}</p>
                         </div>
                       ))}
                       {reviews.length === 0 && <p className="text-neutral-400 font-medium italic">Bado hakuna reviews kwa bidhaa hii.</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'FAQs' && (
                <div className="space-y-8">
                  <h2 className="text-4xl lg:text-5xl font-black text-neutral-900 uppercase italic tracking-tighter">Frequently Asked Questions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 bg-neutral-50 rounded-[2.5rem] space-y-3">
                      <h4 className="font-black text-neutral-900 uppercase italic tracking-tight">Je, muda wa kufika ni upi?</h4>
                      <p className="text-neutral-500 font-medium leading-relaxed">Kwa kawaida oda hufika ndani ya dakika 55 kwa maeneo ya karibu na dakika 90 kwa maeneo ya mbali.</p>
                    </div>
                    <div className="p-8 bg-neutral-50 rounded-[2.5rem] space-y-3">
                      <h4 className="font-black text-neutral-900 uppercase italic tracking-tight">Ninawezaje kulipia?</h4>
                      <p className="text-neutral-500 font-medium leading-relaxed">Tunapokea malipo kupitia simu (M-Pesa, Tigo-Pesa, Airtel Money) na kadi za bank.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Sold By' && (
                <div className="bg-neutral-900 rounded-[3.5rem] p-10 lg:p-16 text-white overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-10 opacity-10">
                      <Store className="w-64 h-64 rotate-12" />
                   </div>
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-8">
                        <div className="w-24 h-24 rounded-[2rem] bg-white p-1">
                           <img src={vendor?.logoUrl || `https://ui-avatars.com/api/?name=${vendor?.businessName}`} className="w-full h-full rounded-[1.75rem] object-cover" alt="" />
                        </div>
                        <div className="space-y-2">
                           <Badge className="bg-orange-600 text-white border-none text-[10px] px-3 py-1 font-black uppercase">Verified Merchant</Badge>
                           <h2 className="text-3xl lg:text-4xl font-black italic tracking-tighter uppercase">{vendor?.businessName}</h2>
                           <div className="flex items-center gap-4 text-neutral-400 text-sm font-bold">
                              <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {vendor?.address}</span>
                              <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Open 24/7</span>
                           </div>
                        </div>
                      </div>
                      <p className="text-neutral-400 text-lg leading-relaxed max-w-2xl font-medium">
                        {vendor?.description || 'Tumebobea katika kutoa huduma bora kabisa kwa wateja wetu. Karibu upate bidhaa zenye viwango vya hali ya juu.'}
                      </p>
                      <Button 
                        onClick={() => navigate(`/vendor/${vendor?.id}`)}
                        className="h-14 px-10 bg-white text-neutral-900 hover:bg-orange-600 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                      >
                        Visit Store
                      </Button>
                   </div>
                </div>
              )}
           </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="space-y-6 pt-12">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-neutral-900 uppercase italic tracking-tighter">Similar Products</h3>
              <button className="text-orange-600 text-xs font-black uppercase tracking-widest underline underline-offset-4 decoration-2">View All</button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {similarProducts.map((p) => (
                <Link 
                  key={p.id} 
                  to={`/product/${p.id}`}
                  className="w-40 md:w-56 shrink-0 group"
                >
                  <Card className="bg-white border border-neutral-100 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-square relative overflow-hidden">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      {p.discountPrice && (
                        <Badge className="absolute top-2 left-2 bg-orange-600 text-white border-none font-black text-[8px] px-1.5 py-0.5">SALE</Badge>
                      )}
                    </div>
                    <CardContent className="p-3 md:p-4 space-y-1">
                      <h4 className="font-bold text-xs md:text-sm text-neutral-900 truncate uppercase tracking-tight">{p.name}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-black text-orange-600 italic">TZS {p.discountPrice ? p.discountPrice.toLocaleString() : p.price.toLocaleString()}</span>
                         {p.discountPrice && (
                           <span className="text-[10px] text-neutral-400 line-through font-medium">{p.price.toLocaleString()}</span>
                         )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
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
                    {reviewImages.map((url, idx) => url && (
                      <div key={`review-preview-${idx}`} className="w-20 h-20 rounded-2xl overflow-hidden relative group">
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
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">In-Store Session Active</p>
                      <p className="text-sm font-black text-blue-900 uppercase italic">Section: {tableSession.tableId}</p>
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
                        { id: 'pickup', label: 'Takeaway' },
                        { id: 'walk_in', label: 'In-Store' }
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

                  {orderType === 'walk_in' && !tableSession && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Namba ya Section / Shelf</label>
                      <input 
                        type="text"
                        placeholder="Ingiza namba ya eneo"
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
