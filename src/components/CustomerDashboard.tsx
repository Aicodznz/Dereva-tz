import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, Star, 
  Search, Bell, MapPin, ChevronRight, ShoppingBag, Tag, Plus, ShoppingBasket
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import LocationPicker from './LocationPicker';

import { useLanguage } from '../LanguageContext';
import { useCart } from '../CartContext';
import HowToOrder from './HowToOrder';

export default function CustomerDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const { addItem } = useCart();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<{id: string, title: string, sub: string, img: string}[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [tableSession, setTableSession] = useState<any>(null);
  const [location, setLocation] = useState({
    address: 'Mbezi Beach, DSM',
    lat: -6.7924,
    lng: 39.2083
  });

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
        (err) => console.log('Location access denied or unavailable:', err),
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

    const qVendors = query(collection(db, 'vendors'), where('status', '==', 'active'));
    const unsubVendors = onSnapshot(qVendors, (snapshot) => {
      const vendorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile));
      setVendors(vendorData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });

    const qProducts = query(collection(db, 'products'), limit(10));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const qBanners = query(collection(db, 'banners'), where('active', '==', true));
    const unsubBanners = onSnapshot(qBanners, (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'banners');
    });

    if (user) {
      const qNotifs = query(collection(db, 'notifications'), where('userId', '==', user.uid), where('isRead', '==', false));
      const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
        setUnreadCount(snapshot.size);
      });
      return () => {
        unsubVendors();
        unsubProducts();
        unsubBanners();
        unsubNotifs();
      };
    }

    return () => {
      unsubVendors();
      unsubProducts();
      unsubBanners();
    };
  }, [user]);

  return (
    <div className="pb-24 space-y-8">
      {/* 1. Top Section */}
      <div className="flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-100">
            <img 
              src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
              alt="Avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <p className="text-sm text-neutral-500">{t('welcome') || 'Karibu'},</p>
            <h2 className="font-bold text-lg text-neutral-900">{profile?.displayName?.split(' ')[0] || 'Mteja'}!</h2>
          </div>
        </Link>
        <Link to="/notifications" className="relative p-2 bg-white rounded-xl shadow-sm border border-neutral-100 hover:bg-neutral-50 transition-colors">
          <Bell className="w-6 h-6 text-neutral-600" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </Link>
      </div>

      <button 
        onClick={() => setIsLocationPickerOpen(true)}
        className="flex items-center gap-2 text-sm text-neutral-600 hover:text-orange-600 transition-colors"
      >
        <MapPin className="w-4 h-4 text-orange-600" />
        <span>Location: <span className="font-bold">{location.address}</span></span>
      </button>

      <LocationPicker 
        isOpen={isLocationPickerOpen}
        onClose={() => {
          setIsLocationPickerOpen(false);
          setSelectedVendorId(undefined);
        }}
        onSelect={(newLoc) => setLocation(newLoc)}
        initialLocation={location}
        vendors={vendors}
        preSelectedVendorId={selectedVendorId}
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

      {/* 2. Search Bar - Enhanced */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative group"
      >
        <motion.div
           animate={{
             x: [0, -1, 1, -1, 1, 0],
           }}
           transition={{
             duration: 5,
             repeat: Infinity,
             repeatDelay: 2
           }}
           className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <Search className="w-5 h-5 text-neutral-400 group-focus-within:text-orange-600 transition-colors" />
        </motion.div>
        <input 
          type="text"
          placeholder={t('search_placeholder') || "Tafuta huduma, mgahawa, au bidhaa..."}
          className="w-full h-15 pl-14 pr-6 bg-white border-2 border-neutral-50 rounded-3xl text-base font-medium placeholder:text-neutral-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-xl shadow-orange-900/5 focus:shadow-orange-900/10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </motion.div>

      {/* 3. Promotional Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x py-2">
        {banners.map((banner, idx) => banner.img && (
          <motion.div 
            key={banner.id} 
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.1 * idx }}
            whileHover={{ y: -5 }}
            className="min-w-[85%] md:min-w-[45%] lg:min-w-[35%] h-52 md:h-64 rounded-[2.5rem] overflow-hidden relative snap-center shadow-2xl shadow-orange-900/10 group cursor-pointer"
          >
            <img src={banner.img} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
              <motion.h3 
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                className="text-2xl font-black tracking-tight"
              >
                {banner.title}
              </motion.h3>
              <p className="text-sm opacity-80 mt-1 font-medium">{banner.sub}</p>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className="mt-5 bg-orange-600 text-white text-[10px] font-black px-6 py-2.5 rounded-full w-fit uppercase tracking-widest shadow-lg shadow-orange-600/40 hover:bg-white hover:text-orange-600 transition-all"
              >
                {t('order_now') || 'Order Now'}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 5. Duka za Karibu (Nearby Stores) - New Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h3 className="font-black text-xl text-neutral-900 tracking-tight">{t('nearby_stores') || 'Duka za Karibu'}</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Essential items just far away</p>
          </div>
          <button 
            onClick={() => setIsLocationPickerOpen(true)}
            className="text-orange-600 text-sm font-black flex items-center gap-1 hover:gap-2 transition-all"
          >
            {t('see_all') || 'Zote'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4">
          {vendors.filter(v => v.category === 'ecommerce' || v.category === 'grocery').map((vendor, idx) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="min-w-[280px] group cursor-pointer"
              onClick={() => {
                setSelectedVendorId(vendor.id);
                setIsLocationPickerOpen(true);
              }}
            >
              <Card className="overflow-hidden rounded-[2.5rem] border-neutral-50 shadow-xl shadow-neutral-900/5 group-hover:shadow-orange-900/10 transition-all border-2 group-hover:border-orange-500/10">
                <div className="h-40 relative">
                  <img 
                    src={vendor.bannerUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80'} 
                    alt={vendor.businessName} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-2xl border border-neutral-100">
                      <img 
                        src={vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor.businessName}`} 
                        alt="Logo" 
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <h4 className="font-black text-lg text-neutral-900 group-hover:text-orange-600 transition-colors uppercase tracking-tight truncate">{vendor.businessName}</h4>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1 text-orange-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-[11px] font-black">{vendor.rating || '4.8'}</span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-neutral-300" />
                    <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-tighter">1.2 km mbali</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {vendors.filter(v => v.category === 'ecommerce' || v.category === 'grocery').length === 0 && (
            <div className="w-full py-12 text-center bg-neutral-50 rounded-[2.5rem] border border-dashed border-neutral-200 mx-4">
              <p className="text-neutral-400 text-sm italic">Hakuna maduka yaliyopatikana karibu nawe.</p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Main Services Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-neutral-900 tracking-tight">{t('other_services') || 'Huduma Nyingine'}</h3>
          <button className="text-orange-600 text-sm font-black flex items-center gap-1 hover:gap-2 transition-all">
            {t('see_all') || 'See All'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-5">
          {services.map((service, idx) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
            >
              {service.id === 'ramani' ? (
                <button 
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="flex flex-col items-center text-center group w-full"
                >
                  <motion.div 
                    whileHover={{ y: -8, scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center mb-3 text-white shadow-xl shadow-neutral-900/5 group-hover:shadow-orange-600/20 transition-all ${service.color}`}
                  >
                    <service.icon className="w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:rotate-12" />
                  </motion.div>
                  <span className="font-black text-[10px] uppercase tracking-tighter text-neutral-800 truncate w-full px-1">{service.label}</span>
                </button>
              ) : (
                <Link 
                  to={`/service/${service.id}`}
                  className="flex flex-col items-center text-center group"
                >
                  <motion.div 
                    whileHover={{ y: -8, scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center mb-3 text-white shadow-xl shadow-neutral-900/5 group-hover:shadow-orange-600/20 transition-all ${service.color}`}
                  >
                    <service.icon className="w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:rotate-12" />
                  </motion.div>
                  <span className="font-black text-[10px] uppercase tracking-tighter text-neutral-800 truncate w-full px-1">{service.label}</span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Migahawa Maarufu (Restaurants) - Vertical List for prominence */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-neutral-900 tracking-tight">{t('popular_restaurants') || 'Migahawa Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-black">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor, idx) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
            >
              <Link to={`/vendor/${vendor.id}`}>
                <Card className="overflow-hidden rounded-[2.5rem] border-neutral-50 shadow-xl shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all group border-2 hover:border-orange-500/20">
                  <div className="flex p-5 gap-5">
                    <div className="w-32 h-32 rounded-3xl overflow-hidden relative shrink-0 shadow-inner">
                      <img 
                        src={vendor.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
                        alt={vendor.businessName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 text-orange-500 fill-current" />
                        <span className="text-[10px] font-black">{vendor.rating || '4.5'}</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-black text-lg text-neutral-900 group-hover:text-orange-600 transition-colors leading-tight">{vendor.businessName}</h4>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 font-medium">{vendor.description || 'Bidhaa Bora na Huduma Haraka'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] bg-orange-50 text-orange-600 border-none px-2.5 py-1 font-black uppercase tracking-tighter">
                            {vendor.category}
                          </Badge>
                          <span className="text-[10px] text-neutral-400 font-bold">1.2 km</span>
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
            <div className="py-12 text-center bg-neutral-50 rounded-3xl border border-dashed border-neutral-200 col-span-full">
              <p className="text-neutral-400 text-sm italic">{t('no_restaurants_found') || 'Hakuna migahawa iliyopatikana karibu nawe.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* 6. Bidhaa Maarufu (Popular Products) - Horizontal scroll below */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xl text-neutral-900 tracking-tight">{t('popular_products') || 'Bidhaa Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-black">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {products.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * idx }}
            >
              <Link 
                to={`/product/${product.id}`}
                className="block group"
              >
                <Card className="overflow-hidden rounded-[2.5rem] border-neutral-50 shadow-xl shadow-neutral-900/5 hover:shadow-orange-900/10 transition-all h-full group/card border-2 hover:border-orange-500/10">
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
                      className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-2xl shadow-2xl flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all transform overflow-hidden group/btn"
                    >
                      <div className="absolute inset-0 bg-orange-600 -translate-x-full group-hover/btn:translate-x-0 transition-transform" />
                      <ShoppingBasket className="w-6 h-6 relative z-10" />
                    </motion.button>
                  </div>
                  <CardContent className="p-5">
                    <h4 className="font-black text-sm text-neutral-900 truncate group-hover/card:text-orange-600 transition-colors uppercase tracking-tight">{product.name}</h4>
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
            <div className="min-w-full py-8 text-center bg-neutral-50 rounded-3xl border border-dashed border-neutral-200 col-span-full">
              <p className="text-neutral-400 text-xs italic">{t('no_products_found') || 'Hakuna bidhaa maarufu kwa sasa.'}</p>
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
