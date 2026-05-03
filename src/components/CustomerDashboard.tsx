import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, Star, 
  Search, Bell, MapPin, ChevronRight, ShoppingBag, Tag, Plus, ShoppingBasket,
  FileText, Smartphone, Box, Dog
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
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

  // Use search from context
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

  // Automatic Location Prompt
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data && data.display_name) {
              setLocation({
                address: data.display_name,
                lat: latitude,
                lng: longitude
              });
            } else {
              setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));
            }
          } catch (err) {
            console.error('Auto reverse geocoding failed:', err);
            setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));
          }
        },
        (err) => {
          if (err.code !== 1) console.log('Location access denied or unavailable:', err);
        },
        { timeout: 10000 }
      );
    }
  }, []);

  const services = [
    { id: 'chakula', label: t('food') || 'Chakula', icon: Utensils, color: 'bg-red-500', sub: 'Food Delivery 🍔' },
    { id: 'sokoni', label: t('grocery') || 'Sokoni', icon: ShoppingCart, color: 'bg-green-500', sub: 'Grocery 🛒' },
    { id: 'teksi', label: t('taxi') || 'Teksi', icon: Car, color: 'bg-yellow-500', sub: 'Taxi 🚕' },
    { id: 'vifurushi', label: t('parcel') || 'Vifurushi', icon: Package, color: 'bg-orange-500', sub: 'Parcel 📦' },
    { id: 'dawa', label: t('pharmacy') || 'Duka la Dawa', icon: Pill, color: 'bg-blue-500', sub: 'Pharmacy 💊' },
    { id: 'maduka', label: t('ecommerce') || 'Maduka', icon: ShoppingBag, color: 'bg-purple-500', sub: 'eCommerce 🛍️' },
    { id: 'saluni', label: t('salons') || 'Saluni', icon: Scissors, color: 'bg-pink-500', sub: 'Salons 💇‍♀️' },
    { id: 'ramani', label: 'Ramani', icon: MapPin, color: 'bg-orange-600', sub: 'Nearby Stores 📍' },
    { id: 'hoteli', label: t('hotels') || 'Hoteli', icon: Hotel, color: 'bg-indigo-500', sub: 'Hotels 🏨' },
  ];

  useEffect(() => {
    const savedSession = localStorage.getItem('papo_hapo_table_session');
    if (savedSession) {
      setTableSession(JSON.parse(savedSession));
    }

    // Fetch Vendors
    const fetchVendors = async () => {
      const path = 'vendors';
      try {
        const vendorsRef = collection(db, path);
        const q = query(vendorsRef, where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);
        const vendorsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile));
        setVendors(vendorsList);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    // Fetch Products
    const fetchProducts = async () => {
      const path = 'products';
      try {
        const productsRef = collection(db, path);
        const q = query(productsRef, limit(10));
        const querySnapshot = await getDocs(q);
        const productsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsList);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    // Fetch Banners
    const fetchBanners = async () => {
      const path = 'banners';
      try {
        const bannersRef = collection(db, path);
        const q = query(bannersRef, where('active', '==', true));
        const querySnapshot = await getDocs(q);
        const bannersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setBanners(bannersList);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };

    fetchVendors();
    fetchProducts();
    fetchBanners();

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
  }, [user?.uid]);

  return (
    <div className={`pb-24 space-y-8 md:space-y-16 lg:space-y-24 ${isRTL ? 'text-right' : 'text-left'}`}>
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
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x py-2 px-1">
        {banners.map((banner, idx) => banner.img && (
          <motion.div 
            key={`promo-banner-${banner.id || idx}`} 
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.1 * idx, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -8 }}
            className="min-w-[92%] md:min-w-[45%] lg:min-w-[35%] h-52 md:h-72 rounded-[2.5rem] overflow-hidden relative snap-center shadow-2xl shadow-neutral-900/10 group cursor-pointer border border-white/20"
          >
            <img src={banner.img} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-8 md:p-10 text-white">
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
        ))}
      </div>

      {/* 2. Duka za Karibu (Nearby Stores) */}
      <section>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex flex-col">
            <h3 className="font-black text-2xl text-neutral-900 tracking-tight font-display italic uppercase tracking-tighter">
               {t('nearby_stores') || 'Nearby Stores'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.1em]">Stores available around your location</p>
            </div>
          </div>
          <button 
            onClick={() => setIsLocationPickerOpen(true)}
            className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-900 dark:text-white hover:bg-orange-600 hover:text-white transition-all shadow-sm"
          >
             <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-3 px-3">
          {vendors
            .filter(v => ['food', 'grocery', 'pharmacy', 'ecommerce', 'salons', 'hotels'].includes(v.category))
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
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="min-w-[260px] group cursor-pointer"
              onClick={() => {
                setSelectedVendorId(vendor.id);
                setIsLocationPickerOpen(true);
              }}
            >
              <Card className="overflow-hidden rounded-[2rem] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg shadow-neutral-900/5 group-hover:shadow-orange-900/10 transition-all border-2 group-hover:border-orange-500/10">
                <div className="h-36 relative">
                  <img 
                    src={vendor.bannerUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80'} 
                    alt={vendor.businessName} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 p-1 shadow-2xl border border-neutral-100 dark:border-neutral-700">
                      <img 
                        src={vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor.businessName}`} 
                        alt="Logo" 
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                     <Badge className="bg-white/90 backdrop-blur-sm text-orange-600 font-black px-3 py-1 rounded-xl text-[9px] uppercase border-none shadow-sm">
                        {vendor.category}
                     </Badge>
                  </div>
                </div>
                <CardContent className="p-3 md:p-5">
                  <h4 className="font-black text-base md:text-lg text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase tracking-tight truncate">{vendor.businessName}</h4>
                  <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-3">
                    <div className="flex items-center gap-1 text-orange-500">
                      <Star className="w-3 md:w-3.5 h-3 md:h-3.5 fill-current" />
                      <span className="text-[10px] md:text-[11px] font-black">{vendor.rating || '4.8'}</span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-neutral-300" />
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2.5 md:w-3 h-2.5 md:h-3 text-neutral-400" />
                      <span className="text-[9px] md:text-[11px] text-neutral-400 font-bold uppercase tracking-tighter">
                        {vendor.distance < 0.5 
                          ? `${t('very_close')} (${(vendor.distance * 1000).toFixed(0)}m)` 
                          : vendor.distance < 1.5 
                          ? `${t('close')} (${vendor.distance.toFixed(1)}km)` 
                          : vendor.distance < 4 
                          ? `${t('far_bit')} (${vendor.distance.toFixed(1)}km)` 
                          : vendor.distance < 8 
                          ? `${t('far')} (${vendor.distance.toFixed(1)}km)` 
                          : `${t('extremely_far')} (${vendor.distance.toFixed(1)}km)`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {vendors.filter(v => ['food', 'grocery', 'pharmacy', 'ecommerce', 'salons', 'hotels'].includes(v.category)).length === 0 && (
            <div className="w-full py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-[2.5rem] border border-dashed border-neutral-200 dark:border-neutral-800 mx-4">
              <p className="text-neutral-400 text-sm italic">Hakuna maduka yaliyopatikana karibu nawe.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Main Services Grid (Huduma Nyingine) */}
      <section className="px-2">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-black text-2xl text-neutral-900 tracking-tight font-display italic uppercase tracking-tighter">
             {t('explore_services') || 'Explore Services'}
          </h3>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-4 md:gap-6">
          {services.map((service, idx) => (
            <motion.div
              key={service.id}
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
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-neutral-900 dark:text-white tracking-tight">{t('popular_products') || 'Bidhaa Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-black">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
          {filteredProducts.map((product, idx) => (
            <motion.div
              key={`product-${product.id || `product-${idx}`}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * idx }}
            >
              <Link 
                to={`/product/${product.id}`}
                className="block group"
              >
                <Card className="overflow-hidden rounded-[2.5rem] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all h-full group/card border-2 hover:border-orange-500/10">
                  <div className="h-44 relative overflow-hidden">
                    <img 
                      src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
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
                        className="absolute bottom-4 right-4 w-12 h-12 bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all transform overflow-hidden group/btn"
                      >
                      <div className="absolute inset-0 bg-orange-600 -translate-x-full group-hover/btn:translate-x-0 transition-transform" />
                      <ShoppingBasket className="w-6 h-6 relative z-10" />
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
                </Card>
              </Link>
            </motion.div>
          ))}
          {products.length === 0 && (
            <div className="min-w-full py-8 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 col-span-full">
              <p className="text-neutral-400 text-xs italic">{t('no_products_found') || 'Hakuna bidhaa maarufu kwa sasa.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Huduma Maarufu (Popular Services) - Vertical List for prominence */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-neutral-900 dark:text-white tracking-tight">{t('popular_services') || 'Huduma Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-black">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVendors
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
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
            >
              <Link to={`/vendor/${vendor.id}`}>
                <Card className="overflow-hidden rounded-[2.5rem] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all group border-2 hover:border-orange-500/20">
                  <div className="flex p-5 gap-5">
                    <div className="w-32 h-32 rounded-3xl overflow-hidden relative shrink-0 shadow-inner">
                      <img 
                        src={vendor.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
                        alt={vendor.businessName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 text-orange-500 fill-current" />
                        <span className="text-[10px] font-black">{vendor.rating || '4.5'}</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-black text-lg text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors leading-tight">{vendor.businessName}</h4>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 font-medium">{vendor.description || 'Bidhaa Bora na Huduma Haraka'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] bg-orange-50 text-orange-600 border-none px-2.5 py-1 font-black uppercase tracking-tighter">
                            {vendor.category}
                          </Badge>
                          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">
                            {vendor.distance < 0.5 
                              ? t('very_close') 
                              : vendor.distance < 1.5 
                              ? t('close') 
                              : vendor.distance < 4 
                              ? t('far_bit') 
                              : vendor.distance < 8 
                              ? t('far') 
                              : t('extremely_far')}
                          </span>
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.9 }}
                          className="bg-neutral-900 text-white text-[10px] font-black px-5 py-2 rounded-full hover:bg-orange-600 transition-colors uppercase tracking-widest"
                        >
                          {t('order') || 'Agiza'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
          {vendors.length === 0 && (
            <div className="py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 col-span-full">
              <p className="text-neutral-400 text-sm italic">{t('no_restaurants_found') || 'Hakuna migahawa iliyopatikana karibu nawe.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* 7. How To Order Infographic */}
      <section className="pt-12">
        <HowToOrder />
      </section>
    </div>
  );
}
