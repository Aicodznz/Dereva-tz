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
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, ShoppingBag, Bus, Plus,
  Sparkles, Flower, Droplet, User, Smile, Home, Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { useCart } from '../CartContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import { toast } from 'sonner';
import BusBooking from './BusBooking';

const serviceMapping: Record<string, { category: VendorCategory, labelKey: string, icon: any, color: string }> = {
  'chakula': { category: 'restaurant', labelKey: 'PapoFood', icon: Utensils, color: 'bg-red-500' },
  'sokoni': { category: 'grocery', labelKey: 'PapoMart', icon: ShoppingCart, color: 'bg-green-500' },
  'dawa': { category: 'pharmacy', labelKey: 'PapoMed', icon: Pill, color: 'bg-blue-500' },
  'maduka': { category: 'ecommerce', labelKey: 'PapoMall', icon: ShoppingBag, color: 'bg-purple-500' },
  'teksi': { category: 'taxi', labelKey: 'PapoRide', icon: Car, color: 'bg-yellow-500' },
  'saluni': { category: 'salon', labelKey: 'PapoStyle', icon: Scissors, color: 'bg-pink-500' },
  'hoteli': { category: 'hotel', labelKey: 'PapoStay', icon: Hotel, color: 'bg-indigo-500' },
  'vifurushi': { category: 'parcel', labelKey: 'PapoSend', icon: Package, color: 'bg-orange-500' },
  'bus_ticket': { category: 'bus_ticket', labelKey: 'PapoBus', icon: Bus, color: 'bg-orange-600' },
  'car_rental': { category: 'taxi', labelKey: 'PapoRent', icon: Key, color: 'bg-teal-600' },
  'kodi_nyumba': { category: 'hotel', labelKey: 'PapoHoteli', icon: Home, color: 'bg-amber-600' },
  'all-stores': { category: 'all' as any, labelKey: 'all_stores', icon: ShoppingBag, color: 'bg-orange-600' },
};

