import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Car, Key, Star, Calendar, Clock, Upload, ShieldCheck, Check, ChevronLeft, 
  ChevronRight, Heart, Search, MessageSquare, Phone, MapPin, Tag, CheckCircle2,
  Trash2, ThumbsUp, MapPin as MapPinIcon, RefreshCw, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../LanguageContext';
import { toast } from 'sonner';

// Define TS Interfaces
interface CarRentalItem {
  id: string;
  name: string;
  brand: string;
  type: 'suv' | 'hatchback' | 'wedding' | 'safari';
  image: string;
  pricePerDay: number;
  transmission: string;
  fuel: string;
  seats: number;
  rating: number;
  engine: string;
  ac: boolean;
  carNumber: string;
  about: string;
  features: string[];
  gallery: string[];
}

interface CarSaleItem {
  id: string;
  name: string;
  brand: string;
  year: number;
  mileage: number;
  fuel: string;
  price: number;
  image: string;
  transmission: string;
  seats: number;
  about: string;
}

// Sample Rental Cars (High Fidelity matching screenshots)
const RENTAL_CARS: CarRentalItem[] = [
  {
    id: 'rent-rav4',
    name: 'Toyota RAV4',
    brand: 'Toyota',
    type: 'suv',
    image: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 120000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    seats: 5,
    rating: 4.8,
    engine: '2000 cc',
    ac: true,
    carNumber: 'T 192 DHG',
    about: 'The Toyota RAV4 is a sleek, spacious and versatile SUV. Perfect for cruising through Dar es Salaam or climbing up to Arusha, offering high comfort and fuel efficiency.',
    features: ['Bluetooth connectivity', 'Air Conditioning', 'Power Windows', 'Power steering', 'Keyless Entry', 'Air Freshener'],
    gallery: [
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80'
    ]
  },
  {
    id: 'rent-prado',
    name: 'Toyota Prado TXL',
    brand: 'Toyota',
    type: 'suv',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 250000,
    transmission: 'Automatic',
    fuel: 'Diesel',
    seats: 7,
    rating: 4.9,
    engine: '3000 cc',
    ac: true,
    carNumber: 'T 441 DJK',
    about: 'A heavy-duty premium SUV built for rugged terrain and luxurious highway travel. Features 4WD active support, spacious leather seating, and advanced climate control.',
    features: ['Cool Box fridge', 'Leather Seats', 'Active 4WD', 'Air Conditioning', 'Cruise Control', 'Keyless Entry'],
    gallery: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80'
    ]
  },
  {
    id: 'rent-allion',
    name: 'Toyota Allion',
    brand: 'Toyota',
    type: 'hatchback',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 80000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    seats: 5,
    rating: 4.5,
    engine: '1500 cc',
    ac: true,
    carNumber: 'T 732 DFA',
    about: 'An incredibly comfortable and fuel-economic sedan. Best suited for daily city rounds, executive commute, or quick family trips.',
    features: ['Bluetooth connectivity', 'Air Conditioning', 'Power steering', 'Aux Cable', 'Keyless Entry'],
    gallery: [
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80'
    ]
  },
  {
    id: 'rent-swift',
    name: 'Suzuki Swift',
    brand: 'Suzuki',
    type: 'hatchback',
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 60000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    seats: 5,
    rating: 4.6,
    engine: '1200 cc',
    ac: true,
    carNumber: 'T 889 DHY',
    about: 'A pocket-friendly compact hatchback ideal for tight parking spots, narrow city roads, and ultra-high fuel efficiency. Light steering and modern interior dashboard.',
    features: ['Air Conditioning', 'Power Windows', 'USB Port', 'Air Bags', 'ABS Braking'],
    gallery: [
      'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80'
    ]
  },
  // Wedding category
  {
    id: 'rent-mercedes',
    name: 'Mercedes S-Class',
    brand: 'Mercedes',
    type: 'wedding',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 450000,
    transmission: 'Automatic',
    fuel: 'Petrol',
    seats: 5,
    rating: 5.0,
    engine: '3000 cc',
    ac: true,
    carNumber: 'T 111 WED',
    about: 'The ultimate luxury statement. Make your wedding day unforgettable with this premium Mercedes S-Class decorated beautifully. Professional suited chauffeur included by default.',
    features: ['Chauffeur Service', 'Wedding Decoration', 'Champagne Cooler', 'Panoramic Sunroof', 'Ambient lighting', 'Burmester Sound'],
    gallery: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80'
    ]
  },
  {
    id: 'rent-rover',
    name: 'Range Rover Vogue',
    brand: 'Land Rover',
    type: 'wedding',
    image: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 600000,
    transmission: 'Automatic',
    fuel: 'Diesel',
    seats: 5,
    rating: 4.9,
    engine: '4400 cc',
    ac: true,
    carNumber: 'T 777 WED',
    about: 'Commanding road presence combined with royal status. Perfect for VIP arrivals, elite corporate functions, and glamorous weddings.',
    features: ['Chauffeur Service', 'Wedding Ribbon Decoration', 'Privacy Glass', 'Massaging Seats', 'Meridian Audio', 'Air Suspension'],
    gallery: [
      'https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=600&q=80'
    ]
  },
  // Safari & Tour Vehicles
  {
    id: 'rent-safari-cruiser',
    name: 'Toyota Land Cruiser Safari',
    brand: 'Toyota',
    type: 'safari',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    pricePerDay: 300000,
    transmission: 'Manual',
    fuel: 'Diesel',
    seats: 8,
    rating: 4.9,
    engine: '4200 cc',
    ac: true,
    carNumber: 'T 980 DJS',
    about: 'Custom built for Tanzanian National Parks. Features a pop-up roof for 360-degree game viewing, high ground clearance, heavy-duty suspension, dual fuel tanks, and two spare wheels.',
    features: ['Pop-up viewing roof', 'Built-in inverter', 'Fridge for beverages', 'Radio Communication', 'High Ground Clearance', 'Dual Spare Wheels'],
    gallery: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1469037561872-0247f0624060?auto=format&fit=crop&w=600&q=80'
    ]
  }
];

