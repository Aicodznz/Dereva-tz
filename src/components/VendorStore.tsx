import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { VendorProfile, Product, Review, ReviewReply } from '../types';
import ReviewSection from './reviews/ReviewSection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, MapPin, Clock, Phone, Info, 
  ShoppingBag, Plus, Camera, X, MessageSquare,
  ThumbsUp, Share2, Trash2, Reply, ShoppingBasket, Store,
  Instagram, Facebook, MessageCircle, ShieldCheck, Undo2, Box,
  Bed, Wifi, Wind, Monitor, Car, Waves, MapPin as MapPinIcon, Utensils, Beer, Dumbbell, Users,
  Plane, Shirt, Bell, Umbrella
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useCart } from '../CartContext';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useBusinessConfig } from '../BusinessConfigContext';

export default function VendorStore() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { config: businessConfig } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'info'>('products');
  const [tableSession, setTableSession] = useState<any>(null);
  const [location] = useState(() => {
    const saved = localStorage.getItem('omniserve_user_location');
    return saved ? JSON.parse(saved) : { lat: -6.7924, lng: 39.2083 };
  });

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getDistance = () => {
    if (!vendor?.location) return null;
    return calculateDistance(location.lat, location.lng, vendor.location.lat, vendor.location.lng);
  };

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

    const vUnsub = onSnapshot(doc(db, 'vendors', id), (vDoc) => {
      if (vDoc.exists()) {
        setVendor({ id: vDoc.id, ...vDoc.data() } as VendorProfile);
      }
    }, (error) => {
      console.warn("Restricted access or error listening to vendor:", error.message);
    });

    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('vendorId', '==', id));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'products');
        setLoading(false);
      }
    };

    const pUnsub = onSnapshot(
      query(collection(db, 'products'), where('vendorId', '==', id)), 
      () => fetchProducts(),
      (error: any) => {
        if (error.message?.includes('permission')) return;
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    return () => {
      vUnsub();
      pUnsub();
    };
  }, [id]);

  const getDisplayRating = () => {
    const vRating = parseFloat(vendor?.rating?.toString() || '0');
    return vRating > 0 ? vRating.toFixed(1) : '0.0';
  };

  const formatDate = (date: any) => {
    if (!date) return 'Leo';
    try {
      if (typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString();
      }
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Leo';
      return d.toLocaleDateString();
    } catch (e) {
      return 'Leo';
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
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-32 transition-colors duration-500">
      {/* Header Image */}
      <div className="h-72 md:h-[32rem] w-full relative overflow-hidden bg-orange-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
        {vendor.bannerUrl ? (
          <motion.img 
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            key={vendor.bannerUrl}
            src={vendor.bannerUrl} 
            alt={vendor.businessName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80';
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 via-orange-600 to-orange-950 flex items-center justify-center relative overflow-hidden">
            <motion.div 
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.4, 1]
              }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute w-[800px] h-[800px] border-[80px] border-white/5 rounded-full blur-3xl"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-white/10" />
            <Store className="w-32 h-32 text-white/10 relative z-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-neutral-950 via-transparent to-black/20" />
        
        <div className="absolute top-6 left-6 z-30">
          <button 
            onClick={() => navigate(-1)}
            className="w-12 h-12 bg-white/20 backdrop-blur-2xl border border-white/30 rounded-2xl flex items-center justify-center text-white hover:bg-white/40 transition-all shadow-2xl active:scale-95 group"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Quick Access Top Tabs */}
        <div className="absolute top-6 right-6 flex items-center gap-2 md:gap-3 z-30">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setActiveTab('reviews');
              const el = document.getElementById('store-content');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-12 px-5 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl flex items-center gap-2 text-white hover:bg-white/20 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
          >
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="hidden sm:inline">Maoni</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setActiveTab('info');
              const el = document.getElementById('store-content');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-12 px-5 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl flex items-center gap-2 text-white hover:bg-white/20 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
          >
            <Info className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Habari</span>
          </motion.button>
        </div>
      </div>

      {/* Vendor Profile Section */}
      <div className="max-w-5xl mx-auto px-4 -mt-24 md:-mt-32 relative z-20">
        <div className="relative">
          {/* Distance Badge */}
          <div className="absolute -top-4 md:-top-10 left-4 md:left-6 z-10 transition-all active:scale-95">
            <button 
              onClick={() => {
                if (vendor?.location) {
                  const originStr = location ? `&origin=${location.lat},${location.lng}` : '';
                  window.open(`https://www.google.com/maps/dir/?api=1${originStr}&destination=${vendor.location.lat},${vendor.location.lng}`, '_blank');
                } else {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor?.address || vendor?.businessName || '')}`, '_blank');
                }
              }}
              className="bg-[#E6F6EF] dark:bg-green-950/30 text-[#00A756] px-5 py-2 rounded-full border border-green-100/50 dark:border-green-900/40 flex items-center gap-2 shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <MapPin className="w-4 h-4 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[12px] md:text-[16px] font-black uppercase tracking-tight leading-none">
                {getDistance() === null ? 'N/A' : getDistance()! < 0.5 
                  ? `${(getDistance()! * 1000).toFixed(0)}M` 
                  : `${getDistance()!.toFixed(1)}KM`}
              </span>
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden border border-neutral-100 dark:border-white/5 p-4 sm:p-6 md:p-12">
            {/* Rating - Top Right */}
            <div className="absolute top-1.5 right-4 md:top-12 md:right-12">
              <div className="flex items-center gap-1 opacity-95">
                 <span className="text-[10px] md:text-base font-black text-neutral-900 dark:text-white uppercase tracking-tighter">Star</span>
                 <Star className="w-3 h-3 md:w-6 md:h-6 text-yellow-400 fill-current" />
                 <span className="text-xs md:text-2xl font-black text-neutral-900 dark:text-white">
                   {getDisplayRating()}
                 </span>
                 <span className="text-neutral-400 font-bold text-[9px] md:text-base">({vendor.ratingCount || 0})</span>
              </div>
            </div>

            <div className="flex flex-row items-center md:items-start gap-2 md:gap-8">
              {/* Logo */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-14 h-14 sm:w-20 sm:h-20 md:w-32 md:h-32 rounded-2xl md:rounded-3xl overflow-hidden bg-white dark:bg-neutral-800 shadow-xl shadow-black/5 shrink-0 border-2 md:border-4 border-white dark:border-neutral-950"
              >
                {vendor.logoUrl ? (
                  <img 
                    src={vendor.logoUrl} 
                    alt={vendor.businessName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Store className="w-8 h-8 md:w-10 md:h-10 text-neutral-300" />
                  </div>
                )}
              </motion.div>

              <div className="flex-1 min-w-0 flex flex-col items-start text-left gap-0.5 md:gap-2 pt-1 md:pt-2">
                <div className="flex flex-nowrap items-center gap-1.5 md:gap-3">
                  <div className="flex -space-x-0.5 shrink-0">
                    <div className="w-4 h-4 md:w-6 md:h-6 bg-orange-600 rounded-md flex items-center justify-center text-white font-black text-[9px] md:text-xs">P</div>
                    <div className="w-4 h-4 md:w-6 md:h-6 bg-blue-600 rounded-md flex items-center justify-center text-white">
                      <Plus className="w-2 md:w-3 md:h-3 stroke-[4px]" />
                    </div>
                  </div>
                  <h1 className="text-[17px] md:text-4xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter leading-tight truncate w-full max-w-[120px] xs:max-w-[170px] md:max-w-none">
                    {vendor.businessName}
                  </h1>
                </div>
                                
                {/* Category/Description line removed per user request */}
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-neutral-100 dark:border-white/5 grid grid-cols-3">
              <button 
                onClick={() => {
                  const el = document.getElementById('store-content');
                  el?.scrollIntoView({ behavior: 'smooth' });
                  setActiveTab('products');
                }}
                className="flex flex-col items-center justify-center gap-1.5 border-r border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors py-2 rounded-2xl group"
              >
                <span className="text-[8px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">Products</span>
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-base font-black text-neutral-900 dark:text-white">
                  <ShoppingBag className="w-4 h-4 text-orange-600" /> Bidhaa
                </div>
              </button>
              
              <Link 
                to={vendor?.ownerUid ? `/chat?to=${vendor.ownerUid}` : '#'}
                className="flex flex-col items-center justify-center gap-1.5 border-r border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors py-2 rounded-2xl group px-2"
              >
                <span className="text-[8px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">Chat</span>
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-base font-black text-neutral-900 dark:text-white">
                   <MessageSquare className="w-4 h-4 text-orange-600" /> Chati
                </div>
              </Link>

              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: vendor.businessName,
                      text: vendor.description,
                      url: window.location.href
                    }).catch(console.error);
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Link copied to clipboard!');
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors py-2 rounded-2xl group"
              >
                <span className="text-[8px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">Share</span>
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-base font-black text-neutral-900 dark:text-white">
                  <Share2 className="w-4 h-4 text-orange-600" /> Shea
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="store-content" className="max-w-6xl mx-auto px-4 md:px-6"> 
        {/* Tabs */}
        <div className="flex gap-10 border-b border-neutral-100 dark:border-white/5 mt-6 md:mt-12 overflow-x-auto no-scrollbar relative">
              {[
                { id: 'products', label: t('products') || 'Bidhaa', icon: ShoppingBag },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-5 text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-all relative shrink-0 ${
                    activeTab === tab.id ? 'text-orange-600' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                  }`}
                >
                  <tab.icon className={`w-4.5 h-4.5 ${activeTab === tab.id ? 'animate-bounce' : ''}`} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTabVendor"
                      className="absolute bottom-0 left-0 right-0 h-1.5 bg-orange-600 rounded-full shadow-[0_0_20px_rgba(234,88,12,0.6)]" 
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="mt-12">
              <AnimatePresence mode="wait">
                {activeTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-10"
                  >
                    {products.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * idx, ease: "easeOut" }}
                      >
                        <Link 
                          to={product.vendorCategory === 'bus_ticket' || product.category === 'bus_ticket' || product.name.toLowerCase().includes('bus ticket') ? '/service/bus_ticket' : `/product/${product.id}`}
                          className="group block h-full"
                        >
                          <div className="relative h-full bg-white dark:bg-neutral-900 rounded-[1.5rem] md:rounded-[3.5rem] border border-neutral-100 dark:border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_60px_rgba(234,88,12,0.18)] transition-all duration-700 overflow-hidden group/card">
                            <div className="aspect-[3/4] relative overflow-hidden bg-neutral-50 dark:bg-neutral-800 m-1.5 md:m-3 rounded-[1.2rem] md:rounded-[2.8rem]">
                              <img 
                                src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                                }}
                                referrerPolicy="no-referrer"
                              />
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              
                              <div className="absolute top-4 left-4">
                                <Badge className="bg-white/90 dark:bg-black/80 backdrop-blur-md text-neutral-900 dark:text-white border-none px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] rounded-full">
                                  {product.category || 'Standard'}
                                </Badge>
                              </div>

                              {product?.model3dUrl && businessConfig?.enableAR && (
                                <div className="absolute top-4 right-4 animate-pulse">
                                  <div className="bg-orange-600 text-white p-2 rounded-full shadow-lg shadow-orange-600/40 border border-white/20">
                                    <Box className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}

                              <motion.button 
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addItem(product);
                                  toast.success(`${product.name} imeongezwa!`, {
                                    icon: '🛒',
                                    className: 'font-black uppercase text-[10px] tracking-widest'
                                  });
                                }}
                                className="absolute bottom-2 right-2 md:bottom-5 md:right-5 w-8 h-8 md:w-14 md:h-14 bg-orange-600 text-white rounded-lg md:rounded-2xl shadow-2xl flex items-center justify-center hover:bg-orange-700 transition-all transform z-10"
                              >
                                <Plus className="w-4 h-4 md:w-7 md:h-7" />
                              </motion.button>
                            </div>
                            
                            <div className="p-3 md:p-8 pt-2 md:pt-4 space-y-2 md:space-y-4">
                              <div className="space-y-0.5 md:space-y-1.5">
                                <h4 className="font-[900] text-sm md:text-xl text-neutral-900 dark:text-white group-hover/card:text-orange-600 transition-colors uppercase italic tracking-tighter leading-none line-clamp-1 md:line-clamp-none">{product.name}</h4>
                                <p className="text-[9px] md:text-[11px] text-neutral-400 font-bold uppercase tracking-[0.2em] line-clamp-1 italic">{product.description || 'Verified Quality'}</p>
                              </div>

                              <div className="flex items-center justify-between pt-2 md:pt-4 border-t border-neutral-100 dark:border-white/5">
                                <div className="space-y-0.5">
                                  {product.discountPrice ? (
                                    <div className="flex flex-col">
                                      <span className="text-[8px] md:text-[11px] text-neutral-400 line-through font-bold">TZS {product.price.toLocaleString()}</span>
                                      <span className="text-sm md:text-xl font-[900] text-orange-600 italic tracking-tighter">
                                        TZS {product.discountPrice.toLocaleString()}
                                      </span>
                                    </div>
                                  ) : (
                                    <p className="text-sm md:text-xl font-[900] text-orange-600 italic tracking-tighter">
                                      TZS {product.price.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <div className="hidden xs:block bg-orange-50 dark:bg-orange-900/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[7px] md:text-[9px] font-black text-orange-600 uppercase tracking-widest">
                                  In Stock
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}

                    {products.length === 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="col-span-full py-32 text-center bg-neutral-50 dark:bg-neutral-900/30 rounded-[4rem] border-2 border-dashed border-neutral-100 dark:border-white/5 relative overflow-hidden"
                      >
                        <motion.div 
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ShoppingBasket className="w-20 h-20 text-orange-100 dark:text-neutral-800 mx-auto mb-8 stroke-[1px]" />
                        </motion.div>
                        <h3 className="text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter mb-2">Hakuna Bidhaa</h3>
                        <p className="text-neutral-400 font-bold uppercase tracking-[0.2em] text-[10px]">Tutasasisha hivi punde, Karibu tena.</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}


                {activeTab === 'reviews' && (
                  <motion.div
                    key="reviews"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    className="space-y-12"
                  >
                    {id && (
                      <ReviewSection 
                        targetId={id} 
                        targetType="vendor"
                        isVendor={vendor?.ownerUid === user?.uid}
                      />
                    )}
                  </motion.div>
                )}

                {activeTab === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    className="max-w-4xl space-y-12"
                  >
                    {/* Hotel Specific Section */}
                    {vendor.category === 'hotel' && (
                      <div className="space-y-12 mb-12">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-2">
                            <Bed className="w-5 h-5 text-orange-600" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Rooms</p>
                            <p className="text-xl font-black text-neutral-900 dark:text-white uppercase italic">{vendor.numberOfRooms || 'N/A'}</p>
                          </div>
                          <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-2">
                            <Star className="w-5 h-5 text-orange-600" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</p>
                            <p className="text-xl font-black text-neutral-900 dark:text-white uppercase italic">{vendor.hotelCategory || 'Standard'}</p>
                          </div>
                          <div className="p-6 bg-neutral-50 dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 space-y-2 col-span-2">
                             <div className="flex justify-between items-end h-full">
                               <div>
                                 <div className="flex items-center gap-1.5 mb-1">
                                   <Clock className="w-4 h-4 text-orange-600" />
                                   <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Check In/Out</p>
                                 </div>
                                 <p className="text-sm font-black text-neutral-900 dark:text-white uppercase italic">{vendor.operatingHours}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Available</p>
                                  <Badge className="bg-green-500 text-white border-none font-black text-[9px] px-3">READY</Badge>
                               </div>
                             </div>
                          </div>
                        </div>

                        {/* Room Pricing */}
                        {vendor.roomPricing && (
                          <div className="space-y-6">
                             <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white flex items-center gap-2">
                               <ShieldCheck className="w-6 h-6 text-orange-600" /> Room Rates & Availability
                             </h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                               {[
                                 { key: 'single', label: 'Single Room', price: vendor.roomPricing.single },
                                 { key: 'double', label: 'Double Room', price: vendor.roomPricing.double },
                                 { key: 'vip', label: 'VIP / Suite', price: vendor.roomPricing.vip }
                               ].map(item => item.price && (
                                 <div key={item.key} className="p-8 bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-xl shadow-black/5 flex flex-col justify-between group hover:border-orange-500/20 transition-all">
                                    <div className="space-y-2">
                                      <h5 className="text-lg font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white">{item.label}</h5>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Per Night</p>
                                    </div>
                                    <div className="mt-8 flex items-baseline gap-2">
                                      <span className="text-2xl font-black text-orange-600 italic">TZS {item.price.toLocaleString()}</span>
                                    </div>
                                    <Button className="mt-6 w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-2xl h-12 font-black uppercase tracking-widest text-[9px] group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                      Book Now
                                    </Button>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}

                        {/* Gallery Section */}
                        {vendor.galleryPhotos && vendor.galleryPhotos.length > 0 && (
                          <div className="space-y-6">
                             <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white flex items-center gap-2">
                               <Camera className="w-6 h-6 text-orange-600" /> Hotel Gallery
                             </h4>
                             <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
                                {vendor.galleryPhotos.map((photo, i) => (
                                  <motion.div 
                                    key={i} 
                                    whileHover={{ scale: 1.02 }}
                                    className="min-w-[280px] h-48 rounded-[2rem] overflow-hidden snap-center shadow-lg border-2 border-white dark:border-neutral-800"
                                  >
                                    <img src={photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </motion.div>
                                ))}
                             </div>
                          </div>
                        )}

                        {/* Amenities Grid */}
                        {vendor.amenities && vendor.amenities.length > 0 && (
                          <div className="space-y-6">
                            <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white">Amenities & Features</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {vendor.amenities.map(id => {
                                const amenity = [
                                  { id: 'wifi', label: 'WiFi', icon: Wifi },
                                  { id: 'parking', label: 'Parking', icon: Car },
                                  { id: 'pool', label: 'Swimming Pool', icon: Waves },
                                  { id: 'restaurant', label: 'Restaurant', icon: Utensils },
                                  { id: 'bar', label: 'Bar', icon: Beer },
                                  { id: 'gym', label: 'Gym', icon: Dumbbell },
                                  { id: 'conference', label: 'Events', icon: Users },
                                  { id: 'shuttle', label: 'Airport', icon: Plane },
                                  { id: 'ac', label: 'AC', icon: Wind },
                                  { id: 'laundry', label: 'Laundry', icon: Shirt },
                                  { id: 'room_service', label: 'Room Service', icon: Bell },
                                  { id: 'security', label: 'Security', icon: ShieldCheck },
                                  { id: 'beach', label: 'Beach', icon: Umbrella },
                                ].find(a => a.id === id);
                                
                                if (!amenity) return null;
                                
                                return (
                                  <div key={id} className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                                    <amenity.icon className="w-4 h-4 text-orange-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400">{amenity.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                      <div className="space-y-6">
                        <h3 className="text-3xl md:text-5xl font-[900] text-neutral-900 dark:text-white uppercase italic tracking-tighter">Maelezo ya Ziada</h3>
                        <div className="prose dark:prose-invert">
                          <p className="text-lg md:text-xl text-neutral-500 font-medium leading-relaxed italic">
                            {vendor.description || 'Sisi ni wataalamu wa kutoa huduma bora na bidhaa za hali ya juu kwa wateja wetu. Karibu ujionee tofauti na ubora wa dhati.'}
                          </p>
                        </div>
                        
                        <div className="space-y-4 pt-6">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400">Our Features</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              { label: 'Express Delivery', icon: Clock },
                              { label: 'Quality Verified', icon: ShieldCheck },
                              { label: '24/7 Support', icon: Phone },
                              { label: 'Easy Returns', icon: Undo2 }
                            ].map((feature, i) => (
                              <div key={i} className="flex items-center gap-4 p-4 bg-white/50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 rounded-3xl group hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all shadow-sm">
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                  <feature.icon className="w-5 h-5 pointer-events-none" />
                                </div>
                                <span className="text-[12px] font-black uppercase tracking-widest text-neutral-900 dark:text-white italic">{feature.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="bg-neutral-50 dark:bg-white/5 rounded-[3rem] p-10 space-y-8 border border-neutral-100 dark:border-white/5 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                           <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-neutral-400">Contacts & Socials</h4>
                           
                           <div className="space-y-6">
                             <div className="flex gap-6 items-start">
                               <div className="w-14 h-14 bg-white dark:bg-neutral-900 rounded-[1.2rem] flex items-center justify-center shadow-xl shrink-0 group-hover:rotate-12 transition-transform">
                                 <MapPin className="w-6 h-6 text-orange-600" />
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 italic">Location</p>
                                 <p className="text-sm font-[900] text-neutral-900 dark:text-white uppercase italic tracking-tighter leading-tight">{vendor.address}</p>
                               </div>
                             </div>

                             <div className="flex gap-6 items-start">
                               <div className="w-14 h-14 bg-white dark:bg-neutral-900 rounded-[1.2rem] flex items-center justify-center shadow-xl shrink-0 group-hover:rotate-12 transition-transform">
                                 <Phone className="w-6 h-6 text-green-500" />
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 italic">Phone Number</p>
                                 <p className="text-sm font-[900] text-neutral-900 dark:text-white uppercase italic tracking-tighter leading-tight">{vendor.phoneNumber || 'Huijawekwa'}</p>
                               </div>
                             </div>
                           </div>

                           <div className="pt-8 border-t border-neutral-200 dark:border-white/10 space-y-4">
                             {vendor.socialLinks && (Object.values(vendor.socialLinks).some(v => v)) ? (
                               <div className="flex flex-wrap gap-4">
                                  {vendor.socialLinks.whatsapp && (
                                    <a 
                                      href={`https://wa.me/${vendor.socialLinks.whatsapp.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-green-500/40"
                                    >
                                      <MessageCircle className="w-7 h-7" />
                                    </a>
                                  )}
                                  {vendor.socialLinks.instagram && (
                                    <a 
                                      href={`https://instagram.com/${vendor.socialLinks.instagram.replace('@', '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                                    >
                                      <Instagram className="w-7 h-7" />
                                    </a>
                                  )}
                                  {vendor.socialLinks.facebook && (
                                    <a 
                                      href={vendor.socialLinks.facebook.startsWith('http') ? vendor.socialLinks.facebook : `https://facebook.com/${vendor.socialLinks.facebook}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-blue-600/40"
                                    >
                                      <Facebook className="w-7 h-7" />
                                    </a>
                                  )}
                               </div>
                             ) : (
                               <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 italic">Hakuna mitandao iliyounganishwa.</p>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
    </div>
  );
}