const SALON_SUB_CATEGORIES = [
  { id: 'hair', label: 'Saluni ya Nywele', subLabel: 'Hair salons', icon: Scissors, color: 'text-pink-600', border: 'border-pink-200 hover:border-pink-500 bg-pink-50/20 dark:bg-pink-950/10 dark:border-pink-900/30', iconBg: 'bg-pink-100 dark:bg-pink-900/30' },
  { id: 'nails', label: 'Matunzo ya Kucha', subLabel: 'Nail salons', icon: Sparkles, color: 'text-amber-600', border: 'border-amber-200 hover:border-amber-500 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-900/30', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
  { id: 'makeup', label: 'Urembo na Makeup', subLabel: 'Makeup', icon: Smile, color: 'text-rose-600', border: 'border-rose-200 hover:border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 dark:border-rose-900/30', iconBg: 'bg-rose-100 dark:bg-rose-900/30' },
  { id: 'skin', label: 'Matunzo ya Ngozi', subLabel: 'Skin care', icon: Droplet, color: 'text-emerald-500', border: 'border-emerald-200 hover:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-900/30', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'spa', label: 'Spa na Massage', subLabel: 'Spa', icon: Flower, color: 'text-teal-600', border: 'border-teal-200 hover:border-teal-500 bg-teal-50/20 dark:bg-teal-950/10 dark:border-teal-900/30', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
  { id: 'body', label: 'Urembo wa Mwili', subLabel: 'Body beauty', icon: User, color: 'text-indigo-600', border: 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 dark:border-indigo-900/30', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' }
];

const subCategoryKeywords: Record<string, string[]> = {
  hair: ['hair', 'nywele', 'kinyozi', 'shave', 'cut', 'style', 'kusuka', 'weaving', 'braids', 'piko', 'wig', 'dreadlocks'],
  nails: ['nail', 'kucha', 'manicure', 'pedicure', 'polish', 'gel', 'acrylic', 'tips'],
  makeup: ['makeup', 'urembo', 'eyebrow', 'eyelash', 'foundation', 'wanja', 'poda', 'makeup', 'lipstick', 'mascara'],
  skin: ['skin', 'ngozi', 'facial', 'scrub', 'mask', 'acne', 'cleansing', 'lotion', 'face wash'],
  spa: ['spa', 'massage', 'relax', 'arotherapy', 'body massage', 'therapist', 'steam'],
  body: ['body', 'mwili', 'wax', 'waxing', 'tattoo', 'piercing', 'henna', 'body scrub']
};

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addItem } = useCart();
  const { config: businessConfig } = useBusinessConfig();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [viewMode, setViewMode] = useState<'products' | 'vendors'>(id === 'all-stores' ? 'vendors' : 'products');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [showAllSalonOnce, setShowAllSalonOnce] = useState(false);
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

  const matchedProducts = products.filter(p => {
    if (p.hidden === true) {
      return false;
    }
    const currentServiceId = id || '';
    const sState = businessConfig?.services?.[currentServiceId];
    if (sState && sState.enabled === false) {
      return false;
    }
    if (sState?.maintenance === true && sState?.hideProductsDuringMaintenance === true) {
      return false;
    }

    const vendor = vendors.find(v => v.id === p.vendorId);
    if (vendor && vendor.hideProducts === true) {
      return false;
    }
    const isSalon = p.vendorCategory === 'salon' || p.category === 'salon' || vendors.some(v => v.id === p.vendorId);
    if (config.category === 'salon') {
      if (!isSalon) return false;
      if (selectedSubCategory) {
        const keywords = subCategoryKeywords[selectedSubCategory] || [];
        const matchesKeyword = keywords.some(kw => 
          p.name.toLowerCase().includes(kw) || 
          p.description.toLowerCase().includes(kw) || 
          (p.category || '').toLowerCase().includes(kw)
        );
        return matchesKeyword;
      }
      return true;
    }
    return (
      (config.category as any) === 'all' ||
      p.vendorCategory === config.category || 
      vendors.some(v => v.id === p.vendorId)
    );
  });

  const filteredProducts = matchedProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.businessName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (config.category === 'salon' && selectedSubCategory) {
      const keywords = subCategoryKeywords[selectedSubCategory] || [];
      const hasMatchingProduct = products.some(p => 
        p.vendorId === v.id && 
        keywords.some(kw => 
          p.name.toLowerCase().includes(kw) || 
          (p.category || '').toLowerCase().includes(kw)
        )
      );
      const matchesVendorText = keywords.some(kw => 
        v.businessName.toLowerCase().includes(kw) || 
        v.description.toLowerCase().includes(kw)
      );
      return hasMatchingProduct || matchesVendorText;
    }
    return true;
  });

  return (
    <div className="pb-20 space-y-4 px-1 sm:px-4">
      {/* Header */}
      {id !== 'saluni' && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-2 -mx-1 px-2 mb-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (id === 'saluni' && (selectedSubCategory || showAllSalonOnce)) {
                  setSelectedSubCategory(null);
                  setShowAllSalonOnce(false);
                } else {
                  navigate(-1);
                }
              }}
              className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-black italic uppercase tracking-tighter">
                {t(config.labelKey) || config.labelKey}
              </h1>
              {id === 'saluni' ? (
                (selectedSubCategory || showAllSalonOnce) ? (
                  <p className="text-[10px] uppercase font-bold text-pink-600 tracking-widest animate-fade-in">
                    {selectedSubCategory 
                      ? `${SALON_SUB_CATEGORIES.find(s => s.id === selectedSubCategory)?.label || ''}: ${filteredVendors.length} Saluni` 
                      : `Saluni Zote: ${filteredVendors.length} Saluni`
                    }
                  </p>
                ) : null
              ) : (
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest">
                  {id === 'all-stores' 
                    ? `Explore our complete collection of ${vendors.length} Stores`
                    : `${vendors.length} Businesses • ${matchedProducts.length} Items`
                  }
                </p>
              )}
            </div>
          </div>
          {config.category === 'bus_ticket' ? (
            <button 
              id="btn-tiketi-zangu"
              onClick={() => navigate('/my-orders')}
              className={`p-2.5 px-3.5 rounded-2xl text-white shadow-lg ${config.color} hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-white/20`}
              title="Angalia Tiketi Zangu / View My Tickets"
            >
              <div className="flex flex-col items-end text-right leading-none">
                <span className="text-[8px] font-black uppercase tracking-widest text-orange-200 opacity-90">Tiketi</span>
                <span className="text-[11px] font-black uppercase italic tracking-tight text-white">Zangu</span>
              </div>
              <config.icon className="w-5 h-5" />
            </button>
          ) : (
            <div className={`p-3 rounded-2xl text-white shadow-lg ${config.color}`}>
              <config.icon className="w-6 h-6" />
            </div>
          )}
        </div>
      )}

      {config.category === 'bus_ticket' ? (
        <BusBooking vendors={vendors} products={matchedProducts} />
      ) : id === 'saluni' && !selectedSubCategory && !showAllSalonOnce ? (
        <div className="flex flex-col items-center justify-center py-6 px-3 text-center space-y-6 animate-fade-in font-sans">
          {/* Top Custom Back to Dashboard button */}
          <div className="w-full flex justify-start mb-2 px-1">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-805 text-neutral-800 dark:text-neutral-200 font-black text-xs uppercase tracking-widest transition-all active:scale-95 duration-200 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Rudi Nyumbani</span>
            </button>
          </div>

          <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="text-pink-600 font-extrabold text-xs uppercase tracking-widest block font-display">Welcome</span>
            <h2 className="text-2xl min-[400px]:text-3xl font-black text-neutral-900 dark:text-white tracking-tight uppercase italic leading-none">
              What are you looking for?
            </h2>
            <p className="text-[10px] min-[400px]:text-xs text-neutral-500 max-w-sm mx-auto font-bold uppercase tracking-wide">
              Chagua huduma unayotaka ili kupata wataalamu wa saluni karibu nawe
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
            {SALON_SUB_CATEGORIES.map((sub, i) => {
              const IconComponent = sub.icon;
              return (
                <motion.button
                  key={sub.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedSubCategory(sub.id);
                    setViewMode('vendors'); // Default to salons for the subcategory
                  }}
                  className={`p-4 min-[420px]:p-5 rounded-[2rem] border-2 bg-white dark:bg-neutral-900 transition-all flex flex-col items-center justify-center text-center space-y-3 shadow-sm min-h-[140px] h-full ${sub.border} group`}
                >
                  <div className={`p-3 rounded-2xl ${sub.iconBg} transition-transform group-hover:scale-110 duration-300`}>
                    <IconComponent className={`w-6 h-6 ${sub.color}`} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-black text-xs min-[400px]:text-sm text-neutral-950 dark:text-white tracking-tight uppercase italic leading-none truncate w-full">
                      {sub.label}
                    </h4>
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {sub.subLabel}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="pt-2 animate-in fade-in duration-700">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAllSalonOnce(true);
                setViewMode('vendors');
              }}
              className="text-pink-600 border-pink-200 hover:bg-pink-50 hover:text-pink-700 font-extrabold text-xs uppercase tracking-widest gap-2 rounded-[20px] dark:border-pink-900/30 dark:hover:bg-pink-950/20"
            >
              Angalia Saluni Zote / View All Salons <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Salon Horizontal Sub-category Switcher */}
          {id === 'saluni' && (selectedSubCategory || showAllSalonOnce) && (
            <div className="flex gap-2 items-center overflow-x-auto pb-4 pt-1 -mx-1 px-1 scrollbar-none sticky top-0 z-20 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md">
              <button
                onClick={() => {
                  setSelectedSubCategory(null);
                  setShowAllSalonOnce(false);
                }}
                className="px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap border bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 border-neutral-200 dark:border-white/5 text-neutral-800 dark:text-neutral-200 active:scale-95 duration-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Rudi nyuma</span>
              </button>
              <button
                onClick={() => {
                  setSelectedSubCategory(null);
                  setShowAllSalonOnce(true);
                }}
                className={`px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap border ${
                  !selectedSubCategory
                    ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-600/20 font-black'
                    : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-900 dark:border-white/5 text-neutral-600 dark:text-neutral-400 hover:border-pink-500/50'
                }`}
              >
                Zote (All Salons)
              </button>
              {SALON_SUB_CATEGORIES.map((sub) => {
                const IconComponent = sub.icon;
                const isSelected = selectedSubCategory === sub.id;
                return (
                  <button
                    key={`switcher-${sub.id}`}
                    onClick={() => {
                      setSelectedSubCategory(sub.id);
                      setShowAllSalonOnce(false);
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap border ${
                      isSelected
                        ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-600/20 font-black'
                        : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-900 dark:border-white/5 text-neutral-600 dark:text-neutral-400 hover:border-pink-500/50'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text"
                placeholder={t('search_placeholder') || "Search..."}
                className="w-full h-11 pl-10 pr-4 bg-neutral-100 dark:bg-neutral-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {id !== 'all-stores' && (
            <div className="flex p-1 bg-neutral-105 dark:bg-neutral-900 border border-neutral-100 dark:border-white/5 rounded-2xl relative">
              <button
                onClick={() => setViewMode('products')}
                className={`flex-1 py-3 text-[10px] min-[360px]:text-xs font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${
                  viewMode === 'products' ? 'text-pink-600 font-extrabold' : 'text-neutral-500'
                }`}
              >
                {id === 'saluni' ? 'Huduma (Services)' : (t('products') || 'Products')}
              </button>
              <button
                onClick={() => setViewMode('vendors')}
                className={`flex-1 py-3 text-[10px] min-[360px]:text-xs font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${
                  viewMode === 'vendors' ? 'text-pink-600 font-extrabold' : 'text-neutral-500'
                }`}
              >
                {id === 'saluni' ? 'Saluni (Salons)' : (t('businesses') || 'Businesses')}
              </button>
              <motion.div
                animate={{ x: viewMode === 'products' ? '0%' : '100%' }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-white/5"
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
                        to={product.vendorCategory === 'bus_ticket' || product.category === 'bus_ticket' || product.name.toLowerCase().includes('bus ticket') ? '/service/bus_ticket' : `/product/${product.id}`}
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
                                        const originStr = location ? `&origin=${location.lat},${location.lng}` : '';
                                        window.open(`https://www.google.com/maps/dir/?api=1${originStr}&destination=${vendor.location.lat},${vendor.location.lng}`, '_blank');
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