// Sample Cars for Sale (Matching screenshots exactly)
const SALE_CARS: CarSaleItem[] = [
  {
    id: 'sale-merc',
    name: 'Mercedes-Benz C200',
    brand: 'Mercedes',
    year: 2015,
    mileage: 45000,
    fuel: 'Petrol',
    price: 28000000,
    image: 'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80',
    transmission: 'Automatic',
    seats: 5,
    about: 'Very clean Mercedes C200 with low mileage. Regularly serviced, perfect engine, metallic black color with black premium leather interior. No accident history.'
  },
  {
    id: 'sale-harrier',
    name: 'Toyota Harrier',
    brand: 'Toyota',
    year: 2016,
    mileage: 60000,
    fuel: 'Petrol',
    price: 32000000,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    transmission: 'Automatic',
    seats: 5,
    about: 'Toyota Harrier (New Model) with premium silver finish, alloy rims, panoramic reverse camera, full sensory alerts, and luxurious interior workspace.'
  },
  {
    id: 'sale-prado',
    name: 'Land Cruiser Prado',
    brand: 'Toyota',
    year: 2017,
    mileage: 70000,
    fuel: 'Diesel',
    price: 65000000,
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    transmission: 'Automatic',
    seats: 7,
    about: 'Heavy-duty luxurious white Land Cruiser Prado. Features robust Diesel engine, leather seats, premium audio, steering buttons, and dual AC units.'
  },
  {
    id: 'sale-fit',
    name: 'Honda Fit',
    brand: 'Honda',
    year: 2014,
    mileage: 50000,
    fuel: 'Petrol',
    price: 16500000,
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=600&q=80',
    transmission: 'Automatic',
    seats: 5,
    about: 'Extremely economic silver Honda Fit. Compact, drives smooth, clean engine, ideal for daily business running and high savings on fuel.'
  }
];

