import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { VendorProfile, Product, VendorCategory } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Star, Search, Filter, 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, ShoppingBag 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';

const serviceMapping: Record<string, { category: VendorCategory, labelKey: string, icon: any, color: string }> = {
  'chakula': { category: 'restaurant', labelKey: 'food', icon: Utensils, color: 'bg-red-500' },
  'sokoni': { category: 'grocery', labelKey: 'grocery', icon: ShoppingCart, color: 'bg-green-500' },
  'dawa': { category: 'pharmacy', labelKey: 'pharmacy', icon: Pill, color: 'bg-blue-500' },
  'maduka': { category: 'ecommerce', labelKey: 'ecommerce', icon: ShoppingBag, color: 'bg-purple-500' },
  'teksi': { category: 'taxi', labelKey: 'taxi', icon: Car, color: 'bg-yellow-500' },
  'saluni': { category: 'salon', labelKey: 'salons', icon: Scissors, color: 'bg-pink-500' },
  'hoteli': { category: 'hotel', labelKey: 'hotels', icon: Hotel, color: 'bg-indigo-500' },
  'vifurushi': { category: 'parcel', labelKey: 'parcel', icon: Package, color: 'bg-orange-500' },
};

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [viewMode, setViewMode] = useState<'products' | 'vendors'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const config = id ? serviceMapping[id] : null;

  useEffect(() => {
    if (!config) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Filter vendors by category
    const qVendors = query(
      collection(db, 'vendors'), 
      where('category', '==', config.category),
      where('status', '==', 'active')
    );
    
    const unsubVendors = onSnapshot(qVendors, (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vendors');
    });

    // Filter products
    const qAllProducts = query(collection(db, 'products'));

    const unsubProducts = onSnapshot(qAllProducts, (snapshot) => {
      const allProds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(allProds);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => {
      unsubVendors();
      unsubProducts();
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
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-2 -mx-4 px-4 border-b border-neutral-100 flex items-center justify-between">
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
              {vendors.length} Businesses • {matchedProducts.length} Items
            </p>
          </div>
        </div>
        <div className={`p-3 rounded-2xl text-white shadow-lg ${config.color}`}>
          <config.icon className="w-6 h-6" />
        </div>
      </div>

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
        <Button variant="outline" className="h-11 rounded-xl gap-2 border-neutral-200">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-neutral-100 rounded-2xl relative">
        <button
          onClick={() => setViewMode('products')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${
            viewMode === 'products' ? 'text-orange-600' : 'text-neutral-500'
          }`}
        >
          {t('products') || 'Products'}
        </button>
        <button
          onClick={() => setViewMode('vendors')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${
            viewMode === 'vendors' ? 'text-orange-600' : 'text-neutral-500'
          }`}
        >
          {t('businesses') || 'Businesses'}
        </button>
        <motion.div
          animate={{ x: viewMode === 'products' ? '0%' : '100%' }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm border border-neutral-200"
        />
      </div>

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
                {filteredProducts.map((product) => (
                  <Link 
                    key={product.id} 
                    to={`/product/${product.id}`}
                    className="block group"
                  >
                    <Card className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-lg transition-all h-full">
                      <div className="h-40 relative overflow-hidden">
                        <img 
                          src={product.imageUrl || 'https://picsum.photos/seed/food/400'} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          referrerPolicy="no-referrer"
                        />
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
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {filteredVendors.map((vendor) => (
                  <Link key={vendor.id} to={`/vendor/${vendor.id}`}>
                    <Card className="overflow-hidden rounded-3xl border-neutral-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex p-4 gap-4">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden relative shrink-0">
                          <img 
                            src={vendor.logoUrl || 'https://picsum.photos/seed/restaurant/400'} 
                            alt={vendor.businessName} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-center py-1">
                          <h4 className="font-black text-lg text-neutral-900 group-hover:text-orange-600 transition-colors uppercase italic">{vendor.businessName}</h4>
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{vendor.description}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge className="bg-orange-50 text-orange-600 border-none text-[8px] uppercase font-bold">
                              {vendor.category}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-orange-500 fill-current" />
                              <span className="text-xs font-bold text-neutral-600">{vendor.rating || '4.5'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
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
    </div>
  );
}
