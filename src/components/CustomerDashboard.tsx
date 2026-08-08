import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, limit, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { VendorProfile, Product } from '../types';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from './ui/Skeleton';
import { 
  Utensils, ShoppingCart, Pill, Package, Car, Scissors, Hotel, Star, 
  Search, Bell, MapPin, ChevronRight, ShoppingBag, Tag, Plus, ShoppingBasket,
  FileText, Smartphone, Box, Dog, Bus, Sparkles, Wrench, Key, Camera, Home
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useBusinessConfig } from '../BusinessConfigContext';
import LocationPicker from './LocationPicker';

import { useLanguage } from '../LanguageContext';
import { useCart } from '../CartContext';
import HowToOrder from './HowToOrder';
import { useHeader } from '../HeaderContext';
import App3DShowcase from './App3DShowcase';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { addItem } = useCart();
  const { config: businessConfig } = useBusinessConfig();
  const [searchParams] = useSearchParams();
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<{id: string, title: string, sub: string, img: string, category?: string}[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isMapViewOnly, setIsMapViewOnly] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
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
  const [isSeeding, setIsSeeding] = useState(false);

  const seedDemoStoresAndProducts = async () => {
    setIsSeeding(true);
    try {
      const baseLat = location.lat || -6.7924;
      const baseLng = location.lng || 39.2083;

      const demoVendorsList = [
        {
          ownerUid: "admin",
          businessName: "Lulu Grocery & Store",
          category: "grocery" as const,
          description: "Fresh vegetables and daily essentials.",
          tin: "123-456-789",
          address: "Ubungo, Dar es Salaam",
          location: { lat: baseLat + 0.0012, lng: baseLng - 0.0008 },
          deliveryRadius: 10,
          status: "active" as const,
          rating: 4.9,
          ratingCount: 142,
          logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
          operatingHours: "08:00 - 22:00",
          createdAt: serverTimestamp()
        },
        {
          ownerUid: "admin",
          businessName: "Papo Hapo Pizza",
          category: "restaurant" as const,
          description: "Best Italian pizza in town.",
          tin: "987-654-321",
          address: "Kibo Area, DSM",
          location: { lat: baseLat - 0.0025, lng: baseLng + 0.0018 },
          deliveryRadius: 8,
          status: "active" as const,
          rating: 4.7,
          ratingCount: 89,
          logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
          operatingHours: "10:00 - 23:00",
          createdAt: serverTimestamp()
        },
        {
          ownerUid: "admin",
          businessName: "Kibo Medical Pharmacy",
          category: "pharmacy" as const,
          description: "Your health, our priority.",
          tin: "456-789-123",
          address: "Mikocheni, Dar es Salaam",
          location: { lat: baseLat + 0.0034, lng: baseLng + 0.0042 },
          deliveryRadius: 5,
          status: "active" as const,
          rating: 4.8,
          ratingCount: 65,
          logoUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=800&q=80",
          operatingHours: "24 Hours",
          createdAt: serverTimestamp()
        },
        {
          ownerUid: "admin",
          businessName: "Urembo Salon & Spa",
          category: "salon" as const,
          description: "Affordable luxury beauty treatments & hair style.",
          tin: "321-654-987",
          address: "Sinza, DSM",
          location: { lat: baseLat - 0.0008, lng: baseLng - 0.0032 },
          deliveryRadius: 6,
          status: "active" as const,
          rating: 4.6,
          ratingCount: 47,
          logoUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
          operatingHours: "09:00 - 21:00",
          createdAt: serverTimestamp()
        }
      ];

      // Fetch existing vendors to prevent duplicate seeding
      const existingSnap = await getDocs(collection(db, 'vendors'));
      const existingNames = new Set(existingSnap.docs.map(doc => doc.data().businessName?.trim().toLowerCase()));

      let createdCount = 0;
      for (const v of demoVendorsList) {
        if (existingNames.has(v.businessName.trim().toLowerCase())) {
          console.log(`Duka "${v.businessName}" tayari lipo. Skipping duplicate seed.`);
          continue;
        }

        const vendorDocRef = await addDoc(collection(db, 'vendors'), v);
        const vId = vendorDocRef.id;
        createdCount++;

        // Add corresponding products
        let demoProducts: any[] = [];
        if (v.category === 'grocery') {
          demoProducts = [
            {
              vendorId: vId,
              name: "Nyanya Safi (Organic Tomatoes)",
              description: "Kilo 1 ya nyanya mbichi na safi zilizovunwa asubuhi ya leo kutoka shambani.",
              price: 3500,
              category: "mboga",
              stock: 50,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop",
              vendorCategory: "grocery"
            },
            {
              vendorId: vId,
              name: "Tofaha Nyekundu (Sweet Apples)",
              description: "Mfuko wa kilo 1 wa matofaha nyekundu matamu, yenye afya na crispy sana.",
              price: 5000,
              category: "matunda",
              stock: 35,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop",
              vendorCategory: "grocery"
            },
            {
              vendorId: vId,
              name: "Mchele Bora wa Basmati (Premium Rice)",
              description: "Kilo 1 ya mchele safi kabisa wa daraja la kwanza kutoka Kyela, wenye harufu na ladha nzuri.",
              price: 4500,
              category: "nafaka",
              stock: 120,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop",
              vendorCategory: "grocery"
            }
          ];
        } else if (v.category === 'restaurant') {
          demoProducts = [
            {
              vendorId: vId,
              name: "Pizza ya Kuku (BBQ Chicken Pizza)",
              description: "Pizza kubwa yenye vipande vya kuku mtamu wa choma, sosi ya BBQ na jibini ya ziada.",
              price: 15000,
              category: "pizza",
              stock: 100,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop",
              vendorCategory: "restaurant"
            },
            {
              vendorId: vId,
              name: "Burger ya Ng'ombe (Double Beef Burger)",
              description: "Burger mbili tamu za nyama ya ng'ombe zenye jibini, saladi na sosi maalum ya Papo Hapo.",
              price: 10000,
              category: "burger",
              stock: 80,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop",
              vendorCategory: "restaurant"
            },
            {
              vendorId: vId,
              name: "Viazi vya Kukaanga (Crispy French Fries)",
              description: "Viazi vitamu vya mbatata vilivyokaangwa kwa usahihi wa kipekee, crispy kwa nje na laini kwa ndani.",
              price: 3500,
              category: "vileo",
              stock: 200,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop",
              vendorCategory: "restaurant"
            }
          ];
        } else if (v.category === 'pharmacy') {
          demoProducts = [
            {
              vendorId: vId,
              name: "Vidonge vya Vitamin C (Chewable Tablets)",
              description: "Vidonge 30 vya kutafuna vya Vitamin C vya nguvu ya 500mg, nzuri kwa kuongeza kinga ya mwili.",
              price: 8500,
              category: "vitamini",
              stock: 45,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop",
              vendorCategory: "pharmacy"
            },
            {
              vendorId: vId,
              name: "Huduma ya Kwanza (First Aid Kit)",
              description: "Mfuko mzima wa dharura wenye bandeji, pamba, dawa ya kusafisha vidonda na mkasi.",
              price: 25000,
              category: "vifaa",
              stock: 15,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1607619056574-7b8f304f3c6f?w=600&auto=format&fit=crop",
              vendorCategory: "pharmacy"
            }
          ];
        } else if (v.category === 'salon') {
          demoProducts = [
            {
              vendorId: vId,
              name: "Kukata Nywele & Scrub (Executive Haircut)",
              description: "Huduma ya kisasa ya kunyoa nywele, kusafisha uso kwa scrub maalum na kupaka mafuta laini.",
              price: 12000,
              category: "kunyoa",
              stock: 99,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop",
              vendorCategory: "salon"
            },
            {
              vendorId: vId,
              name: "Kusuka Nywele (Natural Braiding)",
              description: "Kusuka nywele katika mitindo mbalimbali kama rasta au weaving, kwa kutumia rasta safi.",
              price: 20000,
              category: "kusuka",
              stock: 99,
              status: "active",
              imageUrl: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&auto=format&fit=crop",
              vendorCategory: "salon"
            }
          ];
        }

        for (const p of demoProducts) {
          await addDoc(collection(db, 'products'), p);
        }
      }

      if (createdCount > 0) {
        toast.success(`🎉 ${createdCount} Maduka na bidhaa za mfano zimesakinishwa kikamilifu karibu nawe!`);
      } else {
        toast.info("Zote zilikuwa tayari zimeundwa! / All stores already exist.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Imefeli kusakinisha maduka ya mfano.");
    } finally {
      setIsSeeding(false);
    }
  };

  const [maintenanceService, setMaintenanceService] = useState<{ id: string; name: string; message: string } | null>(null);

  const storeScrollRef = useRef<HTMLDivElement>(null);
  const bannerScrollRef = useRef<HTMLDivElement>(null);

  // QR Scan / AR Deep-linking
  useEffect(() => {
    const arVendorId = searchParams.get('ar_vendor_id') || searchParams.get('scan_qr');
    const arRouteId = searchParams.get('ar_route_id');
    if (arRouteId) {
      setSelectedRouteId(arRouteId);
    }
    if (arVendorId || arRouteId) {
      if (arVendorId) {
        setSelectedVendorId(arVendorId);
      }
      setIsMapViewOnly(true);
      setIsLocationPickerOpen(true);
    }
  }, [searchParams]);

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
          if (error.code !== 1) {
            console.warn("Geolocation warning/error:", error.message || "Unknown error", error.code);
          }
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
      setActiveBannerIdx((prev) => (prev + 1) % banners.length);
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

  const filteredVendors = vendors.filter(v => {
    // Filter out vendors of hidden services
    if (v.category) {
      const categoryToServiceId: Record<string, string> = {
        hotel: 'hoteli',
        restaurant: 'chakula',
        grocery: 'sokoni',
        pharmacy: 'dawa',
        ecommerce: 'maduka',
        salon: 'saluni',
        bus_ticket: 'bus_ticket',
        car_rental: 'car_rental',
        car_sale: 'car_sale',
        taxi: 'teksi',
        parcel: 'vifurushi'
      };
      const serviceId = categoryToServiceId[v.category] || v.category;
      const sState = (businessConfig?.services || {})[serviceId];
      if (sState && sState.enabled === false) {
        return false;
      }
    }

    return v.businessName.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(effectiveSearchQuery.toLowerCase());
  });

  const filteredProducts = products.filter(p => {
    const vendor = vendors.find(v => v.id === p.vendorId);
    if (vendor && vendor.hideProducts === true) {
      return false;
    }

    // Filter out products of hidden services
    const serviceCategory = vendor?.category || p.vendorCategory || p.category;
    if (serviceCategory) {
      const categoryToServiceId: Record<string, string> = {
        hotel: 'hoteli',
        restaurant: 'chakula',
        grocery: 'sokoni',
        pharmacy: 'dawa',
        ecommerce: 'maduka',
        salon: 'saluni',
        bus_ticket: 'bus_ticket',
        car_rental: 'car_rental',
        car_sale: 'car_sale',
        taxi: 'teksi',
        parcel: 'vifurushi'
      };
      const serviceId = categoryToServiceId[serviceCategory] || serviceCategory;
      const sState = (businessConfig?.services || {})[serviceId];
      if (sState) {
        if (sState.enabled === false) {
          return false;
        }
        if (sState.maintenance === true && sState.hideProductsDuringMaintenance === true) {
          return false;
        }
      }
    }

    return p.name.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
           p.description?.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
           p.category?.toLowerCase().includes(effectiveSearchQuery.toLowerCase());
  });

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
              const contentType = response.headers.get("content-type");
              if (!response.ok || !contentType || !contentType.includes("application/json")) {
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
    { id: 'teksi', label: 'PapoRide', icon: Car, color: 'bg-yellow-500', sub: 'Agiza gari, boda au bajaji 🚕', category: 'taxi', badge: 'ONLY1K' },
    { id: 'chakula', label: 'PapoFood', icon: Utensils, color: 'bg-red-500', sub: 'Chakula kutoka migahawa 🍔', category: 'restaurant', badge: 'ONLY1K' },
    { id: 'sokoni', label: 'PapoMart', icon: ShoppingCart, color: 'bg-green-500', sub: 'Nunua bidhaa za sokoni 🛒', category: 'grocery', badge: 'ONLY1K' },
    { id: 'vifurushi', label: 'PapoSend', icon: Package, color: 'bg-orange-500', sub: 'Tuma vifurushi 📦', category: 'parcel', badge: 'ONLY1K' },
    { id: 'dawa', label: 'PapoMed', icon: Pill, color: 'bg-blue-500', sub: 'Dawa na huduma za afya 💊', category: 'pharmacy', badge: 'ONLY1K' },
    { id: 'saluni', label: 'PapoStyle', icon: Scissors, color: 'bg-pink-500', sub: 'Saluni na beauty services 💇', category: 'salon', badge: 'ONLY1K' },
    { id: 'fundi', label: 'PapoFix', icon: Wrench, color: 'bg-amber-600', sub: 'Home Services, Mafundi na Booking 🛠️', category: 'handyman', badge: 'BOOKING' },
    { id: 'hoteli', label: 'PapoStay', icon: Hotel, color: 'bg-indigo-500', sub: 'Booking hoteli, nyumba na malazi 🏨', category: 'hotel', badge: 'ONLY6K' },
    { id: 'bus_ticket', label: 'PapoBus', icon: Bus, color: 'bg-orange-600', sub: 'Tiketi za mabasi 🚌', category: 'bus_ticket', badge: 'ONLY6K' },
    { id: 'car_rental', label: 'PapoRent', icon: Key, color: 'bg-teal-600', sub: 'Rental ya magari 🚘', category: 'taxi', badge: 'ONLY6K' },
    { id: 'maduka', label: 'PapoMall', icon: ShoppingBag, color: 'bg-purple-500', sub: 'Soko la mtandaoni 🛍️', category: 'ecommerce' },
    { id: 'ramani', label: 'PapoMap', icon: MapPin, color: 'bg-neutral-600', sub: 'Ramani ya karibu 📍', category: 'all' },
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
        const productsList = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        const servicesState = businessConfig?.services || {};
        const activeProducts = productsList.filter(p => {
          if (p.hidden === true) return false;
          // Map product category to service ID
          const categoryToServiceId: Record<string, string> = {
            hotel: 'hoteli',
            restaurant: 'chakula',
            grocery: 'sokoni',
            pharmacy: 'dawa',
            ecommerce: 'maduka',
            salon: 'saluni',
            handyman: 'fundi',
            home_services: 'fundi',
            bus_ticket: 'bus_ticket',
            car_rental: 'car_rental',
            car_sale: 'car_sale'
          };
          const serviceId = categoryToServiceId[p.vendorCategory || ''] || p.vendorCategory || '';
          const sState = servicesState[serviceId];
          if (sState?.maintenance === true && sState?.hideProductsDuringMaintenance === true) {
            return false;
          }
          return true;
        });
        setProducts(activeProducts);

        const bannersRef = collection(db, 'banners');
        const bSnap = await getDocs(query(bannersRef, where('active', '==', true)));
        const fetchedBanners = bSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Use custom time-of-day dynamic banners for rich and personalized Swahili experiences
        const currentHour = new Date().getHours();
        let defaultTimeBanners = [];
        if (currentHour >= 5 && currentHour < 12) {
          // Asubuhi: Breakfast, fresh groceries, morning rides
          defaultTimeBanners = [
            { id: 'm1', title: 'Vitafunwa & Chai Moto 🍳', sub: 'Muda wa Chai! Agiza kifungua kinywa safi sasa hivi na ujaze nguvu.', img: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=2070&auto=format&fit=crop', category: 'restaurant' },
            { id: 'm2', title: 'Safari za Asubuhi Haraka 🚕', sub: 'Saa za kazi! Usichelewe, agiza taksi yako ya kuaminika sasa.', img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2070&auto=format&fit=crop', category: 'taxi' },
            { id: 'm3', title: 'Sokoni Mapema Asubuhi 🛒', sub: 'Gundua mboga na matunda mapya kabisa yaliyofika asubuhi ya leo!', img: 'https://images.unsplash.com/photo-1488459718432-36af5016d6da?q=80&w=2070&auto=format&fit=crop', category: 'grocery' }
          ];
        } else if (currentHour >= 12 && currentHour < 17) {
          // Mchana: Lunch, parcel, hair salon/service
          defaultTimeBanners = [
            { id: 'a1', title: 'Chakula cha Mchana Moto 🍲', sub: 'Njaa ya mchana? Ofa ya chakula kitamu cha mchana na punguzo la 15%!', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop', category: 'restaurant' },
            { id: 'a2', title: 'Umetulia? Letewe Sokoni 📦', sub: 'Vifurushi na mizigo ya mchana inatufikia kwa haraka sasa hivi.', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop', category: 'parcel' },
            { id: 'a3', title: 'Huduma Safi za Saluni 💇‍♀️', sub: 'Urembo na kunyoa mchana huu. Weka miadi yako na saluni maarufu.', img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=2074&auto=format&fit=crop', category: 'salon' }
          ];
        } else {
          // Jioni/Usiku: Dinner, safe late-night ride, urgent pharmacy
          defaultTimeBanners = [
            { id: 'e1', title: 'Chakula cha Jioni Kitamu 🍕', sub: 'Tulia baada ya kazi na uagize chakula cha jioni kizuri cha usiku!', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=2070&auto=format&fit=crop', category: 'restaurant' },
            { id: 'e2', title: 'Safari Salama ya Usiku 🚕', sub: 'Rudi nyumbani salama na madereva wetu wa usiku waliohakikiwa.', img: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=2049&auto=format&fit=crop', category: 'taxi' },
            { id: 'e3', title: 'Duka la Dawa la Dharura 💊', sub: 'Dawa zako hapa usiku kucha. Huduma ipo wazi saa 24 kwa ajili yako.', img: 'https://images.unsplash.com/photo-1587854692152-cbe660dbbb88?q=80&w=2069&auto=format&fit=crop', category: 'pharmacy' }
          ];
        }

        if (fetchedBanners.length === 0) {
          setBanners(defaultTimeBanners);
        } else {
          setBanners([...fetchedBanners, ...defaultTimeBanners]);
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
    <div className={`pb-10 space-y-2 md:space-y-3 lg:space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="px-1 pt-1">
         <div className="flex items-center justify-between mb-2 px-2">
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
          setSelectedRouteId(null);
        }}
        onSelect={handleLocationSelect}
        initialLocation={location}
        vendors={vendors}
        preSelectedVendorId={selectedVendorId}
        isMapViewOnly={isMapViewOnly}
        arRouteId={selectedRouteId}
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

      {/* 1. Promotional 3D Coverflow Carousel (Banners) */}
      <div className="relative w-full overflow-hidden py-3 select-none flex flex-col items-center gap-4">
        {isLoading ? (
          <div className="w-full flex gap-4 overflow-x-auto pb-3 no-scrollbar px-2 justify-center">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={`banner-skele-${i}`} className="w-[82%] sm:w-[75%] md:w-[60%] lg:w-[45%] h-56 md:h-80 rounded-[2rem]" />
            ))}
          </div>
        ) : banners.length === 0 ? null : (
          <>
            {/* The 3D Slider Container */}
            <div 
              ref={bannerScrollRef}
              className="relative w-full h-[220px] xs:h-[240px] sm:h-[300px] md:h-[360px] flex items-center justify-center overflow-hidden"
              style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
            >
              {banners.map((banner, idx) => {
                if (!banner.img) return null;

                // Calculate circular offset
                const count = banners.length;
                let diff = idx - activeBannerIdx;
                if (diff < -count / 2) diff += count;
                if (diff > count / 2) diff -= count;

                const isActive = diff === 0;
                const isLeft = diff === -1;
                const isRight = diff === 1;

                // Absolute positions with 3D transforms based on diff
                let rotateYVal = 0;
                let xOffset = "0%";
                let scaleVal = 1;
                let zIndexVal = 10;
                let opacityVal = 1;

                if (isActive) {
                  rotateYVal = 0;
                  xOffset = "0%";
                  scaleVal = 1.0;
                  zIndexVal = 30;
                  opacityVal = 1;
                } else if (isLeft) {
                  rotateYVal = 26; // Tilted back on the left
                  xOffset = "-45%"; // Peeking left
                  scaleVal = 0.82;
                  zIndexVal = 20;
                  opacityVal = 0.65;
                } else if (isRight) {
                  rotateYVal = -26; // Tilted back on the right
                  xOffset = "45%"; // Peeking right
                  scaleVal = 0.82;
                  zIndexVal = 20;
                  opacityVal = 0.65;
                } else {
                  // Far away items
                  rotateYVal = diff < 0 ? 35 : -35;
                  xOffset = diff < 0 ? "-110%" : "110%";
                  scaleVal = 0.65;
                  zIndexVal = 10;
                  opacityVal = 0;
                }

                return (
                  <motion.div
                    key={`promo-banner-${banner.id || idx}`}
                    style={{
                      transformStyle: 'preserve-3d',
                      backfaceVisibility: 'hidden',
                      zIndex: zIndexVal,
                    }}
                    animate={{
                      x: xOffset,
                      scale: scaleVal,
                      rotateY: rotateYVal,
                      opacity: opacityVal,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 28,
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.4}
                    onDragEnd={(e, info) => {
                      const swipeThreshold = 50;
                      if (info.offset.x < -swipeThreshold) {
                        // Dragged left -> show next
                        setActiveBannerIdx((prev) => (prev + 1) % banners.length);
                      } else if (info.offset.x > swipeThreshold) {
                        // Dragged right -> show prev
                        setActiveBannerIdx((prev) => (prev - 1 + banners.length) % banners.length);
                      }
                    }}
                    onClick={() => {
                      if (isActive) {
                        if (banner.category) {
                          setSelectedCategory(banner.category);
                          setTimeout(() => {
                            storeScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 100);
                          toast.info(`Inatafuta maduka ya: ${banner.category.toUpperCase()} 🛒✨`);
                        }
                      } else {
                        setActiveBannerIdx(idx);
                      }
                    }}
                    className="absolute w-[82%] sm:w-[75%] md:w-[60%] lg:w-[45%] h-full rounded-[2rem] overflow-hidden shadow-2xl group cursor-pointer border border-white/20 select-none bg-neutral-950 origin-center"
                  >
                    {/* Background Image */}
                    <img 
                      src={banner.img} 
                      alt={banner.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out pointer-events-none" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />

                    {/* Dark overlay for ambient background cards to draw focus to center */}
                    {!isActive && (
                      <div className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[0.5px] transition-all duration-300 group-hover:bg-neutral-950/30" />
                    )}

                    {/* Content Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent flex flex-col justify-end p-5 sm:p-8 md:p-10 text-white">
                      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/15">
                         <Sparkles className="w-3 h-3 text-orange-400" />
                         <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest">Ofa Maalum</span>
                      </div>
                      
                      <motion.h3 
                        initial={{ y: 15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight font-display mb-0.5 sm:mb-1 leading-tight text-white drop-shadow-md"
                      >
                        {banner.title}
                      </motion.h3>
                      
                      <p className="text-[10px] sm:text-sm opacity-90 font-medium leading-relaxed max-w-[240px] drop-shadow-sm line-clamp-2">
                        {banner.sub}
                      </p>
                      
                      {isActive && (
                        <motion.div 
                          whileHover={{ x: 5 }}
                          className="mt-3 sm:mt-5 flex items-center gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-orange-400"
                        >
                          <span>{t('order_now') || 'Agiza Sasa'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination Indicators (Dots) */}
            <div className="flex gap-1.5 items-center justify-center mt-1">
              {banners.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  onClick={() => setActiveBannerIdx(i)}
                  className={`transition-all duration-500 ease-out h-2 rounded-full ${
                    i === activeBannerIdx 
                      ? 'w-6 bg-orange-600 shadow-md shadow-orange-600/30 dark:bg-orange-500' 
                      : 'w-2 bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                  }`}
                  aria-label={`Nenda kwenye bango la ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3D App Showcase Animation Section */}
      <App3DShowcase />

      <section className="mt-1 md:mt-2">
        <div className="flex items-center justify-between mb-2.5 px-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg md:text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">
               {t('nearby_stores') || 'Nearby Stores'} 
               <span className="text-orange-600 ml-2">📍</span>
            </h3>
            <div className="h-1 w-10 md:w-16 bg-orange-600 rounded-full" />
          </div>
        </div>
        
        {/* Category Filters for Nearby Stores */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              selectedCategory === null ? 'bg-orange-600 text-white shadow-lg' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            Yote (All)
          </button>
          {services
            .filter(s => {
              if (s.id === 'ramani') return false;
              const sState = (businessConfig?.services || {})[s.id];
              if (s.id === 'bus_ticket') {
                return sState?.enabled === true;
              }
              return !sState || sState.enabled !== false;
            })
            .map((s) => (
            <button
              key={`filter-${s.id}`}
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
          className="flex flex-nowrap overflow-x-auto gap-4 sm:gap-6 md:gap-8 pb-2 no-scrollbar -mx-4 px-4 snap-x snap-mandatory"
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
                    src={vendor.arImageUrl || vendor.bannerUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80'} 
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
            <div className="w-full py-12 px-6 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-[2.5rem] border border-dashed border-neutral-200/80 dark:border-neutral-800 mx-4 flex flex-col items-center justify-center gap-4">
              <div>
                <p className="text-neutral-400 text-sm font-bold">Hakuna maduka yaliyosajiliwa karibu nawe.</p>
                <p className="text-neutral-500 text-xs mt-1">Database haina maduka ya majaribio bado.</p>
              </div>
              <button
                onClick={seedDemoStoresAndProducts}
                disabled={isSeeding}
                className="bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-black text-[10px] sm:text-[11px] uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg shadow-orange-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSeeding ? (
                  <>
                    <span className="animate-spin inline-block">🔄</span>
                    Inasakinisha...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    Sakinisha Maduka & Bidhaa za Mfano
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="px-2 mt-1 md:mt-2">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter font-display leading-none">
               {t('explore_services') || 'Explore Services'}
            </h3>
            <div className="h-1 w-10 md:w-16 bg-orange-600 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 [@media(min-width:1800px)]:grid-cols-16 gap-3 md:gap-8 lg:gap-10">
          {services
            .filter((s) => {
              const sState = (businessConfig?.services || {})[s.id];
              if (s.id === 'bus_ticket') {
                return sState?.enabled === true;
              }
              return !sState || sState.enabled !== false;
            })
            .map((service, idx) => {
              const sState = (businessConfig?.services || {})[service.id];
              const isUnderMaintenance = sState?.maintenance === true;
              const maintenanceMsg = sState?.message || `Huduma ya ${service.label} ipo kwenye matengenezo kwa sasa.`;

              const handleServiceClick = (e: React.MouseEvent) => {
                if (isUnderMaintenance) {
                  e.preventDefault();
                  setMaintenanceService({
                    id: service.id,
                    name: service.label,
                    message: maintenanceMsg,
                  });
                }
              };

              return (
                <motion.div
                  key={service.id || idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * idx, type: "spring", bounce: 0.4 }}
                >
                  {service.id === 'ramani' ? (
                    <button 
                      onClick={(e) => {
                        if (isUnderMaintenance) {
                          handleServiceClick(e);
                        } else {
                          setIsMapViewOnly(true);
                          setIsLocationPickerOpen(true);
                        }
                      }}
                      className="flex flex-col items-center text-center group w-full gap-3 relative cursor-pointer"
                    >
                      <div className="relative">
                        <motion.div 
                          whileHover={{ y: -10, rotate: 5 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-16 h-16 md:w-22 md:h-22 rounded-[1.75rem] flex items-center justify-center text-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] group-hover:shadow-orange-600/30 transition-all duration-500 overflow-hidden relative ${service.color}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                          <service.icon className="w-7 h-7 md:w-9 md:h-9 relative z-10" />
                          {isUnderMaintenance && (
                            <div className="absolute inset-0 bg-neutral-900/75 backdrop-blur-[1.5px] flex flex-col items-center justify-center z-20">
                              <Wrench className="w-5 h-5 text-amber-400 animate-bounce" />
                              <span className="text-[6.5px] font-black uppercase text-amber-400 select-none tracking-tighter mt-0.5">Wrench</span>
                            </div>
                          )}
                        </motion.div>
                        {service.badge && (
                          <span className={`absolute -top-2 -right-3 z-30 font-black text-[7.5px] md:text-[9.5px] px-1.5 py-0.5 rounded-full text-white shadow-[0_4px_10px_rgba(0,0,0,0.2)] select-none tracking-tight uppercase border-2 border-white dark:border-neutral-900 leading-none ${
                            service.badge === 'ONLY1K' 
                              ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-bounce' 
                              : 'bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse'
                          }`}>
                            {service.badge}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-neutral-600 leading-tight block w-full truncate relative">
                        {service.label}
                        {isUnderMaintenance && <span className="absolute -top-1 right-0 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />}
                      </span>
                    </button>
                  ) : (
                    <Link 
                      to={isUnderMaintenance ? '#' : (service.id === 'teksi' ? '/taxi' : service.id === 'car_rental' ? '/car-rental' : service.id === 'vifurushi' ? '/service/vifurushi' : `/service/${service.id}`)}
                      onClick={handleServiceClick}
                      className="flex flex-col items-center text-center group gap-3 relative"
                    >
                      <div className="relative">
                        <motion.div 
                          whileHover={{ y: -10, rotate: -5 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-16 h-16 md:w-22 md:h-22 rounded-[1.75rem] flex items-center justify-center text-white shadow-[0_15px_35px_rgba(0,0,0,0.1)] group-hover:shadow-orange-600/30 transition-all duration-500 overflow-hidden relative ${service.color}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                          <service.icon className="w-7 h-7 md:w-9 md:h-9 relative z-10" />
                          {isUnderMaintenance && (
                            <div className="absolute inset-0 bg-neutral-900/75 backdrop-blur-[1.5px] flex flex-col items-center justify-center z-20">
                              <Wrench className="w-5 h-5 text-amber-400 animate-bounce" />
                              <span className="text-[6.5px] font-black uppercase text-amber-400 select-none tracking-tighter mt-0.5">Wrench</span>
                            </div>
                          )}
                        </motion.div>
                        {service.badge && (
                          <span className={`absolute -top-2 -right-3 z-30 font-black text-[7.5px] md:text-[9.5px] px-1.5 py-0.5 rounded-full text-white shadow-[0_4px_10px_rgba(0,0,0,0.2)] select-none tracking-tight uppercase border-2 border-white dark:border-neutral-900 leading-none ${
                            service.badge === 'ONLY1K' 
                              ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-bounce' 
                              : 'bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse'
                          }`}>
                            {service.badge}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-neutral-600 leading-tight block w-full truncate relative">
                        {service.label}
                        {isUnderMaintenance && <span className="absolute -top-1 right-0 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />}
                      </span>
                    </Link>
                  )}
                </motion.div>
              );
            })}
        </div>
      </section>

      {/* 4. Bidhaa Maarufu (Popular Products) */}
      <section className="px-2 mt-1 md:mt-2">
        <div className="flex items-center justify-between mb-2">
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
              
              const rawOrigin = (product as any).origin || 'Dar';
              const rawDestination = (product as any).destination || 'Mwanza';

              const getStationCode = (city: string) => {
                if (!city) return '???';
                const c = city.trim().toUpperCase();
                if (c.includes('DAR')) return 'DAR';
                if (c.includes('MWANZA')) return 'MWZ';
                if (c.includes('SHINYANGA')) return 'SHY';
                if (c.includes('ARUSHA')) return 'ARU';
                if (c.includes('DODOMA')) return 'DOM';
                if (c.includes('MOSHI')) return 'MSH';
                if (c.includes('MBEYA')) return 'MBY';
                if (c.includes('MOROGORO')) return 'MRG';
                if (c.includes('KIGOMA')) return 'KIG';
                if (c.includes('MTWARA')) return 'MTW';
                if (c.includes('TANGA')) return 'TGA';
                if (c.includes('IRINGA')) return 'IRG';
                if (c.includes('TABORA')) return 'TBR';
                if (c.includes('SINGIDA')) return 'SGD';
                if (c.includes('BUKOBA')) return 'BKU';
                if (c.includes('MUSOMA')) return 'MSM';
                if (c.includes('SONGEA')) return 'SNG';
                if (c.includes('LINDI')) return 'LND';
                if (c.includes('SUMBAWANGA')) return 'SBY';
                return c.substring(0, 3);
              };

              const originCode = getStationCode(rawOrigin);
              const destinationCode = getStationCode(rawDestination);

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
                    to={isBusTicket ? `/product/${product.id}?booking=true` : `/product/${product.id}`}
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
                                <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white" title={rawOrigin}>{originCode}</span>
                                <div className="flex-1 border-t-2 border-dashed border-indigo-400/40 relative flex justify-center items-center">
                                  <Bus className="w-5 h-5 text-emerald-400 absolute bg-indigo-900 rounded-full p-1 border border-indigo-700" />
                                </div>
                                <span className="text-xs md:text-sm font-black uppercase tracking-wider text-white" title={rawDestination}>{destinationCode}</span>
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-indigo-200 font-black mt-2 text-center truncate max-w-full px-1">
                                {rawOrigin} {rawOrigin && rawDestination ? '→' : ''} {rawDestination}
                              </span>
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
          {filteredProducts.length === 0 && (
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

      {/* Maintenance alert modal */}
      <AnimatePresence>
        {maintenanceService && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop wrapper */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMaintenanceService(null)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
            />

            {/* Modal Body card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-md bg-[#0F0F1A] border border-amber-500/30 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] z-10"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-6 select-none">
                {/* Wrench Animated Warning Icon */}
                <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 relative">
                  <div className="absolute inset-0 rounded-full bg-amber-500/5 animate-ping" />
                  <Wrench className="w-10 h-10 animate-pulse relative z-10" />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/20">
                    HAKUNA HUDUMA KWA SASA 🚨
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-tight italic font-display pt-2">
                    {maintenanceService.name}
                  </h3>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none pt-1">
                    Huduma ipo Kwenye Matengenezo
                  </p>
                </div>

                {/* Swahili Main Alert Message */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 text-sm font-semibold text-neutral-200 leading-relaxed text-center">
                  {maintenanceService.message}
                </div>

                <div className="text-[10px] text-neutral-500 font-bold leading-normal">
                  Tunafanya maboresho makubwa ili kuongeza ubora wa huduma hii kwa ajili yako. Tafadhali jaribu baadaye kidogo!
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => setMaintenanceService(null)}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-900/10 hover:shadow-amber-500/20 transition-all text-xs cursor-pointer"
                >
                  SAWA / NIMEFAHAMU
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
