import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, Star, 
  Search, Bell, MapPin, ChevronRight, ShoppingBag, Tag, Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import LocationPicker from './LocationPicker';

const services = [
  { id: 'chakula', label: 'Chakula', icon: Utensils, color: 'bg-red-500', sub: 'Food Delivery 🍔' },
  { id: 'sokoni', label: 'Sokoni', icon: ShoppingCart, color: 'bg-green-500', sub: 'Grocery 🛒' },
  { id: 'teksi', label: 'Teksi', icon: Car, color: 'bg-yellow-500', sub: 'Taxi 🚕' },
  { id: 'vifurushi', label: 'Vifurushi', icon: Package, color: 'bg-orange-500', sub: 'Parcel 📦' },
  { id: 'dawa', label: 'Duka la Dawa', icon: Pill, color: 'bg-blue-500', sub: 'Pharmacy 💊' },
  { id: 'maduka', label: 'Maduka', icon: ShoppingBag, color: 'bg-purple-500', sub: 'eCommerce 🛍️' },
  { id: 'saluni', label: 'Saluni', icon: Scissors, color: 'bg-pink-500', sub: 'Salons 💇‍♀️' },
  { id: 'hoteli', label: 'Hoteli', icon: Hotel, color: 'bg-indigo-500', sub: 'Hotels 🏨' },
];

import { useLanguage } from '../LanguageContext';

export default function CustomerDashboard() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<{id: string, title: string, sub: string, img: string}[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [location, setLocation] = useState({
    address: 'Mbezi Beach, DSM',
    lat: -6.7924,
    lng: 39.2083
  });

  const services = [
    { id: 'chakula', label: t('food') || 'Chakula', icon: Utensils, color: 'bg-red-500', sub: 'Food Delivery 🍔' },
    { id: 'sokoni', label: t('grocery') || 'Sokoni', icon: ShoppingCart, color: 'bg-green-500', sub: 'Grocery 🛒' },
    { id: 'teksi', label: t('taxi') || 'Teksi', icon: Car, color: 'bg-yellow-500', sub: 'Taxi 🚕' },
    { id: 'vifurushi', label: t('parcel') || 'Vifurushi', icon: Package, color: 'bg-orange-500', sub: 'Parcel 📦' },
    { id: 'dawa', label: t('pharmacy') || 'Duka la Dawa', icon: Pill, color: 'bg-blue-500', sub: 'Pharmacy 💊' },
    { id: 'maduka', label: t('ecommerce') || 'Maduka', icon: ShoppingBag, color: 'bg-purple-500', sub: 'eCommerce 🛍️' },
    { id: 'saluni', label: t('salons') || 'Saluni', icon: Scissors, color: 'bg-pink-500', sub: 'Salons 💇‍♀️' },
    { id: 'hoteli', label: t('hotels') || 'Hoteli', icon: Hotel, color: 'bg-indigo-500', sub: 'Hotels 🏨' },
  ];

  useEffect(() => {
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
        onClose={() => setIsLocationPickerOpen(false)}
        onSelect={(newLoc) => setLocation(newLoc)}
        initialLocation={location}
      />

      {/* 2. Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-400" />
        <input 
          type="text"
          placeholder={t('search_placeholder') || "Tafuta huduma, mgahawa, au bidhaa..."}
          className="w-full h-12 pl-12 pr-4 bg-neutral-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 3. Promotional Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x">
        {banners.map((banner) => (
          <div key={banner.id} className="min-w-[85%] md:min-w-[45%] lg:min-w-[30%] h-48 md:h-64 rounded-3xl overflow-hidden relative snap-center shadow-md">
            <img src={banner.img} alt={banner.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex flex-col justify-center p-8 text-white">
              <h3 className="text-2xl font-bold">{banner.title}</h3>
              <p className="text-sm opacity-90 mt-1">{banner.sub}</p>
              <button className="mt-4 bg-white text-black text-xs font-bold px-6 py-2 rounded-full w-fit uppercase tracking-wider hover:bg-orange-600 hover:text-white transition-colors">
                {t('order_now') || 'Order Now'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 5. Main Services Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl">{t('other_services') || 'Huduma Nyingine'}</h3>
          <button className="text-orange-600 text-sm font-bold flex items-center gap-1">
            {t('see_all') || 'See All'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
          {services.map((service) => (
            <Link 
              key={service.id} 
              to={`/service/${service.id}`}
              className="flex flex-col items-center text-center group"
            >
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-2 text-white shadow-md group-hover:scale-110 transition-transform ${service.color}`}>
                <service.icon className="w-7 h-7 md:w-8 md:h-8" />
              </div>
              <span className="font-bold text-xs text-neutral-900 truncate w-full">{service.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Migahawa Maarufu (Restaurants) - Vertical List for prominence */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl">{t('popular_restaurants') || 'Migahawa Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-bold">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex p-4 gap-4">
                <div className="w-28 h-28 rounded-2xl overflow-hidden relative shrink-0">
                  <img 
                    src={vendor.logoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
                    alt={vendor.businessName} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-orange-500 fill-current" />
                    <span className="text-[9px] font-bold">{vendor.rating || '4.5'}</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h4 className="font-bold text-lg text-neutral-900 group-hover:text-orange-600 transition-colors">{vendor.businessName}</h4>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{vendor.description || 'Vyakula vya Baharini na Vinywaji'}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] bg-orange-50 text-orange-600 border-none px-2 py-0.5">
                        {vendor.category}
                      </Badge>
                      <span className="text-[10px] text-neutral-400">1.2 km</span>
                    </div>
                    <button className="bg-neutral-900 text-white text-xs font-bold px-4 py-1.5 rounded-full hover:bg-orange-600 transition-colors">
                      {t('order') || 'Agiza'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {vendors.length === 0 && (
            <div className="py-12 text-center bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
              <p className="text-neutral-400 text-sm italic">{t('no_restaurants_found') || 'Hakuna migahawa iliyopatikana karibu nawe.'}</p>
            </div>
          )}
        </div>
      </section>

      {/* 6. Bidhaa Maarufu (Popular Products) - Horizontal scroll below */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl">{t('popular_products') || 'Bidhaa Maarufu'}</h3>
          <button className="text-orange-600 text-sm font-bold">{t('view_all') || 'View All'}</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {products.map((product) => (
            <Link 
              key={product.id} 
              to={`/product/${product.id}`}
              className="block group"
            >
              <Card className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-lg transition-all h-full">
                <div className="h-40 relative overflow-hidden">
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
            <div className="min-w-full py-8 text-center bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
              <p className="text-neutral-400 text-xs italic">{t('no_products_found') || 'Hakuna bidhaa maarufu kwa sasa.'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
