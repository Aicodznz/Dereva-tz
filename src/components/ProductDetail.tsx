import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, VendorProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Star, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Info, 
  Calendar, 
  Clock, 
  Users,
  ChevronDown,
  ChevronUp,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  
  // Adaptive States
  const [selectedSize, setSelectedSize] = useState('Normal');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const pData = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(pData);
          
          // Fetch Vendor
          const vRef = doc(db, 'vendors', pData.vendorId);
          const vSnap = await getDoc(vRef);
          if (vSnap.exists()) {
            setVendor({ id: vSnap.id, ...vSnap.data() } as VendorProfile);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'products');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

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
      <div className="space-y-8">
        {/* Dynamic Variations (Sizes) */}
        {product.variations && product.variations.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Chagua Ukubwa (Size)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {product.variations.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSize(v.name)}
                  className={`py-3 px-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedSize === v.name 
                      ? 'border-orange-600 bg-orange-50 text-orange-600' 
                      : 'border-neutral-100 text-neutral-500'
                  }`}
                >
                  <span className="font-bold text-sm">{v.name}</span>
                  {v.price > 0 && (
                    <span className="text-[10px] font-medium">+{v.price.toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Add-ons (Vionjo) */}
        {product.addOns && product.addOns.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Vionjo vya Ziada (Add-ons)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.addOns.map((addon, idx) => (
                <button
                  key={idx}
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
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white lg:bg-neutral-50 pb-80 lg:pb-32">
      <div className="max-w-7xl mx-auto lg:px-8 lg:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* 1. Image Gallery */}
          <div className="relative h-[300px] md:h-[450px] lg:h-[600px] w-full bg-neutral-100 lg:rounded-[40px] overflow-hidden shadow-sm lg:shadow-xl">
            <img 
              src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'} 
              alt={product.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => navigate(-1)}
              className="absolute top-6 left-6 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all z-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
              <div className="w-8 h-1.5 bg-white rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
              <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
            </div>
          </div>

          <div className="px-4 lg:px-0 space-y-6 lg:space-y-8">
            {/* 2. Core Info */}
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 flex-1">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-neutral-900 leading-tight">
                    {product.name}
                  </h1>
                  <Link to={`/vendor/${vendor?.id}`} className="block text-sm md:text-base text-neutral-500 hover:text-orange-600 transition-colors underline decoration-neutral-200 underline-offset-4">
                    by {vendor?.businessName || 'Papo Hapo Store'}
                  </Link>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl md:text-2xl lg:text-3xl font-black text-orange-600">
                    TZS {product.price.toLocaleString()}
                  </p>
                  <Badge variant="secondary" className="mt-1 bg-orange-100 text-orange-700 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {product.category}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4 text-orange-500 fill-current" />
                  <span className="text-sm font-bold text-orange-700">4.8</span>
                </div>
                <span className="text-xs text-neutral-400 font-medium">(215 reviews)</span>
              </div>
            </div>

            {/* 3. Description */}
            <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-neutral-100 shadow-sm space-y-4">
              <h3 className="font-bold text-lg lg:text-xl">Maelezo</h3>
              <div className="relative">
                <p className={`text-neutral-600 leading-relaxed text-sm lg:text-base ${!isDescExpanded && 'line-clamp-3 lg:line-clamp-4'}`}>
                  {product.description || 'Hii ni bidhaa bora kabisa inayopatikana Papo Hapo. Imetengenezwa kwa weledi na ubora wa hali ya juu ili kukidhi mahitaji yako ya kila siku.'}
                </p>
                <button 
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-3 text-orange-600 text-xs lg:text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  {isDescExpanded ? 'Read Less' : 'Read More'}
                  {isDescExpanded ? <ChevronUp className="w-3 h-3 lg:w-4 lg:h-4" /> : <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4" />}
                </button>
              </div>
            </div>

            {/* 4. Adaptive Options */}
            <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-neutral-100 shadow-sm">
              {renderAdaptiveOptions()}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Action Bar - Positioned above mobile nav */}
      <div className="fixed bottom-[80px] md:bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-neutral-100 z-[999] shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex gap-3 md:gap-6 items-center">
          <div className="flex items-center bg-neutral-100 rounded-2xl p-1 md:p-1.5 shrink-0 border border-neutral-200">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-neutral-600 hover:text-orange-600 hover:bg-white rounded-xl transition-all"
            >
              <Minus className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <span className="w-8 md:w-12 text-center font-black text-base md:text-lg text-neutral-900">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-neutral-600 hover:text-orange-600 hover:bg-white rounded-xl transition-all"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          
          <Button className="flex-1 h-14 md:h-16 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm md:text-lg shadow-lg shadow-orange-600/40 gap-2 md:gap-3 transition-all transform active:scale-[0.98]">
            <ShoppingCart className="w-4 h-4 md:w-6 md:h-6" />
            <span className="truncate">
              {getCategoryLabel() === 'hotel' || getCategoryLabel() === 'car_rental' 
                ? `Book • TZS ${(product.price * quantity).toLocaleString()}`
                : `Ongeza • TZS ${(product.price * quantity).toLocaleString()}`
              }
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
