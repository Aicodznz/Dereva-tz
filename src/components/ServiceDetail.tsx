import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { VendorProfile, Product, VendorCategory } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, Search, Filter, MapPin, ChevronRight,
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, ShoppingBag, Bus, Plus 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { useCart } from '../CartContext';
import { toast } from 'sonner';
import BusBooking from './BusBooking';

const serviceMapping: Record<string, { category: VendorCategory, labelKey: string, icon: any, color: string }> = {
  'chakula': { category: 'restaurant', labelKey: 'food', icon: Utensils, color: 'bg-red-500' },
  'sokoni': { category: 'grocery', labelKey: 'grocery', icon: ShoppingCart, color: 'bg-green-500' },
  'dawa': { category: 'pharmacy', labelKey: 'pharmacy', icon: Pill, color: 'bg-blue-500' },
  'maduka': { category: 'ecommerce', labelKey: 'ecommerce', icon: ShoppingBag, color: 'bg-purple-500' },
  'teksi': { category: 'taxi', labelKey: 'taxi', icon: Car, color: 'bg-yellow-500' },
  'saluni': { category: 'salon', labelKey: 'salons', icon: Scissors, color: 'bg-pink-500' },
  'hoteli': { category: 'hotel', labelKey: 'hotels', icon: Hotel, color: 'bg-indigo-500' },
  'vifurushi': { category: 'parcel', labelKey: 'parcel', icon: Package, color: 'bg-orange-500' },
  'bus_ticket': { category: 'bus_ticket', labelKey: 'Bus Tickets', icon: Bus, color: 'bg-orange-600' },
  'all-stores': { category: 'all' as any, labelKey: 'all_stores', icon: ShoppingBag, color: 'bg-orange-600' },
};

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addItem } = useCart();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [viewMode, setViewMode] = useState<'products' | 'vendors'>(id === 'all-stores' ? 'vendors' : 'products');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [location] = useState(() => {
    const saved = localStorage.getItem('omniserve_user_location');
    return saved ? JSON.parse(saved) : {
      address: '',
      lat: -6.7924,
      lng: 39.2083
    };
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

  const config = id ? serviceMapping[id] : null;

  useEffect(() => {
    if (!config) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      try {
        const vendorsRef = collection(db, 'vendors');
        const vQuery = (config.category as any) === 'all' 
          ? query(vendorsRef, where('status', '==', 'active'))
          : query(
              vendorsRef, 
              where('category', '==', config.category),
              where('status', '==', 'active')
            );
        const vendorsSnap = await getDocs(vQuery);
        setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));

        const productsRef = collection(db, 'products');
        const productsSnap = await getDocs(productsRef);
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    const catStr = config.category as string;
    const vQuery = catStr === 'all'
      ? query(collection(db, 'vendors'), where('status', '==', 'active'))
      : query(collection(db, 'vendors'), where('category', '==', config.category), where('status', '==', 'active'));

    const vUnsub = onSnapshot(vQuery, (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vendors');
    });

    const pUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    return () => {
      vUnsub();
      pUnsub();
    };
  }, [id, config]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold">Service not found</h2>
        <Button onClick={() => navigate('/')} className="mt-4">Back to Home</Button>
      </div>
    );
  }

  const matchedProducts = products.filter(p => 
    (config.category as any) === 'all' ||
    p.vendorCategory === config.category || 
    vendors.some(v => v.id === p.vendorId)
  );

  const filteredProducts = matchedProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    v.businessName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pb-20 space-y-4 px-1 sm:px-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-2 -mx-1 px-2 mb-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">
              {t(config.labelKey) || config.labelKey}
            </h1>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest">
              {id === 'all-stores' 
                ? `Explore our complete collection of ${vendors.length} Stores`
                : `${vendors.length} Businesses • ${matchedProducts.length} Items`
              }
            </p>
          </div>
        </div>
        <div className={`p-3 rounded-2xl text-white shadow-lg ${config.color}`}>
          <config.icon className="w-6 h-6" />
        </div>
      </div>

      {config.category === 'bus_ticket' ? (
        <BusBooking vendors={vendors} products={matchedProducts} />
      ) : (
        <>
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text"
                placeholder={t('search_placeholder') || "Search..."}
                className="w-full h-11 pl-10 pr-4 bg-neutral-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {id !== 'all-stores' && (
            <div className="flex p-1 bg-neutral-100 rounded-2xl relative">
              <button
                onClick={() => setViewMode('vendors')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${
                  viewMode === 'vendors' ? 'text-orange-600' : 'text-neutral-500'
                }`}
              >
                {t('businesses') || 'Businesses'}
              </button>
              <motion.div
                animate={{ x: '0%' }}
                className="absolute top-1 left-1 bottom-1 w-[calc(100%-8px)] bg-white rounded-xl shadow-sm border border-neutral-200"
              />
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-neutral-500">Loading catalog...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {viewMode === 'products' ? (
                  <motion.div
                    key="prod-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                  >
                    {filteredProducts.map((product, idx) => (
                      <Link 
                        key={`svc-prod-${product.id}-${idx}`} 
                        to={`/product/${product.id}`}
                        className="block group"
                      >
                        <Card className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-lg transition-all h-full relative group/card">
                          <div className="h-40 relative overflow-hidden">
                            <img 
                              src={product.imageUrl || 'https://picsum.photos/seed/food/400'} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addItem(product);
                                toast.success(`${product.name} imeongezwa!`);
                              }}
                              className="absolute bottom-2 right-2 w-10 h-10 bg-white dark:bg-neutral-800 rounded-xl shadow-xl flex items-center justify-center text-orange-600 hover:bg-orange-600 hover:text-white transition-all transform z-10"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          <CardContent className="p-4">
                            <h4 className="font-bold text-sm text-neutral-900 truncate group-hover:text-orange-600 transition-colors uppercase italic">{product.name}</h4>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-orange-600 font-black">
                                 TZS {product.price.toLocaleString()}
                              </p>
                              <p className="text-[8px] text-neutral-400 font-bold uppercase">
                                {vendors.find(v => v.id === product.vendorId)?.businessName || 'Merchant'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-3">
                        <p className="text-neutral-400 italic text-sm">No products found for this service.</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="vend-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-6 md:gap-8"
                  >
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
                        key={`svc-vend-${vendor.id}-${idx}`}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.05 * idx }}
                        whileHover={{ y: -5 }}
                      >
                        <Link to={`/vendor/${vendor.id}`} className="group block h-full">
                          <div className="relative h-full bg-white dark:bg-neutral-900 rounded-xl sm:rounded-[2.5rem] border border-neutral-100 dark:border-white/5 shadow-sm sm:shadow-[0_20px_50px_rgba(0,0,0,0.06)] group-hover:shadow-[0_20px_40px_rgba(234,88,12,0.1)] transition-all duration-500 overflow-hidden group/card border-b-2 sm:border-b-4 border-b-neutral-100 active:scale-[0.98]">
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
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                              
                              {/* Category Badge - Hidden on mobile */}
                              <div className="absolute top-2 right-2 sm:top-5 sm:right-5 hidden sm:block">
                                 <Badge className="bg-orange-600 text-white font-black px-4 py-1.5 rounded-full text-[9px] uppercase border-none shadow-xl shadow-orange-600/30 tracking-widest">
                                    {vendor.category}
                                 </Badge>
                              </div>
                            </div>

                            {/* Logo Overlap - Moved out of overflow-hidden div with better positioning */}
                            <div className="absolute top-[3.5rem] sm:top-[7.5rem] left-1.5 sm:left-6 z-10">
                              <div className="w-8 h-8 sm:w-20 sm:h-20 rounded-lg sm:rounded-3xl bg-white dark:bg-neutral-800 p-1 sm:p-1.5 shadow-md border border-white dark:border-neutral-800">
                                <img 
                                  key={vendor.logoUrl || `dicebear-${vendor.businessName}`}
                                  src={vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`} 
                                  alt="Logo" 
                                  className="w-full h-full object-contain rounded-md sm:rounded-2xl"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendor.businessName || 'vendor')}`;
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </div>

                            <div className="pt-6 sm:pt-14 p-1.5 sm:pt-10 sm:p-8 space-y-1 sm:space-y-4">
                              <div>
                                <h4 className="font-black text-[10px] min-[400px]:text-[12px] sm:text-2xl text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase italic tracking-tighter leading-none truncate mb-1 sm:mb-2">{vendor.businessName}</h4>
                                <div className="flex items-center gap-1 sm:gap-3">
                                  <div className="flex items-center gap-0.5 sm:gap-1.5 bg-orange-50 dark:bg-orange-950/30 px-1 sm:px-2 py-0.5 rounded-sm">
                                    <Star className="w-2 sm:w-3.5 h-2 sm:h-3.5 text-orange-600 fill-current" />
                                    <span className="text-[8px] sm:text-[11px] font-black text-orange-600">{Number(vendor.rating || 0).toFixed(1)}</span>
                                    <span className="text-[6px] sm:text-[9px] text-orange-400 font-bold ml-0.5">({Number(vendor.ratingCount || 0)})</span>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (vendor.location) {
                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${vendor.location.lat},${vendor.location.lng}`, '_blank');
                                      }
                                    }}
                                    className="flex items-center gap-0.5 sm:gap-1.5 bg-green-50 dark:bg-green-950/30 px-1 sm:px-2 py-0.5 rounded-sm hover:bg-green-100 transition-colors"
                                    title="Get directions"
                                  >
                                    <MapPin className="w-2 sm:w-3.5 h-2 sm:h-3.5 text-green-600" />
                                    <span className="text-[8px] sm:text-[11px] font-black text-green-600 uppercase tracking-tighter">
                                      {vendor.distance < 0.5 
                                        ? `${(vendor.distance * 1000).toFixed(0)}m` 
                                        : `${vendor.distance.toFixed(1)}km`}
                                    </span>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="pt-1.5 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between">
                                <p className="text-[8px] sm:text-[10px] text-neutral-400 font-bold uppercase tracking-widest hidden md:block">{t('open_now') || 'Open Now'}</p>
                                <div className="flex items-center gap-1 sm:gap-2 text-orange-600 group-hover:translate-x-1 transition-transform ml-auto">
                                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest leading-none">{t('visit') || 'Visit'}</span>
                                  <ChevronRight className="w-2 sm:w-4 h-2 sm:h-4 text-orange-600" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                    {filteredVendors.length === 0 && (
                      <div className="col-span-full py-20 text-center">
                        <p className="text-neutral-400 italic text-sm">No businesses found for this service.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
