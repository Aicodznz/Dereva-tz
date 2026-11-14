import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { VendorProfile, Product, Review, ReviewReply, Coupon } from '../types';
import ReviewSection from './reviews/ReviewSection';
import { CallWaiterModal } from './CallWaiterModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, MapPin, Clock, Phone, Info, 
  ShoppingBag, Plus, Camera, X, MessageSquare,
  ThumbsUp, Share2, Trash2, Reply, ShoppingBasket, Store,
  Instagram, Facebook, MessageCircle, ShieldCheck, Undo2, Box,
  Bed, Wifi, Wind, Monitor, Car, Waves, MapPin as MapPinIcon, Utensils, Beer, Dumbbell, Users,
  Plane, Shirt, Bell, Umbrella, Tag, Sparkles, Zap, Percent, Award, Gift,
  Armchair, Calendar, CheckCircle2, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { LoyaltyCardModal } from './LoyaltyCardModal';
import { useCart } from '../CartContext';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useBusinessConfig } from '../BusinessConfigContext';

function StoreProductImage({
  product,
  vendorCategory,
}: {
  product: Product;
  vendorCategory?: string;
}) {
  const categoryDefault =
    vendorCategory === 'restaurant'
      ? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

  const candidates = React.useMemo(() => {
    const rawList = [
      ...(Array.isArray(product.imageUrls) ? product.imageUrls.filter((u) => typeof u === 'string' && u.includes('res.cloudinary.com')) : []),
      product.imageUrl,
      ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
      categoryDefault,
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of rawList) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed || (!trimmed.startsWith('http') && !trimmed.startsWith('data:image') && !trimmed.startsWith('/'))) continue;
      const normalized = trimmed.includes(' ') ? encodeURI(trimmed) : trimmed;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    }
    return out;
  }, [product.imageUrl, product.imageUrls, categoryDefault]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [product.id, product.imageUrl]);

  const currentSrc = candidates[idx];

  if (!currentSrc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 via-amber-50 to-orange-100 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800 text-orange-500">
        {vendorCategory === 'restaurant' ? (
          <Utensils className="w-9 h-9 opacity-80" />
        ) : (
          <ShoppingBag className="w-9 h-9 opacity-80" />
        )}
        <span className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-orange-700/70 dark:text-orange-300/70 px-2 text-center line-clamp-1">
          {product.name}
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={product.name}
      loading="lazy"
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      onError={() => {
        setIdx((prev) => prev + 1);
      }}
    />
  );
}

