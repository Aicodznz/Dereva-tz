import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import { VendorProfile, Product } from '../types';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from './ui/Skeleton';
import { 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, Star, 
  Search, Bell, MapPin, ChevronRight, ShoppingBag, Tag, Plus, ShoppingBasket,
  FileText, Smartphone, Box, Dog, Bus, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import LocationPicker from './LocationPicker';

import { useLanguage } from '../LanguageContext';
import { useCart } from '../CartContext';
import HowToOrder from './HowToOrder';
import { useHeader } from '../HeaderContext';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { addItem } = useCart();
  const { config: businessConfig } = useBusinessConfig();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<{id: string, title: string, sub: string, img: string}[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isMapViewOnly, setIsMapViewOnly] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [tableSession, setTableSession] = useState<any>(null);
  const [location, setLocation] = useState(() => {
    const saved = localStorage.getItem('omniserve_user_location');
    return saved ? JSON.parse(saved) : {
      address: '',
      lat: -6.7924,
      lng: 39.2083
    };
  });

  const { setLocation: setHeaderLocation, setOnLocationClick, searchQuery: contextSearchQuery } = useHeader();
  
  const [isLoading, setIsLoading] = useState(true);

  const storeScrollRef = useRef<HTMLDivElement>(null);
  const bannerScrollRef = useRef<HTMLDivElement>(null);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator && !localStorage.getItem('omniserve_user_location')) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            address: t('current_location') || 'Eneo la sasa',
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(newLoc);
          localStorage.setItem('omniserve_user_location', JSON.stringify(newLoc));
          setHeaderLocation(newLoc.address);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, [t, setHeaderLocation]);

  // Auto-slide for Nearby Stores
  useEffect(() => {
    if (vendors.length === 0) return;

    const interval = setInterval(() => {
      if (storeScrollRef.current) {
        const container = storeScrollRef.current;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        
        if (container.scrollLeft >= maxScroll - 20) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          const card = container.firstElementChild as HTMLElement;
          const style = window.getComputedStyle(container);
          const gap = parseInt(style.columnGap || style.gap || '0');
          const scrollAmount = card ? card.offsetWidth + gap : 300;
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [vendors.length]);

  // Auto-slide for Banners
  useEffect(() => {
    if (banners.length === 0) return;

    const interval = setInterval(() => {
      if (bannerScrollRef.current) {
        const container = bannerScrollRef.current;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        
        if (container.scrollLeft >= maxScroll - 20) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          const card = container.firstElementChild as HTMLElement;
          const style = window.getComputedStyle(container);
          const gap = parseInt(style.columnGap || style.gap || '0');
          const scrollAmount = card ? card.offsetWidth + gap : 300;
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }
    }, 5500);

    return () => clearInterval(interval);
  }, [banners.length]);

  // Auto-prompt location for new users/guests
  useEffect(() => {
    const isLocationSet = localStorage.getItem('omniserve_location_verified');
    if (!isLocationSet) {
      const timer = setTimeout(() => {
        setIsLocationPickerOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update localStorage when location changes
  const handleLocationSelect = (newLoc: any) => {
    setLocation(newLoc);
    localStorage.setItem('omniserve_user_location', JSON.stringify(newLoc));
    localStorage.setItem('omniserve_location_verified', 'true');
  };

  // Helper to calculate distance in km (Haversine formula)
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

  // Sync with Header Context
  useEffect(() => {
    setHeaderLocation(location.address);
    setOnLocationClick(() => () => setIsLocationPickerOpen(true));
  }, [location.address, setHeaderLocation, setOnLocationClick]);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const effectiveSearchQuery = contextSearchQuery;

  const filteredVendors = vendors.filter(v => 
    v.businessName.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
    v.category?.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
    v.description?.toLowerCase().includes(effectiveSearchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(effectiveSearchQuery.toLowerCase())
  );

  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Automatic Location Prompt & Watch
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const currentLoc = locationRef.current;
          
          // Only update reverse geocode if location changed significantly (> 200m)
          // or if address is not set yet
          const distMoved = calculateDistance(currentLoc.lat, currentLoc.lng, latitude, longitude);
          if (!currentLoc.address || distMoved > 0.2) {
            try {
              const response = await fetch(`/api/geo/reverse?lat=${latitude}&lon=${longitude}&zoom=18`);
              if (!response.ok) {
                console.warn(`Reverse geocoding failed with status ${response.status}`);
                setLocation((prev: any) => ({ ...prev, lat: latitude, lng: longitude }));
                return;
              }
              const data = await response.json();
              if (data && data.display_name) {
                const newLoc = {
                  address: data.display_name,
                  lat: latitude,
                  lng: longitude
                };
                setLocation(newLoc);
                localStorage.setItem('omniserve_user_location', JSON.stringify(newLoc));
              }
            } catch (err) {
              console.error('Reverse geocoding failed:', err);
              setLocation((prev: any) => ({ ...prev, lat: latitude, lng: longitude }));
            }
          } else if (distMoved > 0.05) {
            // Update coords for minor moves too, just don't re-geocode address
            setLocation((prev: any) => ({ ...prev, lat: latitude, lng: longitude }));
          }
        },
        (err) => {
          if (err.code !== 1) console.log('Location access denied or unavailable:', err);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const services = [
    { id: 'chakula', label: t('food') || 'Chakula', icon: Utensils, color: 'bg-red-500', sub: 'Food Delivery 🍔', category: 'restaurant' },
    { id: 'sokoni', label: t('grocery') || 'Sokoni', icon: ShoppingCart, color: 'bg-green-500', sub: 'Grocery 🛒', category: 'grocery' },
    { id: 'bus_ticket', label: 'Bus Tickets', icon: Bus, color: 'bg-orange-600', sub: 'Bus Booking 🚌', category: 'bus_ticket' },
    { id: 'teksi', label: t('taxi') || 'Teksi', icon: Car, color: 'bg-yellow-500', sub: 'Taxi 🚕', category: 'taxi' },
    { id: 'vifurushi', label: t('parcel') || 'Vifurushi', icon: Package, color: 'bg-orange-500', sub: 'Parcel 📦', category: 'parcel' },
    { id: 'dawa', label: t('pharmacy') || 'Duka la Dawa', icon: Pill, color: 'bg-blue-500', sub: 'Pharmacy 💊', category: 'pharmacy' },
    { id: 'maduka', label: t('ecommerce') || 'Maduka', icon: ShoppingBag, color: 'bg-purple-500', sub: 'eCommerce 🛍️', category: 'ecommerce' },
    { id: 'saluni', label: t('salons') || 'Saluni', icon: Scissors, color: 'bg-pink-500', sub: 'Salons 💇‍♀️', category: 'salon' },
    { id: 'ramani', label: 'Ramani', icon: MapPin, color: 'bg-neutral-600', sub: 'Nearby Stores 📍', category: 'all' },
    { id: 'hoteli', label: t('hotels') || 'Hoteli', icon: Hotel, color: 'bg-indigo-500', sub: 'Hotels 🏨', category: 'hotel' },
  ];

  useEffect(() => {
    const savedSession = localStorage.getItem('papo_hapo_table_session');
    if (savedSession) {
      setTableSession(JSON.parse(savedSession));
    }

    // Fetch Products & Banners
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const productsRef = collection(db, 'products');
        const pQuery = limit(10);
        const pSnap = await getDocs(query(productsRef, pQuery));
        setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

        const bannersRef = collection(db, 'banners');
        const bSnap = await getDocs(query(bannersRef, where('active', '==', true)));
        const fetchedBanners = bSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // If no banners from DB, use default dynamic ones
        if (fetchedBanners.length === 0) {
          setBanners([
            { id: '1', title: 'Food Delivery', sub: 'Agiza chakula sasa upate ofa!', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop' },
            { id: '2', title: 'Grocery', sub: 'Bidhaa safi kutoka shambani', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2026&auto=format&fit=crop' },
            { id: '3', title: 'Pharmacy', sub: 'Dawa na vifaa vya tiba', img: 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?q=80&w=2069&auto=format&fit=crop' }
          ]);
        } else {
          setBanners(fetchedBanners);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Setup Realtime subscriptions
    const vendorsPath = 'vendors';
    const vendorsUnsub = onSnapshot(
      query(collection(db, vendorsPath), where('status', '==', 'active')), 
      (snapshot) => {
        const vendorsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile));
        setVendors(vendorsList);
      },
      (error) => handleFirestoreError(error, OperationType.GET, vendorsPath)
    );

    const productsPath = 'products';
    const productsUnsub = onSnapshot(
      query(collection(db, productsPath), limit(10)), 
      (snapshot) => {
        const productsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsList);
      },
      (error) => handleFirestoreError(error, OperationType.GET, productsPath)
    );

    let notificationUnsub: (() => void) | undefined;
    if (user) {
      const notificationsPath = 'notifications';
      const notificationsRef = collection(db, notificationsPath);
      const q = query(
        notificationsRef, 
        where('userId', '==', user.uid), 
        where('isRead', '==', false)
      );
      
      notificationUnsub = onSnapshot(
        q, 
        (snapshot) => {
          setUnreadCount(snapshot.size);
        },
        (error) => handleFirestoreError(error, OperationType.GET, notificationsPath)
      );
    }

    return () => {
      vendorsUnsub();
      productsUnsub();
      if (notificationUnsub) notificationUnsub();
    };
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = profile?.displayName?.split(' ')[0] || 'Mteja';
    if (hour < 12) return `HABARI ZA ASUBUHI, ${name.toUpperCase()} ☀️`;
    if (hour < 16) return `HABARI ZA MCHANA, ${name.toUpperCase()} ☀️`;
    if (hour < 20) return `HABARI ZA JIONI, ${name.toUpperCase()} 🌅`;
    return `HABARI ZA USIKU, ${name.toUpperCase()} 🌙`;
  };

  return (
    <div className={`pb-10 space-y-4 md:space-y-6 lg:space-y-8 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="px-1 pt-2">
         <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-600/30 flex items-center justify-center overflow-hidden shrink-0">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-orange-600 font-black text-lg">{profile?.displayName?.charAt(0) || 'U'}</div>
                  )}
               </div>
               <div>
                  <h2 className="text-lg font-black italic uppercase leading-none tracking-tighter text-neutral-900 dark:text-white transition-colors">
                     {getGreeting()}
                  </h2>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Karibu Papo Hapo App</p>
               </div>
            </div>
            <Link to="/notifications" className="relative p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-neutral-600 dark:text-neutral-400 hover:text-orange-600 transition-all">
               <Bell className="w-5 h-5" />
               {unreadCount > 0 && (
                 <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-600 border-2 border-white dark:border-neutral-900 rounded-full" />
               )}
            </Link>
         </div>
      </div>

      <LocationPicker 
        isOpen={isLocationPickerOpen}
        onClose={() => {
          setIsLocationPickerOpen(false);
          setIsMapViewOnly(false);
          setSelectedVendorId(undefined);
        }}
        onSelect={handleLocationSelect}
        initialLocation={location}
        vendors={vendors}
        preSelectedVendorId={selectedVendorId}
        isMapViewOnly={isMapViewOnly}
      />

      {tableSession && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-neutral-900 rounded-[2rem] text-white flex items-center justify-between shadow-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
            <ShoppingBag className="w-20 h-20" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Active In-Store Session</p>
              <h4 className="text-lg font-black uppercase italic tracking-tighter mt-0.5">{tableSession.businessName} - Section {tableSession.tableId}</h4>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('papo_hapo_table_session');
              setTableSession(null);
            }}
            className="relative z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </motion.div>
      )}

      {/* 1. Promotional Carousel (Banners) */}
      <div 
        ref={bannerScrollRef}
        className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x py-4 px-2"
      >
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Skeleton key={`banner-skele-${i}`} className="min-w-[85%] md:min-w-[40%] lg:min-w-[30%] h-56 md:h-80 rounded-[3rem]" />
          ))
        ) : (
          banners.map((banner, idx) => banner.img && (
            <motion.div 
              key={`promo-banner-${banner.id || idx}`} 
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.1 * idx, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
              className="min-w-[85%] md:min-w-[40%] lg:min-w-[30%] xl:min-w-[20%] [@media(min-width:1800px)]:min-w-[15%] h-56 md:h-80 rounded-[3rem] overflow-hidden relative snap-center shadow-2xl shadow-neutral-900/10 group cursor-pointer border border-white/20"
            >
              <img 
                src={banner.img} 
                alt={banner.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-8 md:p-10 text-white">
                <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                   <Sparkles className="w-3 h-3 text-orange-400" />
                   <span className="text-[8px] font-black uppercase tracking-widest">Special Deal</span>
                </div>
                <motion.h3 
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  className="text-2xl md:text-3xl font-black tracking-tight font-display mb-1"
                >
                  {banner.title}
                </motion.h3>
                <p className="text-sm opacity-80 font-medium leading-relaxed max-w-[200px]">{banner.sub}</p>
                <motion.div 
                  whileHover={{ x: 5 }}
                  className="mt-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-orange-500"
                >
                  <span>{t('order_now') || 'Order Now'}</span>
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </div>
            </motion.div>
          )))
        }
      </div>

      <section className="mt-8 md:mt-12">
        <div className="flex items-center justify-between mb-4 md:mb-8 px-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg md:text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">
               {t('nearby_stores') || 'Nearby Stores'} 
               <span className="text-orange-600 ml-2">📍</span>
            </h3>
            <div className="h-1 w-10 md:w-16 bg-orange-600 rounded-full" />
          </div>
        </div>
        
        {/* Category Filters for Nearby Stores */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar px-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              selectedCategory === null ? 'bg-orange-600 text-white shadow-lg' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            Yote (All)
          </button>
          {services.filter(s => s.id !== 'ramani').map((s) => (
            <button
              key={`filter-${s.category}`}
              onClick={() => setSelectedCategory(s.category === selectedCategory ? null : s.category)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === s.category ? 'bg-orange-600 text-white shadow-lg' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>

        <div 
          ref={storeScrollRef}
          className="flex flex-nowrap overflow-x-auto gap-4 sm:gap-6 md:gap-8 pb-4 no-scrollbar -mx-4 px-4 snap-x snap-mandatory"
        >
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={`store-skele-${i}`} className="min-w-[48%] sm:min-w-[280px] md:min-w-[320px] lg:min-w-[350px] flex-shrink-0 space-y-4">
                <Skeleton className="h-40 sm:h-48 rounded-[2.5rem]" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded-lg" />
                </div>
              </div>
            ))
          ) : (
            vendors
              .filter(v => v.status === 'active' && (!selectedCategory || v.category === selectedCategory))
              .map(vendor => {
                const distance = vendor.location 
                  ? calculateDistance(location.lat, location.lng, vendor.location.lat, vendor.location.lng)
                  : 9999;
                return { ...vendor, distance };
              })
              .sort((a, b) => a.distance - b.distance)
              .map((vendor, idx) => (
                <motion.div
                  key={`nearby-vendor-${vendor.id || `vendor-${idx}`}`}
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * idx, type: "spring", stiffness: 100 }}
                  whileHover={{ y: -10 }}
                  whileTap={{ scale: 0.98 }}
                  className="min-w-[48%] sm:min-w-[280px] md:min-w-[320px] lg:min-w-[350px] flex-shrink-0 group cursor-pointer snap-start"
                  onClick={() => navigate(`/vendor/${vendor.id}`)}
                >
                <div className="relative h-full bg-white dark:bg-neutral-900 rounded-[1.5rem] sm:rounded-[2.5rem] border border-neutral-200/60 dark:border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.06)] group-hover:shadow-[0_40px_80px_rgba(234,88,12,0.15)] transition-all duration-500 overflow-hidden group/card border-b-2 sm:border-b-4 border-b-neutral-100 active:scale-[0.98]">
                <div className="h-20 sm:h-40 md:h-48 relative overflow-hidden">
                  <img 
                    src={vendor.bannerUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80'} 
                    alt={vendor.businessName} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  
                  {/* Category Badge */}
                  <div className="absolute top-2 sm:top-5 right-2 sm:right-5">
                     <Badge className="bg-orange-600 text-white font-black px-2 sm:px-4 py-0.5 sm:py-1.5 rounded-full text-[7px] sm:text-[9px] uppercase border-none shadow-xl shadow-orange-600/30 tracking-widest">
                        {vendor.category}
                     </Badge>
                  </div>
                </div>

                {/* Logo Overlap - Moved out of overflow-hidden div with better positioning */}
                <div className="absolute top-[4rem] sm:top-[7.5rem] left-3 sm:left-6 z-20">
                  <div className="w-10 h-10 sm:w-20 md:w-20 rounded-xl sm:rounded-3xl bg-white dark:bg-neutral-800 p-1 sm:p-1.5 shadow-[0_15px_35px_rgba(0,0,0,0.2)] border-2 border-white dark:border-neutral-800">
                    <img 
                      key={vendor.logoUrl || `dicebear-${vendor.businessName}`}
                      src={vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`} 
                      alt="Logo" 
                      className="w-full h-full object-contain rounded-lg sm:rounded-2xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`;
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="pt-6 sm:pt-14 p-3 sm:p-8 space-y-2 sm:space-y-4">
                  <div>
                    <h4 className="font-black text-xs sm:text-2xl text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase italic tracking-tighter leading-none truncate mb-1 sm:mb-2">{vendor.businessName}</h4>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                      <div className="flex items-center gap-0.5 sm:gap-1.5 bg-orange-50 dark:bg-orange-950/30 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                        <Star className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-orange-600 fill-current" />
                        <span className="text-[9px] sm:text-[11px] font-black text-orange-600">
                          {Number(vendor.ratingCount || 0) > 0 ? Number(vendor.rating || 0).toFixed(1) : '0.0'}
                        </span>
                        <span className="text-[7px] sm:text-[9px] text-orange-400 font-bold ml-0.5">({Number(vendor.ratingCount || 0)})</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (vendor.location) {
                            const originStr = location ? `&origin=${location.lat},${location.lng}` : '';
                            window.open(`https://www.google.com/maps/dir/?api=1${originStr}&destination=${vendor.location.lat},${vendor.location.lng}`, '_blank');
                          }
                        }}
                        className="flex items-center gap-0.5 sm:gap-1.5 bg-green-50 dark:bg-green-950/30 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        title="Get directions"
                      >
                        <MapPin className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-green-600" />
                        <span className="text-[9px] sm:text-[11px] font-black text-green-600 uppercase tracking-tighter">
                          {!vendor.location ? 'N/A' : vendor.distance < 0.5 
                            ? `${(vendor.distance * 1000).toFixed(0)}m` 
                            : `${vendor.distance.toFixed(1)}km`}
                        </span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-1.5 sm:pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[8px] sm:text-[10px] text-neutral-400 font-bold uppercase tracking-widest hidden min-[400px]:block">{t('open_now') || 'Open Now'}</p>
                    <div className="flex items-center gap-1 sm:gap-2 text-orange-600 group-hover:translate-x-2 transition-transform ml-auto">
                      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">{t('visit') || 'Visit'}</span>
                      <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )))}
          {vendors.filter(v => v.status === 'active').length === 0 && (
            <div className="w-full py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-[2.5rem] border border-dashed border-neutral-200 dark:border-neutral-800 mx-4">
              <p className="text-neutral-400 text-sm italic">Hakuna maduka yaliyopatikana karibu nawe.</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-2 mt-8 md:mt-16">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">
               {t('explore_services') || 'Explore Services'}
            </h3>
            <div className="h-1 w-10 md:w-16 bg-orange-600 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 [@media(min-width:1800px)]:grid-cols-16 gap-3 md:gap-8 lg:gap-10">
          {services.map((service, idx) => (
            <motion.div
              key={service.id || idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * idx, type: "spring", bounce: 0.4 }}
            >
              {service.id === 'ramani' ? (
                <button 
                  onClick={() => {
                    setIsMapViewOnly(true);
                    setIsLocationPickerOpen(true);
                  }}
                  className="flex flex-col items-center text-center group w-full gap-3"
                >
                  <motion.div 
                    whileHover={{ y: -10, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-16 h-16 md:w-22 md:h-22 rounded-[1.75rem] flex items-center justify-center text-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] group-hover:shadow-orange-600/30 transition-all duration-500 overflow-hidden relative ${service.color}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                    <service.icon className="w-7 h-7 md:w-9 md:h-9 relative z-10" />
                  </motion.div>
                  <span className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-neutral-600 leading-tight block w-full truncate">{service.label}</span>
                </button>
              ) : (
                <Link 
                  to={service.id === 'teksi' ? '/taxi' : service.id === 'vifurushi' ? '/service/vifurushi' : `/service/${service.id}`}
                  className="flex flex-col items-center text-center group gap-3"
                >
                  <motion.div 
                    whileHover={{ y: -10, rotate: -5 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-16 h-16 md:w-22 md:h-22 rounded-[1.75rem] flex items-center justify-center text-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] group-hover:shadow-orange-600/30 transition-all duration-500 overflow-hidden relative ${service.color}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                    <service.icon className="w-7 h-7 md:w-9 md:h-9 relative z-10" />
                  </motion.div>
                  <span className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-neutral-600 leading-tight block w-full truncate">{service.label}</span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Bidhaa Maarufu (Popular Products) */}
      <section className="px-2 mt-8 md:mt-12">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">{t('popular_products') || 'Bidhaa Maarufu'}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 [@media(min-width:1800px)]:grid-cols-10 gap-3 md:gap-8 lg:gap-10">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={`prod-skele-${i}`} className="space-y-4">
                <Skeleton className="h-44 rounded-[2.5rem]" />
                <Skeleton className="h-4 w-3/4 rounded-lg" />
              </div>
            ))
          ) : (
            filteredProducts.map((product, idx) => {
              const isBusTicket = product.vendorCategory === 'bus_ticket' || 
                                  product.category === 'bus_ticket' || 
                                  product.name.toLowerCase().includes('bus ticket') ||
                                  product.name.toLowerCase().includes('mwanza tu');
              return (
                <motion.div
                  key={`product-${product.id || `product-${idx}`}`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * idx }}
                  whileHover={{ y: -5 }}
                >
                  <Link 
                    to={isBusTicket ? '/service/bus_ticket' : `/product/${product.id}`}
                    className="block group h-full"
                  >
                    <Card className="overflow-hidden rounded-[2.5rem] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all h-full group/card border-2 hover:border-orange-500/10 active:scale-95 flex flex-col justify-between">
                      {isBusTicket ? (
                        <div className="flex flex-col h-full bg-neutral-950 text-white relative">
                          {/* Inner custom ticket background & border */}
                          <div className="h-44 bg-gradient-to-br from-indigo-800 via-blue-900 to-slate-950 p-4 flex flex-col justify-between relative overflow-hidden">
                            {/* Barcode line on top */}
                            <div className="flex justify-between items-center opacity-70">
                              <span className="text-[9px] font-mono tracking-widest text-indigo-200 font-bold">#TK-{idx}N42</span>
                              <span className="text-[10px] font-mono tracking-tighter text-indigo-300">||||| | ||| ||</span>
                            </div>

                            {/* Center Route Graphics */}
                            <div className="my-auto flex flex-col items-center">
                              <div className="flex items-center gap-2 justify-center w-full">
                                <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white">DAR</span>
                                <div className="flex-1 border-t-2 border-dashed border-indigo-400/40 relative flex justify-center items-center">
                                  <Bus className="w-5 h-5 text-emerald-400 absolute bg-indigo-900 rounded-full p-1 border border-indigo-700" />
                                </div>
                                <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white">MWZ</span>
                              </div>
                              <span className="text-[8px] uppercase tracking-widest text-indigo-200 font-extrabold mt-2">Safiri Salama • Tanzania</span>
                            </div>

                            {/* Floating Bus Service label */}
                            <span className="absolute top-4 right-4 bg-emerald-500 font-black text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider text-neutral-900 shadow-sm animate-pulse">
                              Active
                            </span>

                            {/* Half-circles on left and right borders of the ticket perforated line */}
                            <div className="absolute left-[-8px] bottom-[-8px] w-4 h-4 rounded-full bg-white dark:bg-neutral-900 z-20 shadow-inner" />
                            <div className="absolute right-[-8px] bottom-[-8px] w-4 h-4 rounded-full bg-white dark:bg-neutral-900 z-20 shadow-inner" />
                          </div>

                          {/* Perforated dashed line at the bottom of the image area */}
                          <div className="relative flex justify-center items-center">
                            <div className="w-full border-t-2 border-dashed border-neutral-100 dark:border-neutral-800 z-10" />
                          </div>

                          <CardContent className="p-5 bg-white dark:bg-neutral-900 flex-1 flex flex-col justify-between min-h-[140px]">
                            <div>
                              <h4 className="font-black text-sm text-neutral-900 dark:text-white truncate group-hover/card:text-blue-500 transition-colors uppercase tracking-tight">{product.name}</h4>
                              <p className="text-[10px] font-black tracking-wider text-blue-500 mt-0.5 uppercase">TIKETI YA BASI / BUS TICKET</p>
                            </div>
                            <div className="flex items-end justify-between mt-4">
                              <div>
                                <p className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider">Nauli/Fare</p>
                                <p className="text-xs md:text-sm text-orange-600 font-black">
                                  TZS {product.price.toLocaleString()}
                                </p>
                              </div>
                              
                              <div className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] rounded-xl flex items-center gap-1 text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                                <span className="uppercase tracking-wider">Kata</span>
                                <ChevronRight className="w-3 h-3" />
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      ) : (
                        <>
                          <div className="h-44 relative overflow-hidden">
                            <img 
                              src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                              referrerPolicy="no-referrer"
                            />
                            {/* AR Badge */}
                            {product?.model3dUrl && businessConfig?.enableAR && (
                              <div className="absolute top-4 left-4 z-10 animate-pulse">
                                <div className="bg-orange-600 text-white p-1.5 rounded-full shadow-lg border border-orange-400/40">
                                  <Box className="w-3 h-3" />
                                </div>
                              </div>
                            )}
                            <motion.button 
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addItem(product);
                                toast.success(`${product.name} imeongezwa!`);
                              }}
                              className="absolute bottom-4 right-4 w-12 h-12 bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all transform overflow-hidden group/btn"
                            >
                              <div className="absolute inset-0 bg-orange-600 -translate-x-full group-hover/btn:translate-x-0 transition-transform" />
                              <Plus className="w-6 h-6 relative z-10" />
                            </motion.button>
                          </div>
                          <CardContent className="p-5">
                            <h4 className="font-black text-sm text-neutral-900 dark:text-white truncate group-hover/card:text-orange-600 transition-colors uppercase tracking-tight">{product.name}</h4>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-orange-600 font-black">
                                TZS {product.price.toLocaleString()}
                              </p>
                              <span className="text-[10px] text-neutral-400 font-bold">Qty: 1</span>
                            </div>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  </Link>
                </motion.div>
              );
            })
          )}
          {products.length === 0 && (
            <div className="min-w-full py-8 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 col-span-full">
              <p className="text-neutral-400 text-xs italic">{t('no_products_found') || 'Hakuna bidhaa maarufu kwa sasa.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Huduma Maarufu (Popular Services) - Improved Modern Polish */}
      <section className="px-2 mt-8 md:mt-16">
        <div className="flex items-center justify-between mb-8 md:mb-12">
          <div className="space-y-1">
            <h3 className="text-xl md:text-3xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">{t('popular_services') || 'Huduma Maarufu'}</h3>
            <div className="h-1 w-12 md:w-20 bg-orange-600 rounded-full" />
          </div>
          <button className="text-orange-600 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] hover:translate-x-2 transition-transform flex items-center gap-2 group">
            {t('view_all') || 'View All'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div 
          className="flex sm:grid overflow-x-auto sm:overflow-visible gap-4 sm:gap-8 pb-4 sm:pb-0 no-scrollbar -mx-4 px-4 snap-x snap-mandatory sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        >
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={`pop-skele-${i}`} className="min-w-[85%] sm:min-w-0 h-40 rounded-[2.5rem]" />
            ))
          ) : (
            filteredVendors
              .map(vendor => {
                const distance = vendor.location 
                  ? calculateDistance(location.lat, location.lng, vendor.location.lat, vendor.location.lng)
                  : 9999;
                return { ...vendor, distance };
              })
              .sort((a, b) => a.distance - b.distance)
              .map((vendor, idx) => (
              <motion.div
                key={`popular-restaurant-${vendor.id || `vendor-pop-${idx}`}`}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * idx, duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-[85%] sm:min-w-0 snap-start"
              >
              <Link to={`/vendor/${vendor.id}`}>
                <Card className="overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_40px_80px_rgba(0,0,0,0.08)] hover:shadow-orange-600/20 transition-all duration-700 group border-2 hover:border-orange-500/10 h-full">
                  <div className="flex p-4 sm:p-8 gap-4 sm:gap-8 items-center h-full">
                    <div className="w-20 h-20 sm:w-40 sm:h-40 rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden relative shrink-0 shadow-xl border-2 sm:border-4 border-white dark:border-neutral-800">
                      <img 
                        key={vendor.logoUrl || `dicebear-${vendor.businessName}`}
                        src={vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`} 
                        alt={vendor.businessName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`;
                        }}
                      />
                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-2 md:px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xl">
                        <Star className="w-3 h-3 text-orange-500 fill-current" />
                        <span className="text-[10px] md:text-sm font-black">{(vendor.rating || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0 space-y-3">
                       <Badge className="w-fit bg-orange-50 dark:bg-orange-950/30 text-orange-600 border-none text-[8px] sm:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        {vendor.category}
                      </Badge>
                      <h4 className="font-black text-lg sm:text-3xl text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase italic tracking-tighter leading-none truncate">
                        {vendor.businessName}
                      </h4>
                      <p className="text-[10px] sm:text-sm text-neutral-400 font-medium italic truncate">
                         {vendor.address || 'Eneo Halikujulikana'}
                      </p>
                      <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-2 text-orange-600">
                           <MapPin className="w-4 h-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">
                             {!vendor.location ? 'N/A' : vendor.distance < 0.5 ? t('very_close') : vendor.distance.toFixed(1) + 'km'}
                           </span>
                        </div>
                        <motion.div 
                          className="h-10 w-10 sm:h-12 sm:w-12 bg-neutral-900 group-hover:bg-orange-600 rounded-2xl flex items-center justify-center text-white transition-colors duration-500 ml-auto"
                        >
                           <ChevronRight className="w-5 h-5" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          )))}
        </div>
      </section>
      <section className="pt-12">
        <HowToOrder />
      </section>
    </div>
  );
}