export default function CarRental() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Navigation states
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'book' | 'summary' | 'verification' | 'active-booking'>('list');
  const [activeMode, setActiveMode] = useState<'rent' | 'buy'>('rent');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'suv' | 'hatchback' | 'wedding' | 'safari'>('all');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  
  // Selection States
  const [selectedCar, setSelectedCar] = useState<CarRentalItem | null>(null);
  const [selectedSaleCar, setSelectedSaleCar] = useState<CarSaleItem | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Tab states in detail
  const [detailTab, setDetailTab] = useState<'about' | 'feature' | 'gallery' | 'review'>('about');
  
  // Booking Form State
  const [bookWithDriver, setBookWithDriver] = useState(false);
  const [pickupDate, setPickupDate] = useState('2026-07-01');
  const [returnDate, setReturnDate] = useState('2026-07-08');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('17:00');
  
  // Pricing & Promo State
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponStatus, setCouponStatus] = useState<'none' | 'success' | 'invalid'>('none');
  
  // Upload States
  const [interiorImage, setInteriorImage] = useState<string | null>(null);
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState('');
  
  // Active Rent State
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userReview, setUserReview] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate rental cost
  const DRIVER_RATE = 35000; // TSh per day
  const TAX_RATE = 0.05; // 5%

  const calculateDays = () => {
    const d1 = new Date(pickupDate);
    const d2 = new Date(returnDate);
    const diff = d2.getTime() - d1.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? days : 1;
  };

  const getPriceBreakdown = () => {
    if (!selectedCar) return { base: 0, driver: 0, tax: 0, discount: 0, total: 0, days: 1 };
    const days = calculateDays();
    const base = selectedCar.pricePerDay * days;
    const driver = bookWithDriver ? DRIVER_RATE * days : 0;
    const preTaxTotal = base + driver;
    const discount = appliedDiscount;
    const tax = Math.round((preTaxTotal - discount) * TAX_RATE);
    const total = Math.max(0, preTaxTotal - discount + tax);
    return { base, driver, tax, discount, total, days };
  };

  // Check LocalStorage for active booking
  useEffect(() => {
    const stored = localStorage.getItem('tegex_active_car_rental');
    if (stored) {
      const parsed = JSON.parse(stored);
      setActiveBooking(parsed);
      // Find the car corresponding to it
      const matchedCar = RENTAL_CARS.find(c => c.id === parsed.carId);
      if (matchedCar) {
        setSelectedCar(matchedCar);
        setCurrentView('active-booking');
      }
    }
  }, []);

  const handleFavoriteToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(f => f !== id));
      toast.success(language === 'sw' ? 'Imeondolewa kwenye vipendwa' : 'Removed from favorites');
    } else {
      setFavorites([...favorites, id]);
      toast.success(language === 'sw' ? 'Imeongezwa kwenye vipendwa ❤️' : 'Added to favorites ❤️');
    }
  };

  const applyPromo = () => {
    if (couponCode.toUpperCase() === 'KARIBU') {
      const { base } = getPriceBreakdown();
      setAppliedDiscount(Math.round(base * 0.10)); // 10%
      setCouponStatus('success');
      toast.success(language === 'sw' ? 'Kuponi imekubaliwa! Punguzo la 10%' : 'Coupon applied! 10% discount');
    } else if (couponCode.toUpperCase() === 'TEGEX') {
      setAppliedDiscount(15000); // flat 15,000 TSh
      setCouponStatus('success');
      toast.success(language === 'sw' ? 'Kuponi imekubaliwa! Punguzo la TSh 15,000' : 'Coupon applied! TSh 15,000 discount');
    } else {
      setCouponStatus('invalid');
      setAppliedDiscount(0);
      toast.error(language === 'sw' ? 'Kuponi si sahihi' : 'Invalid coupon code');
    }
  };

  const removePromo = () => {
    setCouponCode('');
    setAppliedDiscount(0);
    setCouponStatus('none');
    toast.info(language === 'sw' ? 'Kuponi imeondolewa' : 'Coupon removed');
  };

  // Simulator for image uploads
  const triggerImageUpload = (type: 'interior' | 'license') => {
    const mockImages = [
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80'
    ];
    const chosen = mockImages[Math.floor(Math.random() * mockImages.length)];
    if (type === 'interior') {
      setInteriorImage(chosen);
      toast.success(language === 'sw' ? 'Picha ya gari imepakiwa!' : 'Car condition photo uploaded!');
    } else {
      setLicenseImage(chosen);
      setLicenseName('Driving_License_Tanzania.jpg');
      toast.success(language === 'sw' ? 'Kitambulisho/Leseni imepakiwa!' : 'License/ID proof uploaded!');
    }
  };

  const confirmBooking = () => {
    if (!selectedCar) return;
    const pricing = getPriceBreakdown();
    const bookingDetails = {
      id: 'BK-' + Math.floor(Math.random() * 90000 + 10000),
      carId: selectedCar.id,
      carName: selectedCar.name,
      carImage: selectedCar.image,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      withDriver: bookWithDriver,
      totalAmount: pricing.total,
      days: pricing.days,
      carNumber: selectedCar.carNumber,
      status: 'active'
    };

    localStorage.setItem('tegex_active_car_rental', JSON.stringify(bookingDetails));
    setActiveBooking(bookingDetails);
    toast.success(language === 'sw' ? 'Kukodi Kumethibitishwa! Gari liko tayari.' : 'Booking Confirmed! Car is ready.');
    setCurrentView('active-booking');
  };

  const endBooking = () => {
    setShowRatingModal(true);
  };

  const submitRating = () => {
    localStorage.removeItem('tegex_active_car_rental');
    setActiveBooking(null);
    setShowRatingModal(false);
    toast.success(language === 'sw' ? 'Asante kwa maoni yako! Karibu tena.' : 'Thank you for your feedback! Welcome back.');
    setCurrentView('list');
  };

  // Filter Logic
  const filteredRentCars = RENTAL_CARS.filter(car => {
    const matchesCategory = selectedCategory === 'all' || car.type === selectedCategory;
    const matchesBrand = !selectedBrand || car.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesSearch = car.name.toLowerCase().includes(searchQuery.toLowerCase()) || car.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesBrand && matchesSearch;
  });

  const filteredSaleCars = SALE_CARS.filter(car => {
    const matchesBrand = !selectedBrand || car.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesSearch = car.name.toLowerCase().includes(searchQuery.toLowerCase()) || car.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans pb-24">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-50 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentView !== 'list' ? (
            <button 
              onClick={() => {
                if (currentView === 'detail') setCurrentView('list');
                else if (currentView === 'book') setCurrentView('detail');
                else if (currentView === 'summary') setCurrentView('book');
                else if (currentView === 'verification') setCurrentView('summary');
                else if (currentView === 'active-booking') setCurrentView('list');
              }}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          ) : (
            <button 
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div>
            <h1 className="text-md font-black tracking-tight flex items-center gap-1.5 uppercase">
              <Key className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{language === 'sw' ? 'Kukodi na Kununua Magari' : 'Car Rental & Sales'}</span>
            </h1>
            <p className="text-[10px] text-neutral-400 uppercase font-mono font-bold tracking-wider">
              {language === 'sw' ? 'Tegex Luxury Drives' : 'Premium Mobility'}
            </p>
          </div>
        </div>

        {activeBooking && currentView !== 'active-booking' && (
          <button 
            onClick={() => setCurrentView('active-booking')}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black px-3 py-1.5 rounded-full transition shadow-lg shadow-amber-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{language === 'sw' ? 'Oda Yako' : 'My Rental'}</span>
          </button>
        )}
      </header>

      {/* RENTAL FLOW VIEWS */}

      {/* 1. LIST VIEW */}
      {currentView === 'list' && (
        <div className="flex-1">
          {/* Hero Banner Section */}
          <div className="p-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-neutral-900 p-6 border border-indigo-500/20 shadow-xl shadow-indigo-950/20">
              <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-35 bg-[url('https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80')] bg-cover bg-center" />
              <div className="relative z-10 max-w-[60%]">
                <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  {language === 'sw' ? 'Ofa ya Leo' : 'Limited Offer'}
                </span>
                <h2 className="text-xl font-black mt-2 leading-snug text-white">
                  {language === 'sw' ? 'Kodi Gari Bila Amana ya Dhamana!' : 'Book your drive now!'}
                </h2>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  {language === 'sw' ? 'Chagua gari lako upendalo na udereva wa amani 0 security deposit.' : 'Pick a car of your choice at 0 security deposit'}
                </p>
                <button 
                  onClick={() => {
                    setSelectedCategory('all');
                    toast.info(language === 'sw' ? 'Tazama magari yote hapa chini' : 'Explore all options below');
                  }}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-lg transition-all"
                >
                  {language === 'sw' ? 'Tazama Magari' : 'View Cars'}
                </button>
              </div>
            </div>
          </div>

          {/* Mode Switcher: Rent vs Buy */}
          <div className="px-4 mb-4">
            <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1.5 rounded-xl border border-neutral-800">
              <button 
                onClick={() => {
                  setActiveMode('rent');
                  setSelectedBrand(null);
                }}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                  activeMode === 'rent' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                🔑 {language === 'sw' ? 'Kukodi (Rent)' : 'Rent a Car'}
              </button>
              <button 
                onClick={() => {
                  setActiveMode('buy');
                  setSelectedBrand(null);
                }}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                  activeMode === 'buy' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                🏷️ {language === 'sw' ? 'Kununua (Buy)' : 'Cars for Sale'}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input 
                type="text"
                placeholder={activeMode === 'rent' 
                  ? (language === 'sw' ? 'Tafuta gari la kukodi...' : 'Search rental cars...') 
                  : (language === 'sw' ? 'Tafuta gari la kununua...' : 'Search cars for sale...')
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Popular Brands Horizontal Scroll list */}
          <div className="px-4 mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">
              {language === 'sw' ? 'Chapa Maarufu' : 'Top Brands'}
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {['Toyota', 'Mercedes', 'BMW', 'Honda', 'Suzuki'].map((brand) => (
                <button
                  key={brand}
                  onClick={() => {
                    setSelectedBrand(selectedBrand === brand ? null : brand);
                  }}
                  className={`flex flex-col items-center justify-center min-w-[76px] h-[76px] rounded-xl border transition ${
                    selectedBrand === brand 
                      ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                      : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-black text-sm text-indigo-400">
                    {brand[0]}
                  </div>
                  <span className="text-[10px] font-bold mt-1.5">{brand}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Categories filter (ONLY FOR RENT) */}
          {activeMode === 'rent' && (
            <div className="px-4 mb-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'SUV & Hatchback' },
                  { id: 'suv', label: 'SUV' },
                  { id: 'hatchback', label: 'Hatchback' },
                  { id: 'wedding', label: 'Wedding Cars 👰' },
                  { id: 'safari', label: 'Safari & Tours 🦁' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-black transition ${
                      selectedCategory === cat.id 
                        ? 'bg-white text-black' 
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rental List Content */}
          {activeMode === 'rent' ? (
            <div className="px-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  {language === 'sw' ? 'Magari ya Kukodi' : 'Available Cars for Rent'}
                </h3>
                <span className="text-[10px] font-mono text-neutral-500 font-bold">
                  {filteredRentCars.length} {language === 'sw' ? 'Yamepatikana' : 'found'}
                </span>
              </div>

              {filteredRentCars.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900 rounded-2xl border border-neutral-800">
                  <Car className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-black">
                    {language === 'sw' ? 'Hakuna magari yaliyopatikana kwa vichujio hivi.' : 'No cars found matching these filters.'}
                  </p>
                  <button 
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedBrand(null);
                      setSearchQuery('');
                    }}
                    className="mt-3 text-xs font-black text-indigo-400 underline hover:text-indigo-300"
                  >
                    {language === 'sw' ? 'Ondoa vichujio vyote' : 'Reset filters'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredRentCars.map((car) => (
                    <div 
                      key={car.id}
                      onClick={() => {
                        setSelectedCar(car);
                        setCurrentView('detail');
                        setDetailTab('about');
                      }}
                      className="group cursor-pointer bg-neutral-900 rounded-2xl border border-neutral-850 overflow-hidden hover:border-neutral-750 transition duration-300"
                    >
                      <div className="relative h-44 bg-neutral-800 overflow-hidden">
                        <img 
                          src={car.image} 
                          alt={car.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        
                        {/* Rating chip */}
                        <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 border border-white/5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-black text-white">{car.rating}</span>
                        </div>

                        {/* Favorite button */}
                        <button 
                          onClick={(e) => handleFavoriteToggle(car.id, e)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/5 text-neutral-300 hover:text-red-500 transition"
                        >
                          <Heart className={`w-4 h-4 ${favorites.includes(car.id) ? 'text-red-500 fill-red-500' : ''}`} />
                        </button>

                        <div className="absolute bottom-3 left-3">
                          <span className="bg-indigo-600/90 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white mr-1.5">
                            {car.type.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-black text-white">{car.name}</h4>
                            <p className="text-[10px] text-neutral-400 font-medium mt-0.5 uppercase tracking-wide">
                              {car.transmission} • {car.fuel} • {car.seats} {language === 'sw' ? 'Siti' : 'Seats'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-indigo-400 block">
                              TSh {car.pricePerDay.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-neutral-500 font-bold">
                              /{language === 'sw' ? 'siku' : 'day'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-neutral-850 flex items-center justify-between">
                          <span className="text-[9px] font-mono text-neutral-400 font-bold bg-neutral-950 px-2 py-1 rounded">
                            {car.carNumber}
                          </span>
                          <button className="text-[10px] font-black uppercase text-indigo-400 group-hover:underline flex items-center gap-1">
                            <span>{language === 'sw' ? 'Kodi Sasa' : 'Rent Now'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Sales List Content
            <div className="px-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  {language === 'sw' ? 'Magari ya Kununua' : 'Featured Cars for Sale'}
                </h3>
                <span className="text-[10px] font-mono text-neutral-500 font-bold">
                  {filteredSaleCars.length} {language === 'sw' ? 'Yamepatikana' : 'found'}
                </span>
              </div>

              {filteredSaleCars.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900 rounded-2xl border border-neutral-800">
                  <Car className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400 font-black">
                    {language === 'sw' ? 'Hakuna magari ya kuuzwa yaliyopatikana.' : 'No cars for sale found.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredSaleCars.map((car) => (
                    <div 
                      key={car.id}
                      onClick={() => {
                        setSelectedSaleCar(car);
                        setSelectedCar(null);
                        setCurrentView('detail');
                        setDetailTab('about');
                      }}
                      className="group cursor-pointer bg-neutral-900 rounded-2xl border border-neutral-850 overflow-hidden hover:border-neutral-750 transition duration-300"
                    >
                      <div className="relative h-44 bg-neutral-800 overflow-hidden">
                        <img 
                          src={car.image} 
                          alt={car.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        
                        {/* Mileage and Year chips */}
                        <div className="absolute top-3 left-3 bg-neutral-950/85 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5 text-[10px] font-black text-emerald-400">
                          {car.year} Model
                        </div>

                        {/* Favorite button */}
                        <button 
                          onClick={(e) => handleFavoriteToggle(car.id, e)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/5 text-neutral-300 hover:text-red-500 transition"
                        >
                          <Heart className={`w-4 h-4 ${favorites.includes(car.id) ? 'text-red-500 fill-red-500' : ''}`} />
                        </button>
                      </div>

                      <div className="p-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-black text-white">{car.name}</h4>
                            <p className="text-[10px] text-neutral-400 font-medium mt-0.5 uppercase tracking-wide">
                              {car.year} • {car.mileage.toLocaleString()} km • {car.fuel}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-400 block">
                              TSh {car.price.toLocaleString()}
                            </span>
                            <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase mt-1 inline-block">
                              {language === 'sw' ? 'Mjadala' : 'Negotiable'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-neutral-850 flex items-center justify-between">
                          <span className="text-[9px] text-neutral-400 font-bold bg-neutral-950 px-2 py-1 rounded uppercase tracking-wider">
                            {car.transmission}
                          </span>
                          <button className="text-[10px] font-black uppercase text-emerald-400 group-hover:underline flex items-center gap-1">
                            <span>{language === 'sw' ? 'Wasiliana na Muuzaji' : 'Contact Seller'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. DETAIL VIEW */}
      {currentView === 'detail' && (
        <div className="flex-1">
          {/* Active Car details setup */}
          {selectedCar ? (
            <div>
              {/* Product Gallery Slider placeholder */}
              <div className="relative h-64 bg-neutral-900">
                <img 
                  src={selectedCar.gallery[0] || selectedCar.image} 
                  alt={selectedCar.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
                
                <button 
                  onClick={() => setCurrentView('list')}
                  className="absolute top-4 left-4 p-2 rounded-xl bg-black/65 backdrop-blur-md border border-white/5 text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={(e) => handleFavoriteToggle(selectedCar.id, e)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-black/65 backdrop-blur-md border border-white/5 text-white"
                >
                  <Heart className={`w-5 h-5 ${favorites.includes(selectedCar.id) ? 'text-red-500 fill-red-500' : ''}`} />
                </button>

                {/* Status Overlay */}
                <div className="absolute bottom-4 left-4">
                  <span className="bg-indigo-600 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md text-white mr-1.5 shadow-lg shadow-indigo-600/20">
                    {selectedCar.type.toUpperCase()}
                  </span>
                  <span className="bg-black/65 backdrop-blur-md text-[10px] font-mono font-bold tracking-wide px-2.5 py-1 rounded-md text-emerald-400 border border-white/5">
                    {selectedCar.carNumber}
                  </span>
                </div>
              </div>

              {/* Title & rating */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">{selectedCar.name}</h2>
                    <p className="text-xs text-neutral-400 font-bold mt-1 uppercase">
                      Brand: <span className="text-white">{selectedCar.brand}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-indigo-400 block">
                      TSh {selectedCar.pricePerDay.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">
                      /{language === 'sw' ? 'siku' : 'day'}
                    </span>
                  </div>
                </div>

                {/* Rating summary banner */}
                <div className="mt-3 flex items-center gap-2 bg-neutral-900 border border-neutral-850 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-lg font-black text-xs border border-amber-500/15">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{selectedCar.rating}</span>
                  </div>
                  <span className="text-xs font-semibold text-neutral-300">
                    {language === 'sw' ? 'Wateja 24 wameikadiria gari hili' : '24 clients have reviewed this car'}
                  </span>
                </div>

                {/* Spec Indicators Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                      Engine
                    </span>
                    <span className="text-xs font-black text-white">{selectedCar.engine}</span>
                  </div>
                  <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                      Gearbox
                    </span>
                    <span className="text-xs font-black text-white">{selectedCar.transmission}</span>
                  </div>
                  <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl text-center">
                    <span className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                      Fuel
                    </span>
                    <span className="text-xs font-black text-white">{selectedCar.fuel}</span>
                  </div>
                </div>

                {/* TAB SWITCHER */}
                <div className="mt-6 border-b border-neutral-800 flex gap-4">
                  {[
                    { id: 'about', label: 'About' },
                    { id: 'feature', label: 'Feature' },
                    { id: 'gallery', label: 'Gallery' },
                    { id: 'review', label: 'Review' }
                  ].map((tItem) => (
                    <button
                      key={tItem.id}
                      onClick={() => setDetailTab(tItem.id as any)}
                      className={`pb-2.5 text-xs font-black uppercase tracking-wider relative transition ${
                        detailTab === tItem.id ? 'text-indigo-400' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      <span>{tItem.label}</span>
                      {detailTab === tItem.id && (
                        <motion.div 
                          layoutId="activeDetailTab" 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" 
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* TAB CONTENTS */}
                <div className="mt-4 min-h-[140px]">
                  {detailTab === 'about' && (
                    <p className="text-xs text-neutral-400 leading-relaxed font-semibold">
                      {selectedCar.about}
                    </p>
                  )}

                  {detailTab === 'feature' && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-neutral-500 tracking-wider mb-2">Notable Features:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCar.features.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-neutral-900 p-2.5 rounded-lg border border-neutral-850">
                            <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/15">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-xs text-neutral-300 font-bold">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailTab === 'gallery' && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedCar.gallery.map((img, idx) => (
                        <img 
                          key={idx} 
                          src={img} 
                          alt="" 
                          className="w-full h-20 object-cover rounded-xl border border-neutral-800"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  )}

                  {detailTab === 'review' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-neutral-900 border border-neutral-850 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black">Miraji Chambo</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className="w-3 h-3 text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-semibold">
                          Gari hili lipo vizuri sana! Lipo safi na AC inafanya kazi vizuri mno. Nilitumia safarini kuelekea Bagamoyo bila tatizo lolote.
                        </p>
                      </div>

                      <div className="p-3 bg-neutral-900 border border-neutral-850 rounded-xl">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black">Meena Patel</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className="w-3 h-3 text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-semibold">
                          Outstanding cleanliness and super responsive support. Chauffeur was friendly, professional and on time. HIGHLY RECOMMENDED.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary CTA Button */}
                <div className="mt-6">
                  <button 
                    onClick={() => setCurrentView('book')}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                  >
                    <span>{language === 'sw' ? 'Kitabu Sasa (Book Now)' : 'Proceed to Book'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Sale Car detail setup
            selectedSaleCar && (
              <div>
                <div className="relative h-64 bg-neutral-900">
                  <img 
                    src={selectedSaleCar.image} 
                    alt={selectedSaleCar.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
                  
                  <button 
                    onClick={() => setCurrentView('list')}
                    className="absolute top-4 left-4 p-2 rounded-xl bg-black/65 backdrop-blur-md border border-white/5 text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                        {selectedSaleCar.year} Model
                      </span>
                      <h2 className="text-xl font-black text-white mt-1.5">{selectedSaleCar.name}</h2>
                      <p className="text-xs text-neutral-400 font-bold mt-0.5">
                        Brand: <span className="text-white">{selectedSaleCar.brand}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400 block">
                        TSh {selectedSaleCar.price.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-neutral-500 font-black uppercase">
                        {language === 'sw' ? 'Mjadala Unaruhusiwa' : 'Negotiable'}
                      </span>
                    </div>
                  </div>

                  {/* Info table specs */}
                  <div className="grid grid-cols-2 gap-2 mt-4 bg-neutral-900 p-3 rounded-xl border border-neutral-850">
                    <div className="text-xs font-semibold text-neutral-300 flex justify-between">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Mileage:</span>
                      <span>{selectedSaleCar.mileage.toLocaleString()} km</span>
                    </div>
                    <div className="text-xs font-semibold text-neutral-300 flex justify-between">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Fuel:</span>
                      <span>{selectedSaleCar.fuel}</span>
                    </div>
                    <div className="text-xs font-semibold text-neutral-300 flex justify-between">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Gearbox:</span>
                      <span>{selectedSaleCar.transmission}</span>
                    </div>
                    <div className="text-xs font-semibold text-neutral-300 flex justify-between">
                      <span className="text-neutral-500 font-bold uppercase text-[10px]">Seats:</span>
                      <span>{selectedSaleCar.seats} {language === 'sw' ? 'Siti' : 'Seats'}</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">
                      {language === 'sw' ? 'Maelezo ya Gari' : 'Description'}
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed font-semibold">
                      {selectedSaleCar.about}
                    </p>
                  </div>

                  {/* Sales Contact CTA */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <a 
                      href="tel:+255712345678"
                      className="h-12 bg-neutral-900 hover:bg-neutral-800 text-white font-black border border-neutral-800 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>{language === 'sw' ? 'Piga Simu' : 'Call Seller'}</span>
                    </a>
                    <button 
                      onClick={() => {
                        toast.success(language === 'sw' ? 'Huduma ya chat imeanzishwa na muuzaji!' : 'Chat session initialized with seller!');
                        navigate('/chat');
                      }}
                      className="h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{language === 'sw' ? 'Tuma Ujumbe' : 'Chat / Offer'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* 3. BOOKING FORM SETUP */}
      {currentView === 'book' && selectedCar && (
        <div className="flex-1 p-4">
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-4 mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">Selected Car:</h3>
            <div className="flex items-center gap-3">
              <img src={selectedCar.image} alt="" className="w-16 h-12 object-cover rounded-lg" referrerPolicy="no-referrer" />
              <div>
                <h4 className="text-sm font-black">{selectedCar.name}</h4>
                <p className="text-[10px] text-indigo-400 font-mono font-bold">
                  TSh {selectedCar.pricePerDay.toLocaleString()} /day
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-black uppercase tracking-wider mb-4">{language === 'sw' ? 'Sanidi Mkataba wa Ukodishaji' : 'Configure Rental Period'}</h3>

          <div className="space-y-4">
            {/* Chauffeur Toggle */}
            <div className="flex items-center justify-between bg-neutral-900 border border-neutral-850 p-4 rounded-xl">
              <div>
                <span className="text-xs font-black block">{language === 'sw' ? 'Kukodi na Dereva (Book with driver)' : 'Hire with Professional Chauffeur'}</span>
                <span className="text-[10px] text-neutral-400 font-semibold">
                  Don't have a driver? Add for just <strong className="text-indigo-400">TSh {DRIVER_RATE.toLocaleString()}/day</strong>
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={bookWithDriver}
                  onChange={(e) => setBookWithDriver(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl">
                <label className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                  Date of Pick-up
                </label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-2.5 w-4 h-4 text-indigo-400 pointer-events-none" />
                  <input 
                    type="date" 
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full bg-neutral-950 border-none text-xs rounded p-1.5 pl-8 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl">
                <label className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                  Date of Return
                </label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-2.5 w-4 h-4 text-red-400 pointer-events-none" />
                  <input 
                    type="date" 
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-neutral-950 border-none text-xs rounded p-1.5 pl-8 text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Time Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl">
                <label className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                  Time of Pick-up
                </label>
                <div className="relative flex items-center">
                  <Clock className="absolute left-2.5 w-4 h-4 text-indigo-400 pointer-events-none" />
                  <input 
                    type="time" 
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-neutral-950 border-none text-xs rounded p-1.5 pl-8 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-850 p-3 rounded-xl">
                <label className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider mb-1">
                  Time of Return
                </label>
                <div className="relative flex items-center">
                  <Clock className="absolute left-2.5 w-4 h-4 text-red-400 pointer-events-none" />
                  <input 
                    type="time" 
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full bg-neutral-950 border-none text-xs rounded p-1.5 pl-8 text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={() => {
                const days = calculateDays();
                if (days <= 0) {
                  toast.error(language === 'sw' ? 'Tarehe za kurudi lazima ziwe mbele ya tarehe ya kukodi' : 'Return date must be after pickup date');
                  return;
                }
                setCurrentView('summary');
              }}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
            >
              <span>{language === 'sw' ? 'Endelea Kwenye Mapitio (Let\'s Go)' : 'Review Booking Summary'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. BOOKING SUMMARY & BILLING */}
      {currentView === 'summary' && selectedCar && (
        <div className="flex-1 p-4">
          <h2 className="text-md font-black uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span>{language === 'sw' ? 'Mapitio ya Ukodishaji' : 'Review Summary'}</span>
          </h2>

          {/* Car summary card */}
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-4 mb-4">
            <span className="bg-indigo-600/20 text-indigo-300 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
              {selectedCar.type.toUpperCase()}
            </span>
            <h3 className="text-base font-black text-white mt-1.5">{selectedCar.name}</h3>
            <p className="text-[10px] text-neutral-400 font-semibold">{selectedCar.carNumber}</p>
            
            <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Pick-up Date & Time:</span>
                <span>{pickupDate} | {pickupTime}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Return Date & Time:</span>
                <span>{returnDate} | {returnTime}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Chauffeur Chose:</span>
                <span className="text-indigo-400 font-bold">
                  {bookWithDriver ? (language === 'sw' ? 'Ndiyo (With Driver)' : 'With Driver') : (language === 'sw' ? 'Hapana (Self Drive)' : 'Self Drive')}
                </span>
              </div>
            </div>
          </div>

          {/* Promo code block */}
          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl mb-4">
            <label className="text-[10px] text-neutral-400 uppercase font-black block mb-1.5">
              {language === 'sw' ? 'Weka Kuponi ya Punguzo' : 'Apply Coupon'}
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="E.g. KARIBU / TEGEX" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={couponStatus === 'success'}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
              />
              {couponStatus === 'success' ? (
                <button 
                  onClick={removePromo}
                  className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-black px-4 py-2 rounded-xl transition"
                >
                  {language === 'sw' ? 'Ondoa' : 'Remove'}
                </button>
              ) : (
                <button 
                  onClick={applyPromo}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-xl transition"
                >
                  {language === 'sw' ? 'Tumia' : 'Apply'}
                </button>
              )}
            </div>
            <p className="text-[9px] text-neutral-500 font-bold uppercase mt-1">
              💡 Hint: Enter <strong className="text-indigo-400">KARIBU</strong> for 10% off or <strong className="text-indigo-400">TEGEX</strong> for TSh 15,000 off!
            </p>
          </div>

          {/* Billing breakdown */}
          <div className="bg-neutral-900 border border-neutral-850 rounded-2xl p-4 mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-3">
              {language === 'sw' ? 'Mchanganuo wa Gharama' : 'Payment Breakdown'}
            </h4>
            
            {(() => {
              const { base, driver, tax, discount, total, days } = getPriceBreakdown();
              return (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between font-semibold text-neutral-400">
                    <span>Total Days:</span>
                    <span className="text-white font-black">{days} Days</span>
                  </div>
                  <div className="flex justify-between font-semibold text-neutral-400">
                    <span>Car Base Rental Fee:</span>
                    <span className="text-white font-bold">TSh {base.toLocaleString()}</span>
                  </div>
                  {driver > 0 && (
                    <div className="flex justify-between font-semibold text-neutral-400">
                      <span>Driver Service Fee:</span>
                      <span className="text-indigo-400 font-bold">TSh {driver.toLocaleString()}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between font-semibold text-neutral-400">
                      <span>Coupon Applied:</span>
                      <span className="text-emerald-400 font-bold">- TSh {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-neutral-400">
                    <span>Tax & Service Fees (5%):</span>
                    <span className="text-white">TSh {tax.toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t border-neutral-800 flex justify-between font-black text-sm text-indigo-400">
                    <span>Net Amount:</span>
                    <span className="text-white text-base">TSh {total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Proceed to verification */}
          <div>
            <button 
              onClick={() => setCurrentView('verification')}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
            >
              <span>{language === 'sw' ? 'Endelea Kwenye Uhakiki' : 'Proceed to Verification'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. VERIFICATION & CONDITION UPLOADER */}
      {currentView === 'verification' && selectedCar && (
        <div className="flex-1 p-4">
          <h2 className="text-md font-black uppercase tracking-wider mb-4">
            🛡️ {language === 'sw' ? 'Uhakiki wa Gari na Kitambulisho' : 'Verification Checklist'}
          </h2>

          <p className="text-xs text-neutral-400 font-semibold leading-relaxed mb-6">
            To ensure zero security deposits and full safety protocol coverage, please complete the quick digital upload of your identification and current vehicle check-in state.
          </p>

          <div className="space-y-5">
            {/* 1. Interior/Exterior condition upload */}
            <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl">
              <h4 className="text-xs font-black uppercase text-neutral-300 tracking-wide mb-1">
                {language === 'sw' ? 'Hali ya Gari (Interior & Exterior)' : 'Car Interior & Exterior Condition'}
              </h4>
              <p className="text-[10px] text-neutral-400 font-semibold mb-3">
                Upload current photos of the vehicle condition to ensure absolute dispute protection.
              </p>

              {interiorImage ? (
                <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 p-2">
                  <img src={interiorImage} alt="" className="w-full h-32 object-cover rounded-lg" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => setInteriorImage(null)}
                    className="absolute top-4 right-4 bg-red-600 hover:bg-red-500 p-1.5 rounded-lg text-white transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => triggerImageUpload('interior')}
                  className="w-full py-8 border-2 border-dashed border-neutral-800 hover:border-indigo-500 bg-neutral-950/50 rounded-xl flex flex-col items-center justify-center gap-2 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-indigo-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-white">{language === 'sw' ? 'Pakia Picha za Gari' : 'Upload Car Condition Photo'}</span>
                  <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Simulated Camera</span>
                </button>
              )}
            </div>

            {/* 2. License upload */}
            <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl">
              <h4 className="text-xs font-black uppercase text-neutral-300 tracking-wide mb-1">
                {language === 'sw' ? 'Leseni ya Udereva / Kitambulisho' : 'ID Proof or Driving License'}
              </h4>
              <p className="text-[10px] text-neutral-400 font-semibold mb-3">
                Digital license proof required to authorize self-drive security waivers.
              </p>

              {licenseImage ? (
                <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-xs font-black text-white block">License Verified Successfully</span>
                      <span className="text-[9px] text-neutral-400 font-mono">{licenseName}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setLicenseImage(null);
                      setLicenseName('');
                    }}
                    className="p-1 text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => triggerImageUpload('license')}
                  className="w-full py-8 border-2 border-dashed border-neutral-800 hover:border-indigo-500 bg-neutral-950/50 rounded-xl flex flex-col items-center justify-center gap-2 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-indigo-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-white">{language === 'sw' ? 'Pakia Leseni' : 'Upload Driving License / ID'}</span>
                  <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">PDF / JPEG / PNG</span>
                </button>
              )}
            </div>
          </div>

          {/* Confirm pickup trigger */}
          <div className="mt-8">
            <button 
              onClick={() => {
                if (!interiorImage || !licenseImage) {
                  toast.error(language === 'sw' ? 'Tafadhali pakia picha zote kabla ya kuendelea' : 'Please upload both files before continuing');
                  return;
                }
                confirmBooking();
              }}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
            >
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <span>{language === 'sw' ? 'Thibitisha Ukodishaji (Confirm Pick-up)' : 'Confirm & Unlock Car'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. ACTIVE BOOKING / LIVE MAP VIEW */}
      {currentView === 'active-booking' && activeBooking && selectedCar && (
        <div className="flex-1 p-4">
          <div className="text-center py-4">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider animate-pulse">
              ● Active Trip
            </span>
            <h2 className="text-xl font-black mt-2">{selectedCar.name} is on the road!</h2>
            <p className="text-xs text-neutral-400 mt-1 uppercase font-mono">{activeBooking.id} • T 192 DHG</p>
          </div>

          {/* Map widget container with animated location */}
          <div className="relative h-60 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-850 mb-4">
            {/* Simple decorative map outline mock */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
            
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="relative">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-full flex items-center justify-center animate-ping absolute -top-2 -left-2" />
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white border border-indigo-400 relative z-10">
                  <Car className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="bg-neutral-950 border border-neutral-800 text-[9px] font-black text-indigo-400 px-2 py-0.5 rounded-full mt-2 uppercase">
                {language === 'sw' ? 'Eneo la Gari' : 'Vehicle GPS Link'}
              </span>
            </div>

            {/* Custom Location card inside map */}
            <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md border border-neutral-800 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <MapPinIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-black tracking-wide block">Current Depot Address:</span>
                <span className="text-xs font-black text-white">404 Walnut Street, Dar es Salaam, Tanzania</span>
              </div>
            </div>
          </div>

          {/* Active stats */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-900 border border-neutral-850 p-4 rounded-2xl mb-4 text-center">
            <div>
              <span className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider">
                Total Days:
              </span>
              <span className="text-sm font-black text-white">{activeBooking.days} {language === 'sw' ? 'Siku' : 'Days'}</span>
            </div>
            <div>
              <span className="text-[9px] text-neutral-500 uppercase font-black block tracking-wider">
                Trips Status:
              </span>
              <span className="text-sm font-black text-emerald-400 uppercase">
                {language === 'sw' ? 'Hai' : 'Fully Authorized'}
              </span>
            </div>
          </div>

          {/* Detailed receipt billing item */}
          <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl mb-6">
            <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-2">Booking Detail Breakdown</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Pickup:</span>
                <span>{activeBooking.pickupDate} ({activeBooking.pickupTime})</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Return:</span>
                <span>{activeBooking.returnDate} ({activeBooking.returnTime})</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-300">
                <span className="text-neutral-500">Rent Partner / Operator:</span>
                <span className="text-indigo-400 font-bold">Tegex Fleet Owner</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-300 pt-2 border-t border-neutral-800">
                <span className="text-neutral-500">Pre-authorized Total:</span>
                <span className="text-white font-black">TSh {activeBooking.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action triggers */}
          <div className="space-y-2">
            <button 
              onClick={endBooking}
              className="w-full h-12 bg-red-650 hover:bg-red-650/90 text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20"
            >
              <span>{language === 'sw' ? 'Rudisha Gari (Drop Vehicle)' : 'Drop-off / Complete Rental'}</span>
            </button>
            <button 
              onClick={() => {
                toast.info(language === 'sw' ? 'Piga simu msaada wa dharura...' : 'Calling emergency fleet support...');
              }}
              className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition"
            >
              <Phone className="w-4 h-4 text-amber-400" />
              <span>{language === 'sw' ? 'Msaada wa Dharura' : 'Emergency Fleet Assistance'}</span>
            </button>
          </div>
        </div>
      )}

      {/* RATING & DROP-OFF DIALOG MODAL */}
      <AnimatePresence>
        {showRatingModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 relative"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                  <Star className="w-6 h-6 text-indigo-400 fill-indigo-400" />
                </div>
                <h3 className="text-base font-black uppercase text-white mb-1">
                  {language === 'sw' ? 'Kadiria Safari Yako' : 'Rate Your Rental Car'}
                </h3>
                <p className="text-xs text-neutral-400 font-semibold mb-4">
                  How was your experience driving the {selectedCar?.name}?
                </p>

                {/* Rating Stars picker */}
                <div className="flex gap-2 justify-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setUserRating(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= userRating 
                            ? 'text-amber-400 fill-amber-400' 
                            : 'text-neutral-700'
                        }`} 
                      />
                    </button>
                  ))}
                </div>

                {/* Optional comments */}
                <textarea
                  placeholder={language === 'sw' ? 'Andika maoni hapa (hiari)...' : 'Write a short review (optional)...'}
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition mb-4 resize-none h-18"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowRatingModal(false)}
                    className="py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-white font-black rounded-xl text-xs uppercase tracking-wider transition border border-neutral-800"
                  >
                    {language === 'sw' ? 'Ghairi' : 'Cancel'}
                  </button>
                  <button 
                    onClick={submitRating}
                    className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/20"
                  >
                    {language === 'sw' ? 'Tuma Maoni' : 'Submit Rate'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