export default function VendorStore() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, cartItems, clearCart } = useCart();
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const { config: businessConfig } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'info'>('products');
  const [tableSession, setTableSession] = useState<any>(null);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<any[]>([]);
  const [isBookTableOpen, setIsBookTableOpen] = useState(false);
  const [bookingSeats, setBookingSeats] = useState<number>(2);
  const [selectedTableId, setSelectedTableId] = useState<string>('auto');
  const [bookingDate, setBookingDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState<string>('19:30');
  const [bookingName, setBookingName] = useState<string>('');
  const [bookingPhone, setBookingPhone] = useState<string>('');
  const [bookingPayment, setBookingPayment] = useState<'cash' | 'mpesa' | 'tigopesa' | 'airtelmoney'>('cash');
  const [includeCartPreOrder, setIncludeCartPreOrder] = useState<boolean>(true);
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [confirmedTableBooking, setConfirmedTableBooking] = useState<any>(null);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Zote');
  const [bannerErrored, setBannerErrored] = useState<boolean>(false);

  // Synchronize table parameter or session
  const activeTableNumber = tableNumber || tableSession?.tableId || '';

  useEffect(() => {
    setBannerErrored(false);
  }, [id, vendor?.bannerUrl]);

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

  // Fetch Coupons and Happy Hour Promos
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'coupons'), where('vendorId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(list);
    }, (err) => {
      console.warn("Coupons listener warning:", err.message);
    });
    return () => unsub();
  }, [id]);

  // Listen to Restaurant Dining Tables (sections)
  useEffect(() => {
    if (!id || vendor?.category !== 'restaurant') return;
    const nonTables = new Set(['entrance', 'reception', 'kitchen_window', 'bar_counter', 'restroom', 'indoor_plant', 'structure_divider']);
    const unsub = onSnapshot(collection(db, 'vendors', id, 'sections'), (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((s: any) => !nonTables.has(s.shape || ''));
      setRestaurantTables(list);
    }, (err) => {
      console.warn("Restaurant tables listener warning:", err.message);
    });
    return () => unsub();
  }, [id, vendor?.category]);

  useEffect(() => {
    if (profile?.displayName && !bookingName) setBookingName(profile.displayName);
    if ((profile?.phone || user?.phoneNumber) && !bookingPhone) setBookingPhone(profile?.phone || user?.phoneNumber || '');
  }, [profile, user]);

  useEffect(() => {
    if (searchParams.get('book') === 'table' && vendor?.category === 'restaurant') {
      setIsBookTableOpen(true);
    }
  }, [searchParams, vendor?.category]);

  // Check active Happy Hour
  const activeHappyHourPromo = React.useMemo(() => {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDay = days[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return coupons.find(c => {
      if (c.status && c.status !== 'active') return false;
      if (!c.isHappyHour) return false;
      
      // Day check
      if (c.activeDays && c.activeDays.length > 0 && !c.activeDays.includes(currentDay)) {
        return false;
      }

      // Time window check
      if (c.happyHourStart && c.happyHourEnd) {
        const [sH, sM] = c.happyHourStart.split(':').map(Number);
        const [eH, eM] = c.happyHourEnd.split(':').map(Number);
        const startMins = sH * 60 + (sM || 0);
        const endMins = eH * 60 + (eM || 0);
        if (currentMinutes < startMins || currentMinutes > endMins) return false;
      }

      return true;
    });
  }, [coupons]);

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
        const productsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsList.filter(p => p.hidden !== true));
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

  const visibleProducts = vendor.hideProducts === true ? [] : products;
  const menuCategories = ['Zote', ...Array.from(new Set(visibleProducts.map((p) => (p.category || '').trim()).filter(Boolean)))];
  const filteredProducts = visibleProducts.filter((p) => {
    const matchesCat = selectedMenuCategory === 'Zote' || (p.category || '').trim() === selectedMenuCategory;
    const q = menuSearch.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const openTablesCount = restaurantTables.filter((t) => (t.status || 'available') === 'available').length;

  const fallbackBannerUrl =
    vendor.category === 'restaurant'
      ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80'
      : vendor.category === 'hotel'
      ? 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80'
      : vendor.category === 'pharmacy'
      ? 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1400&q=80'
      : vendor.category === 'salon'
      ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80'
      : 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80';

  const heroBannerSrc = vendor.bannerUrl || fallbackBannerUrl;
  const initials = (vendor.businessName || 'PH')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'PH';

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-28 transition-colors duration-500">
      {/* Compact Editorial Hero Banner */}
      <div className="h-44 sm:h-52 md:h-64 w-full relative overflow-hidden bg-gradient-to-br from-orange-600 via-amber-600 to-rose-700 border-b border-orange-500/20">
        {!bannerErrored && heroBannerSrc ? (
          <img
            src={heroBannerSrc}
            alt={vendor.businessName}
            className="w-full h-full object-cover"
            onError={() => setBannerErrored(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            {vendor.category === 'restaurant' ? (
              <Utensils className="w-24 h-24 text-white" />
            ) : (
              <Store className="w-24 h-24 text-white" />
            )}
          </div>
        )}
        <div
          className={`absolute inset-0 ${
            !bannerErrored && heroBannerSrc
              ? 'bg-gradient-to-t from-black/65 via-black/20 to-black/25'
              : 'bg-gradient-to-t from-black/30 via-transparent to-black/10'
          }`}
        />

        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-30">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 md:w-11 md:h-11 bg-black/40 backdrop-blur-md border border-white/25 rounded-2xl flex items-center justify-center text-white hover:bg-black/60 transition-all shadow-lg active:scale-95 group cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Quick Access Top Tabs */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2 z-30">
          <button
            onClick={() => {
              setActiveTab('reviews');
              const el = document.getElementById('store-content');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-10 px-4 bg-black/40 backdrop-blur-md border border-white/25 rounded-2xl flex items-center gap-1.5 text-white hover:bg-black/60 transition-all shadow-lg font-black uppercase text-[10px] tracking-widest whitespace-nowrap cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
            <span className="hidden sm:inline">Maoni</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('info');
              const el = document.getElementById('store-content');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-10 px-4 bg-black/40 backdrop-blur-md border border-white/25 rounded-2xl flex items-center gap-1.5 text-white hover:bg-black/60 transition-all shadow-lg font-black uppercase text-[10px] tracking-widest whitespace-nowrap cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden sm:inline">Habari</span>
          </button>
        </div>
      </div>

      {/* Vendor Profile Section */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-12 md:-mt-16 relative z-20">
        <div className="relative">
          <div className="bg-white dark:bg-neutral-900 shadow-xl shadow-black/5 rounded-3xl overflow-hidden border border-neutral-100 dark:border-white/10 p-4 sm:p-6 md:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 md:gap-5 min-w-0">
                {/* Logo */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shrink-0 border-2 border-white dark:border-neutral-800 flex items-center justify-center">
                  {vendor.logoUrl ? (
                    <img
                      src={vendor.logoUrl}
                      alt={vendor.businessName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'PH')}`;
                      }}
                    />
                  ) : vendor.category === 'restaurant' ? (
                    <div className="flex flex-col items-center justify-center text-white">
                      <Utensils className="w-6 h-6 md:w-7 md:h-7" />
                      <span className="text-[9px] font-black tracking-widest mt-0.5">{initials}</span>
                    </div>
                  ) : (
                    <span className="text-xl md:text-2xl font-black text-white tracking-tight">{initials}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tight leading-tight truncate">
                      {vendor.businessName}
                    </h1>
                    <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    {vendor.address && (
                      <span className="flex items-center gap-1 truncate max-w-md">
                        <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span className="truncate">{vendor.address}</span>
                      </span>
                    )}
                    {vendor.operatingHours && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {vendor.operatingHours}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Distance & Star Rating Pills */}
              <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    if (vendor?.location) {
                      const originStr = location ? `&origin=${location.lat},${location.lng}` : '';
                      window.open(`https://www.google.com/maps/dir/?api=1${originStr}&destination=${vendor.location.lat},${vendor.location.lng}`, '_blank');
                    } else {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor?.address || vendor?.businessName || '')}`, '_blank');
                    }
                  }}
                  className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3.5 py-1.5 rounded-full border border-emerald-200/80 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-black hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {getDistance() === null ? 'Dar es Salaam' : getDistance()! < 0.5
                      ? `${(getDistance()! * 1000).toFixed(0)}M`
                      : `${getDistance()!.toFixed(1)}KM`}
                  </span>
                </button>

                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  <span className="text-xs font-black text-neutral-900 dark:text-white">{getDisplayRating()}</span>
                  <span className="text-[11px] text-neutral-500 font-bold">({vendor.ratingCount || 0})</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className={`mt-5 pt-4 border-t border-neutral-100 dark:border-white/5 grid ${vendor.category === 'restaurant' ? 'grid-cols-4' : 'grid-cols-3'}`}>
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

              {vendor.category === 'restaurant' && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedTableBooking(null);
                    setIsBookTableOpen(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 border-r border-neutral-100 dark:border-white/5 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors py-2 rounded-2xl group cursor-pointer"
                >
                  <span className="text-[8px] md:text-[10px] font-bold text-orange-500 uppercase tracking-widest">Book Seat</span>
                  <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-base font-black text-orange-600">
                    <Armchair className="w-4 h-4 text-orange-600" /> Weka Meza
                  </div>
                </button>
              )}
              
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
        {/* Table Active Session & Call Waiter Action Banner */}
        {activeTableNumber && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-gradient-to-r dark:from-amber-950/60 dark:via-neutral-900 dark:to-amber-950/60 border border-amber-200 dark:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-black text-sm shadow-md">
                #{activeTableNumber}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" /> Umekaa Meza #{activeTableNumber}
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-neutral-400">
                  Agiza vyakula na vinywaji vyako hapa, vitaletwa moja kwa moja mezani kwako.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setIsCallWaiterOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider h-11 px-5 rounded-2xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <Bell className="w-4 h-4 animate-bounce" />
              Muite Mhudumu / Bili
            </Button>
          </motion.div>
        )}

        {/* Active Happy Hour Live Promotion Banner */}
        {activeHappyHourPromo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-black/20 backdrop-blur-md flex items-center justify-center text-amber-200 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-tight">
                    🔥 OFA YA HAPPY HOUR INAENDELEA! ({activeHappyHourPromo.code})
                  </span>
                  <Badge className="bg-black text-amber-300 font-black text-[9px] uppercase px-2">
                    {activeHappyHourPromo.discountValue}{activeHappyHourPromo.discountType === 'percentage' ? '%' : ' TZS'} OFF
                  </Badge>
                </div>
                <p className="text-[11px] text-orange-100 font-medium">
                  {activeHappyHourPromo.happyHourStart && activeHappyHourPromo.happyHourEnd ? (
                    <span>Muda: {activeHappyHourPromo.happyHourStart} hadi {activeHappyHourPromo.happyHourEnd} • </span>
                  ) : null}
                  Tumia kuponi <b className="underline uppercase tracking-wider">{activeHappyHourPromo.code}</b> wakati wa kulipa!
                </p>
              </div>
            </div>
            <div className="relative z-10 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(activeHappyHourPromo.code);
                  toast.success(`Kuponi '${activeHappyHourPromo.code}' imenakiliwa!`);
                }}
                className="bg-black hover:bg-neutral-900 text-amber-300 font-black text-xs uppercase px-4 h-9 rounded-xl cursor-pointer"
              >
                Nakili Kuponi ({activeHappyHourPromo.code})
              </Button>
            </div>
          </motion.div>
        )}

        {/* Digital Loyalty Stamp Pass Banner (Clean Light & Dark Mode) */}
        {vendor && vendor.loyaltyProgram?.enabled !== false && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3.5 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/50 dark:via-neutral-900 dark:to-amber-950/50 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0 shadow-sm">
                <Award className="w-5 h-5 text-black" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-tight text-amber-900 dark:text-amber-300 flex items-center gap-1.5 truncate">
                  <Gift className="w-3.5 h-3.5 text-orange-600 dark:text-amber-400 shrink-0" /> Mpango wa Uaminifu (VIP Rewards)
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-neutral-300 truncate">
                  Kusanya stempu {vendor.loyaltyProgram?.stampsRequired || 5} ujipatie <strong>{vendor.loyaltyProgram?.rewardDescription || 'Chakula BURE!'}</strong>
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setIsLoyaltyOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black text-xs uppercase px-4 h-9 rounded-xl cursor-pointer shrink-0 shadow-sm"
            >
              Fungua Kadi
            </Button>
          </motion.div>
        )}

        {/* Menu Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 dark:border-white/5 mt-5 pb-3">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {[
              {
                id: 'products',
                label: vendor.category === 'restaurant' ? `Menyu ya Leo (${filteredProducts.length})` : `${t('products') || 'Bidhaa'} (${filteredProducts.length})`,
                icon: vendor.category === 'restaurant' ? Utensils : ShoppingBag
              },
              { id: 'reviews', label: `Maoni (${vendor.ratingCount || 0})`, icon: Star },
              { id: 'info', label: 'Taarifa', icon: Info }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all relative shrink-0 cursor-pointer ${
                  activeTab === tab.id ? 'text-orange-600' : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabVendor"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeTab === 'products' && visibleProducts.length > 0 && (
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder={vendor.category === 'restaurant' ? 'Tafuta chakula...' : 'Tafuta bidhaa...'}
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {vendor.category === 'restaurant' && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setConfirmedTableBooking(null);
                  setIsBookTableOpen(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300 font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Armchair className="w-3.5 h-3.5" />
                <span>Weka Meza{openTablesCount > 0 ? ` (${openTablesCount} Wazi)` : ''}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter Strip */}
        {activeTab === 'products' && menuCategories.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3">
            {menuCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedMenuCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedMenuCategory === cat
                    ? 'bg-orange-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

            {/* Tab Content */}
            <div className="mt-5">
              <AnimatePresence mode="wait">
                {activeTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 md:gap-5"
                  >
                    {filteredProducts.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * idx, ease: "easeOut" }}
                      >
                        <Link 
                          to={product.vendorCategory === 'bus_ticket' || product.category === 'bus_ticket' || product.name.toLowerCase().includes('bus ticket') ? `/product/${product.id}?booking=true` : `/product/${product.id}`}
                          className="group block h-full"
                        >
                          <div className="relative h-full bg-white dark:bg-neutral-900 rounded-2xl md:rounded-3xl border border-neutral-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-orange-200 dark:hover:border-orange-900/50 transition-all duration-300 overflow-hidden group/card flex flex-col justify-between">
                            <div>
                              <div className="aspect-[4/3] relative overflow-hidden bg-orange-50 dark:bg-neutral-800">
                                <StoreProductImage product={product} vendorCategory={vendor.category} />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                
                                <div className="absolute top-2.5 left-2.5">
                                  <Badge className="bg-white/95 dark:bg-black/80 backdrop-blur-md text-neutral-900 dark:text-white border-none px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
                                    {product.category || 'Standard'}
                                  </Badge>
                                </div>

                                {product?.model3dUrl && businessConfig?.enableAR && (
                                  <div className="absolute top-2.5 right-2.5 animate-pulse">
                                    <div className="bg-orange-600 text-white p-1.5 rounded-full shadow-lg border border-white/20">
                                      <Box className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-3 md:p-4 space-y-1.5">
                                <div>
                                  <h4 className="font-black text-sm md:text-base text-neutral-900 dark:text-white group-hover/card:text-orange-600 transition-colors leading-snug line-clamp-1">{product.name}</h4>
                                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">{product.description || 'Verified Quality'}</p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-white/5">
                                  <div>
                                    {product.discountPrice ? (
                                      <div className="flex flex-col leading-tight">
                                        <span className="text-[10px] text-neutral-400 line-through font-bold">TZS {product.price.toLocaleString()}</span>
                                        <span className="text-sm md:text-base font-black text-orange-600 tracking-tight">
                                          TZS {product.discountPrice.toLocaleString()}
                                        </span>
                                      </div>
                                    ) : (
                                      <p className="text-sm md:text-base font-black text-orange-600 tracking-tight">
                                        TZS {product.price.toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                  <span className="bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                    In Stock
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Tactile Add to Cart button */}
                            <div className="px-3 pb-3 md:px-4 md:pb-4">
                              <motion.button 
                                whileTap={{ scale: 0.96 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addItem(product);
                                  toast.success(`${product.name} imeongezwa!`, {
                                    icon: '🛒',
                                    className: 'font-black uppercase text-[10px] tracking-widest'
                                  });
                                }}
                                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide transition-all cursor-pointer"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5px]" />
                                <span>Agiza Sasa</span>
                              </motion.button>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}

                    {(vendor.hideProducts === true || filteredProducts.length === 0) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="col-span-full py-16 text-center bg-neutral-50 dark:bg-neutral-900/30 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-white/10"
                      >
                        <ShoppingBasket className="w-12 h-12 text-orange-300 dark:text-neutral-700 mx-auto mb-3" />
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-1">
                          {vendor.hideProducts === true ? "Bidhaa Hazipatikani" : menuSearch ? "Hakuna Kilichopatikana" : "Hakuna Bidhaa"}
                        </h3>
                        <p className="text-neutral-500 font-medium text-xs">
                          {vendor.hideProducts === true
                            ? "Bidhaa za muuzaji huyu zimefichwa na admin kwa sasa."
                            : menuSearch
                            ? "Jaribu neno jingine au onyesha vyote."
                            : "Tutasasisha menyu hivi punde, karibu tena."}
                        </p>
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

      {/* Floating Call Waiter Button — shown only when seated at a restaurant table */}
      {vendor && vendor.category === 'restaurant' && activeTableNumber && (
        <div className="fixed bottom-6 right-6 z-40">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCallWaiterOpen(true)}
            className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-2xl shadow-orange-950/60 border border-amber-300/40 cursor-pointer"
          >
            <Bell className="w-4 h-4 animate-bounce" />
            <span>Muite Mhudumu #{activeTableNumber}</span>
          </motion.button>
        </div>
      )}

      {/* Call Waiter Live Modal */}
      {vendor && (
        <CallWaiterModal
          isOpen={isCallWaiterOpen}
          onClose={() => setIsCallWaiterOpen(false)}
          vendorId={vendor.id!}
          vendorName={vendor.businessName || 'Mgahawa'}
          initialTableNumber={activeTableNumber}
          customerName=""
        />
      )}

      {/* Loyalty Pass Modal */}
      {vendor && (
        <LoyaltyCardModal
          isOpen={isLoyaltyOpen}
          onClose={() => setIsLoyaltyOpen(false)}
          vendor={vendor}
          initialPhone={user?.phoneNumber || ''}
        />
      )}

      {/* Restaurant Table & Seat Booking Modal */}
      <AnimatePresence>
        {isBookTableOpen && vendor && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              className="w-full sm:max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black/20 flex items-center justify-center">
                    <Armchair className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-base">Weka Meza / Viti</h3>
                    <p className="text-[11px] text-orange-100 font-medium">{vendor.businessName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBookTableOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                {confirmedTableBooking ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <div>
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-none font-black uppercase text-[10px] mb-2">
                        Imethibitishwa • Reserved
                      </Badge>
                      <h4 className="text-xl font-black text-neutral-900 dark:text-white">
                        Namba ya Booking: #{confirmedTableBooking.bookingCode}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Meza #{confirmedTableBooking.tableNumber} • Viti {confirmedTableBooking.seatsCount} • {confirmedTableBooking.scheduledTime}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/70 text-left space-y-1.5 text-xs">
                      <p><strong>Mgahawa:</strong> {vendor.businessName}</p>
                      <p><strong>Mteja:</strong> {confirmedTableBooking.customerName} ({confirmedTableBooking.customerPhone})</p>
                      <p><strong>Malipo:</strong> {confirmedTableBooking.paymentMethodLabel}</p>
                      {confirmedTableBooking.preOrderCount > 0 && (
                        <p><strong>Pre-Order:</strong> Vyakula {confirmedTableBooking.preOrderCount} (TZS {confirmedTableBooking.totalAmount.toLocaleString()})</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsBookTableOpen(false)}
                      className="w-full h-12 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-wider cursor-pointer"
                    >
                      Sawa, Nimemaliza
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Seats count */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-orange-600" /> Idadi ya Viti / Watu
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 4, 6, 8].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setBookingSeats(n)}
                            className={`h-11 rounded-xl font-black text-sm transition-all cursor-pointer border ${
                              bookingSeats === n
                                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-transparent hover:border-orange-400'
                            }`}
                          >
                            {n} {n === 1 ? 'Kiti' : 'Viti'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Specific Table selector if restaurant has configured tables */}
                    {restaurantTables.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                          Chagua Meza (Hiari — Au Acha Auto)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTableId('auto')}
                            className={`p-2.5 rounded-xl text-left border text-xs font-bold cursor-pointer ${
                              selectedTableId === 'auto'
                                ? 'bg-orange-600/15 border-orange-500 text-orange-600'
                                : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                            }`}
                          >
                            ✨ Chagua Bora (Auto)
                          </button>
                          {restaurantTables.map((tbl) => {
                            const isOpen = (tbl.status || 'available') === 'available';
                            return (
                              <button
                                key={tbl.id}
                                type="button"
                                disabled={!isOpen}
                                onClick={() => setSelectedTableId(tbl.id)}
                                className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                                  !isOpen
                                    ? 'opacity-45 cursor-not-allowed bg-neutral-100 dark:bg-neutral-800 border-transparent'
                                    : selectedTableId === tbl.id
                                    ? 'bg-orange-600/15 border-orange-500 text-orange-600 font-black cursor-pointer'
                                    : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-200 font-bold cursor-pointer hover:border-orange-400'
                                }`}
                              >
                                <div>Meza #{tbl.number}</div>
                                <div className="text-[10px] opacity-75">
                                  {tbl.capacity || 4} Viti • {isOpen ? 'Wazi' : tbl.status}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-orange-600" /> Tarehe
                        </label>
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-orange-600" /> Muda wa Kufika
                        </label>
                        <input
                          type="time"
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                        />
                      </div>
                    </div>

                    {/* Optional Cart Pre-order */}
                    {cartItems.filter((it) => it.vendorId === vendor.id).length > 0 && (
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-orange-50 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-500/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCartPreOrder}
                          onChange={(e) => setIncludeCartPreOrder(e.target.checked)}
                          className="mt-1 accent-orange-600 w-4 h-4"
                        />
                        <div className="text-xs">
                          <p className="font-black text-neutral-900 dark:text-white">
                            Agiza mapema (Pre-Order) vyakula vilivyo kwenye kikapu chako (
                            {cartItems.filter((it) => it.vendorId === vendor.id).length})
                          </p>
                          <p className="text-neutral-500 mt-0.5">
                            Utakuta vimeanza kuandaliwa ukifika mezani!
                          </p>
                        </div>
                      </label>
                    )}

                    {/* Customer Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500">Jina Lako *</label>
                        <input
                          type="text"
                          placeholder="Mfano: Juma Hassan"
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-500">Namba ya Simu *</label>
                        <input
                          type="tel"
                          placeholder="Mfano: 0712345678"
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-bold text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700"
                        />
                      </div>
                    </div>

                    {/* Payment preference */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-wider text-neutral-500">Njia ya Malipo</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { id: 'cash', label: '💵 Lipa Mgahawani (Cash)' },
                          { id: 'mpesa', label: '📱 M-Pesa' },
                          { id: 'tigopesa', label: '📱 Tigo Pesa' },
                          { id: 'airtelmoney', label: '📱 Airtel Money' }
                        ].map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setBookingPayment(pm.id as any)}
                            className={`h-10 px-3 rounded-xl font-bold border text-left transition-all cursor-pointer ${
                              bookingPayment === pm.id
                                ? 'bg-orange-600/15 border-orange-500 text-orange-600'
                                : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={bookingSubmitting}
                      onClick={async () => {
                        if (!bookingName.trim() || bookingPhone.replace(/\D/g, '').length < 9) {
                          toast.error('Tafadhali jaza jina lako na namba sahihi ya simu.');
                          return;
                        }
                        setBookingSubmitting(true);
                        try {
                          const code = `TBL-${Math.floor(1000 + Math.random() * 9000)}`;
                          const openTables = restaurantTables.filter((t) => (t.status || 'available') === 'available');
                          const chosenTable =
                            selectedTableId !== 'auto'
                              ? restaurantTables.find((t) => t.id === selectedTableId)
                              : openTables.find((t) => (Number(t.capacity) || 4) >= bookingSeats) || openTables[0];
                          const tableNum = chosenTable?.number ? String(chosenTable.number) : String(Math.floor(1 + Math.random() * 12));
                          const vendorPreItems = includeCartPreOrder
                            ? cartItems.filter((it) => it.vendorId === vendor.id).map((it) => ({
                                id: it.id,
                                name: it.name,
                                price: Number(it.price) || 0,
                                quantity: Number(it.quantity) || 1
                              }))
                            : [];
                          const preTotal = vendorPreItems.reduce((s, it) => s + it.price * it.quantity, 0);
                          const scheduledTime = `${bookingDate} saa ${bookingTime}`;
                          const pmLabel =
                            bookingPayment === 'mpesa'
                              ? 'M-Pesa'
                              : bookingPayment === 'tigopesa'
                              ? 'Tigo Pesa'
                              : bookingPayment === 'airtelmoney'
                              ? 'Airtel Money'
                              : 'Lipa Mgahawani (Cash)';

                          if (chosenTable?.id) {
                            await setDoc(
                              doc(db, 'vendors', vendor.id!, 'sections', chosenTable.id),
                              {
                                status: 'reserved',
                                reservation: {
                                  bookingCode: code,
                                  customerName: bookingName.trim(),
                                  customerPhone: bookingPhone.trim(),
                                  seatsCount: bookingSeats,
                                  scheduledTime,
                                  preOrderItems: vendorPreItems,
                                  totalAmount: preTotal,
                                  paymentMethod: bookingPayment,
                                  channel: 'app',
                                  createdAt: Date.now()
                                }
                              },
                              { merge: true }
                            );
                          }

                          await setDoc(doc(db, 'tables', code), {
                            bookingCode: code,
                            vendorId: vendor.id,
                            vendorName: vendor.businessName,
                            vendorAddress: vendor.address || '',
                            tableId: chosenTable?.id || null,
                            tableNumber: tableNum,
                            seatsCount: bookingSeats,
                            scheduledTime,
                            customerName: bookingName.trim(),
                            customerPhone: bookingPhone.trim(),
                            status: 'reserved',
                            preOrderItems: vendorPreItems,
                            totalAmount: preTotal,
                            paymentMethod: bookingPayment,
                            paymentMethodLabel: pmLabel,
                            channel: 'app',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                          });

                          await addDoc(collection(db, 'orders'), {
                            customerId: user?.uid || `app-guest-${bookingPhone.replace(/\D/g, '')}`,
                            vendorId: vendor.id,
                            vendorName: vendor.businessName,
                            customerName: bookingName.trim(),
                            customerPhone: bookingPhone.trim(),
                            items:
                              vendorPreItems.length > 0
                                ? vendorPreItems
                                : [{ id: code, name: `Booking Meza #${tableNum} (Viti ${bookingSeats})`, price: 0, quantity: 1 }],
                            totalAmount: preTotal,
                            subtotal: preTotal,
                            status: 'pending',
                            type: 'restaurant',
                            orderSource: 'online',
                            orderType: 'booking',
                            subType: 'table_booking',
                            isTableBooking: true,
                            bookingCode: code,
                            tableId: chosenTable?.id || null,
                            tableNumber: tableNum,
                            peopleCount: bookingSeats,
                            reservationTime: scheduledTime,
                            paymentMethod: bookingPayment,
                            paymentMethodLabel: pmLabel,
                            paymentStatus: 'pending',
                            notes: `Table Booking #${code} | Meza #${tableNum} | Viti: ${bookingSeats} | Muda: ${scheduledTime}`,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                          });

                          if (vendorPreItems.length > 0) {
                            clearCart();
                          }

                          setConfirmedTableBooking({
                            bookingCode: code,
                            tableNumber: tableNum,
                            seatsCount: bookingSeats,
                            scheduledTime,
                            customerName: bookingName.trim(),
                            customerPhone: bookingPhone.trim(),
                            paymentMethodLabel: pmLabel,
                            preOrderCount: vendorPreItems.length,
                            totalAmount: preTotal
                          });
                          toast.success(`Meza #${tableNum} imehifadhiwa kikamilifu!`);
                        } catch (err) {
                          console.error('Table booking error:', err);
                          toast.error('Imeshindikana kuhifadhi meza. Tafadhali jaribu tena.');
                        } finally {
                          setBookingSubmitting(false);
                        }
                      }}
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-110 text-white font-black uppercase tracking-wider shadow-lg cursor-pointer"
                    >
                      {bookingSubmitting ? 'Inahifadhi Meza...' : `Thibitisha Meza (${bookingSeats} Viti)`}
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
