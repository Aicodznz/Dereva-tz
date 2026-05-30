import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { VendorProfile, Product } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Bus, MapPin, Calendar, Clock, ArrowRight, Search, 
  Filter, Armchair, ChevronRight, Star, Info,
  CheckCircle2, AlertCircle, Wifi, Plug, Headphones, Shield,
  Activity, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SafeBusLogoProps {
  vendor: any;
  className?: string;
}

function SafeBusLogo({ vendor, className = "w-full h-full object-contain rounded-2xl" }: SafeBusLogoProps) {
  const [imgError, setImgError] = useState(false);
  const initials = vendor?.businessName ? vendor.businessName.substring(0, 2).toUpperCase() : 'B';

  if (!vendor?.logoUrl || imgError) {
    return (
      <div className="w-full h-full bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-black text-lg select-none italic tracking-tighter">
        {initials}
      </div>
    );
  }

  return (
    <img 
      src={vendor.logoUrl} 
      alt={vendor.businessName || 'Logo'} 
      onError={() => setImgError(true)}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}

interface BusBookingProps {
  vendors: VendorProfile[];
  products: Product[];
}

export default function BusBooking({ vendors, products }: BusBookingProps) {
  const navigate = useNavigate();
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'amenities' | 'reviews' | 'cancellation'>('amenities');
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState({
    origin: '',
    destination: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    // Fetch all branches to correlate with trips
    const branchesRef = collection(db, 'branches');
    const unsub = onSnapshot(branchesRef, (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error: any) => {
      if (error.message?.includes('permission')) {
        console.warn("Branches restricted by rules");
        return;
      }
      handleFirestoreError(error, OperationType.GET, 'branches');
    });
    return () => unsub();
  }, []);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const origins = Array.from(new Set(products
    .filter(p => p.vendorCategory === 'bus_ticket' && (p as any).origin)
    .map(p => (p as any).origin as string)
  )).sort();

  const destinations = Array.from(new Set(products
    .filter(p => p.vendorCategory === 'bus_ticket' && (p as any).destination)
    .map(p => (p as any).destination as string)
  )).sort();

  const handleSearch = (originOverride?: any, destOverride?: string) => {
    setIsSearching(true);
    setHasSearched(true);
    
    const targetOrigin = (typeof originOverride === 'string') ? originOverride : search.origin;
    const targetDest = (typeof destOverride === 'string') ? destOverride : search.destination;

    // Simulate search delay
    setTimeout(() => {
       const filtered = products.filter(p => {
        const isBus = p.vendorCategory === 'bus_ticket';
        const matchesOrigin = !targetOrigin || (p as any).origin?.toLowerCase().includes(targetOrigin.toLowerCase());
        const matchesDest = !targetDest || (p as any).destination?.toLowerCase().includes(targetDest.toLowerCase());
        return isBus && matchesOrigin && matchesDest;
      });
      setResults(filtered);
      setIsSearching(false);
      if (filtered.length === 0) {
        toast.error("Safari haijapatikana. Jaribu kubadilisha tarehe au mji unapotafuta.");
      }
    }, 800);
  };

  const getVendor = (vendorId: string) => vendors.find(v => v.id === vendorId);

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Search Section */}
      <div className="relative -mx-4 px-4 py-12 bg-neutral-900 rounded-b-[3rem] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500/40 via-transparent to-transparent" />
          <div className="absolute top-1/2 left-0 w-full h-1/2 bg-[linear-gradient(to_top,_var(--tw-gradient-stops))] from-orange-500/10 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase"
            >
              Ticket Mkononi
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-neutral-400 text-xs md:text-sm font-bold uppercase tracking-widest"
            >
              Safiri salama na mabasi bora Tanzania 🇹🇿
            </motion.p>
          </div>

          {/* Search Card */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl shadow-black/50 border border-neutral-100"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  Kutoka (From)
                </label>
                <div className="relative group">
                  <input 
                    list="origins"
                    placeholder="Wapi unakuja?"
                    className="w-full h-14 pl-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100 focus:border-orange-500 focus:ring-0 transition-all font-bold text-neutral-900 placeholder:text-neutral-300 uppercase italic tracking-tight"
                    value={search.origin}
                    onChange={(e) => setSearch({ ...search, origin: e.target.value })}
                  />
                  <datalist id="origins">
                    {origins.map((o, i) => <option key={`origin-opt-${o}-${i}`} value={o} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2 relative">
                <button
                  type="button"
                  title="Swap / Badilisha Vituo"
                  onClick={() => {
                    setSearch(prev => ({
                      ...prev,
                      origin: prev.destination,
                      destination: prev.origin
                    }));
                  }}
                  className="hidden md:block absolute -left-8 top-11 -translate-y-1/2 z-20 hover:scale-110 active:scale-95 transition-all text-white focus:outline-none"
                >
                  <div className="w-8 h-8 bg-orange-600 hover:bg-orange-700 rounded-full flex items-center justify-center shadow-xl border-4 border-white cursor-pointer select-none">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  Kwenda (To)
                </label>
                <input 
                  list="destinations"
                  placeholder="Wapi unaenda?"
                  className="w-full h-14 pl-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100 focus:border-orange-500 focus:ring-0 transition-all font-bold text-neutral-900 placeholder:text-neutral-300 uppercase italic tracking-tight"
                  value={search.destination}
                  onChange={(e) => setSearch({ ...search, destination: e.target.value })}
                />
                <datalist id="destinations">
                  {destinations.map((d, i) => <option key={`dest-opt-${d}-${i}`} value={d} />)}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-orange-500" />
                  Tarehe (Date)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="date"
                    className="flex-1 h-14 px-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100 focus:border-orange-500 focus:ring-0 transition-all font-bold text-neutral-900"
                    value={search.date}
                    onChange={(e) => setSearch({ ...search, date: e.target.value })}
                  />
                  <Button 
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="h-14 w-14 rounded-2xl bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/30 shrink-0"
                  >
                    {isSearching ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-6 h-6" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-xl text-neutral-900 uppercase italic tracking-tighter">
            {hasSearched ? `Safari Zilizoonekana (${results.length})` : 'Mabasi Maarufu Leo'}
          </h3>
          <Button variant="ghost" size="sm" className="text-orange-600 font-black gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {(hasSearched ? results : products.filter(p => p.vendorCategory === 'bus_ticket').slice(0, 5)).map((trip, idx) => {
              const vendor = getVendor(trip.vendorId);
              const isExpanded = expandedTripId === trip.id;
              return (
                <motion.div
                  key={`trip-${trip.id}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group"
                  onClick={() => {
                    setExpandedTripId(isExpanded ? null : (trip.id || ''));
                    setActiveTab('amenities');
                  }}
                >
                  <Card className={`overflow-hidden rounded-[2.25rem] border transition-all cursor-pointer bg-[#f8f9fa] ${
                    isExpanded 
                      ? 'border-[#7c3aed] ring-[3px] ring-violet-500/10 shadow-lg' 
                      : 'border-neutral-200/50 hover:border-[#8b5cf6]/50 hover:shadow-xl hover:shadow-violet-600/5'
                  }`}>
                    <CardContent className="p-6 md:p-8 space-y-6">
                      
                      {/* Top Row: Brand & Logo + Price */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white rounded-full p-0.5 shadow-sm border border-neutral-200/60 shrink-0 overflow-hidden flex items-center justify-center">
                            <SafeBusLogo vendor={vendor} className="w-full h-full object-cover rounded-full" />
                          </div>
                          <div>
                            <h4 className="font-bold text-base md:text-lg text-neutral-800 tracking-tight leading-tight">
                              {vendor?.businessName || 'Kilimanjaro Express'}
                            </h4>
                            <p className="text-xs text-neutral-400 font-semibold tracking-wide mt-1">
                              Luxury AC Seater
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg md:text-xl font-extrabold text-[#7c3aed] tracking-tight">
                            TZS {trip.price.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mt-1">
                            Bure Kughairi
                          </p>
                        </div>
                      </div>

                      {/* Middle Row: Route Timeline Tracker with Violet Accents */}
                      <div className="grid grid-cols-1 md:grid-cols-3 items-center pt-2 gap-4 md:gap-0">
                        
                        {/* Origin Station & Departure Time */}
                        <div className="text-left space-y-1">
                          <p className="text-xs md:text-sm font-bold text-neutral-700 tracking-tight leading-tight">
                            {(trip as any).origin || 'Dar es Salaam'}
                          </p>
                          <p className="text-xl md:text-2xl font-black text-[#7c3aed] tracking-tight">
                            {(trip as any).departureTime || '06:00 AM'}
                          </p>
                        </div>

                        {/* Dashed Timeline Tracker */}
                        <div className="flex flex-col items-center justify-center space-y-2 py-2 md:py-0">
                          <div className="w-full flex items-center gap-1">
                            <div className="flex-1 border-t border-dashed border-[#8b5cf6]/35" />
                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm border border-violet-100 shrink-0 select-none">
                              <Bus className="w-4 h-4 text-[#7c3aed]" />
                            </div>
                            <div className="flex-1 border-t border-dashed border-[#8b5cf6]/35" />
                          </div>
                          <span className="text-xs font-bold text-neutral-500 tracking-tight">
                            {(trip as any).duration || '08h 30m'}
                          </span>
                        </div>

                        {/* Destination Station & Arrival Time */}
                        <div className="text-right space-y-1">
                          <p className="text-xs md:text-sm font-bold text-neutral-700 tracking-tight leading-tight">
                            {(trip as any).destination || 'Arusha'}
                          </p>
                          <p className="text-xl md:text-2xl font-black text-[#7c3aed] tracking-tight">
                            {(trip as any).arrivalTime || '02:30 PM'}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Accessories Strip */}
                      <div className="flex items-center justify-between pt-4 border-t border-dashed border-neutral-200/60">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 rounded-xl text-neutral-600 border border-neutral-200/40 select-none">
                            <Armchair className="w-4 h-4 text-violet-500" />
                            <span className="text-xs font-bold text-neutral-500">{(trip as any).availableSeats || '45'} Viti vimebaki</span>
                          </div>
                          
                          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-violet-50/50 rounded-xl text-[#7c3aed] border border-violet-100 select-none">
                            <Info className="w-4 h-4 text-violet-500" />
                            <span className="text-xs font-bold">WiFi & AC ya Kifahari</span>
                          </div>
                        </div>

                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/product/${trip.id}?booking=true&date=${search.date}`);
                          }}
                          className="rounded-2xl bg-neutral-900 hover:bg-[#7c3aed] text-white font-bold uppercase tracking-wider text-xs px-6 h-11 transition-all duration-300 shadow-md"
                        >
                          Kata Tiketi / Book
                        </Button>
                      </div>

                      {/* Expanded interactive tabs matching the user travel style design mock */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pt-6 border-t border-neutral-200/60 mt-4 text-left space-y-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Tab Select Bar */}
                            <div className="flex border-b border-neutral-200 justify-start text-xs md:text-sm font-bold text-neutral-400 gap-1 md:gap-4 overflow-x-auto pb-0.5 scrollbar-hide">
                              <button
                                type="button"
                                onClick={() => setActiveTab('amenities')}
                                className={`pb-3 px-3 md:px-4 uppercase tracking-wider relative transition-all shrink-0 ${
                                  activeTab === 'amenities' ? 'text-[#7c3aed]' : 'hover:text-neutral-700'
                                }`}
                              >
                                AMENITIES
                                {activeTab === 'amenities' && (
                                  <motion.div layoutId="busActiveTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />
                                )}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setActiveTab('reviews')}
                                className={`pb-3 px-3 md:px-4 uppercase tracking-wider relative transition-all shrink-0 ${
                                  activeTab === 'reviews' ? 'text-[#7c3aed]' : 'hover:text-neutral-700'
                                }`}
                              >
                                REVIEW
                                {activeTab === 'reviews' && (
                                  <motion.div layoutId="busActiveTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />
                                )}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setActiveTab('cancellation')}
                                className={`pb-3 px-3 md:px-4 uppercase tracking-wider relative transition-all shrink-0 ${
                                  activeTab === 'cancellation' ? 'text-[#7c3aed]' : 'hover:text-neutral-700'
                                }`}
                              >
                                CANCELLATION POLICY
                                {activeTab === 'cancellation' && (
                                  <motion.div layoutId="busActiveTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed]" />
                                )}
                              </button>
                            </div>

                            {/* Active Panel View */}
                            <div className="pt-2">
                              {activeTab === 'amenities' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {[
                                    { label: 'Wifi', icon: Wifi },
                                    { label: 'Water Bottle', icon: Sparkles },
                                    { label: 'Charging Point', icon: Plug },
                                    { label: 'Music', icon: Headphones },
                                    { label: 'Medical Kit', icon: Shield },
                                    { label: 'Live Tracking', icon: MapPin }
                                  ].map((item, key) => (
                                    <div 
                                      key={key} 
                                      className="bg-white border border-neutral-200/50 hover:border-violet-300 rounded-[2rem] flex items-center p-2.5 gap-4 shadow-sm transition-all"
                                    >
                                      <div className="w-10 h-10 rounded-full bg-violet-50/50 border border-violet-100 flex items-center justify-center shrink-0">
                                        <item.icon className="w-4 h-4 text-[#7c3aed]" />
                                      </div>
                                      <span className="text-sm font-bold text-neutral-800">{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {activeTab === 'reviews' && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-4 bg-violet-50/40 p-4 rounded-3xl border border-violet-100/30">
                                    <div className="text-center shrink-0">
                                      <h5 className="text-3xl font-black text-[#7c3aed]">4.8</h5>
                                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">kati ya 5</p>
                                    </div>
                                    <div className="h-10 w-px bg-neutral-200" />
                                    <div className="text-left">
                                      <div className="flex items-center gap-0.5 text-orange-400">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <Star key={s} className="w-3.5 h-3.5 fill-current" />
                                        ))}
                                      </div>
                                      <p className="text-xs font-bold text-neutral-500 mt-1">98% ya abiria wameidhinisha safari hii kama ya Kifahari</p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2.5">
                                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/40 text-left">
                                      <p className="text-xs font-medium italic text-neutral-600 leading-relaxed">
                                        "Kilimanjaro Express ndio basi langu kila nikisafiri kati ya Dar na Arusha. Wana nidhamu sana, na viti vina nafasi kubwa ya kutosha."
                                      </p>
                                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dotted border-neutral-100">
                                        <span className="text-[10px] font-black text-neutral-400">— Juma M. (Verified Passenger)</span>
                                        <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase">Imethibitishwa</span>
                                      </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/40 text-left">
                                      <p className="text-xs font-medium italic text-neutral-600 leading-relaxed">
                                        "Basi lilikuwa safi sana, na WiFi yao ilikuwa thabiti kipindi chote cha safari. Ni thamani halisi ya pesa yako."
                                      </p>
                                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dotted border-neutral-100">
                                        <span className="text-[10px] font-black text-neutral-400">— Amina Salum</span>
                                        <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase">Imethibitishwa</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeTab === 'cancellation' && (
                                <div className="space-y-4 p-5 bg-white rounded-[2rem] border border-neutral-200/40 text-left">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center shrink-0 text-green-600 mt-0.5">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-neutral-800">Kughairi Bure (100% Refund)</p>
                                      <p className="text-[11px] text-neutral-500 leading-relaxed">Inatumika ukighairi zaidi ya masaa 24 kabla ya muda uliopangwa kuondoka.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0 text-orange-600 mt-0.5">
                                      <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-neutral-800">Urejeshaji Nusu (50% Refund)</p>
                                      <p className="text-[11px] text-neutral-500 leading-relaxed">Inaruhusiwa ukighairi ndani ya muda wa masaa 12 hadi 24 kabla ya kuanza safari.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center shrink-0 text-red-600 mt-0.5">
                                      <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-neutral-800">Hakuna Kurudishiwa (No Refund)</p>
                                      <p className="text-[11px] text-neutral-500 leading-relaxed">Kughairi safari katika kipindi cha chini ya masaa 12 kabla ya safari hakutahusisha marejesho yoyote ya nauli.</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {hasSearched && results.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center space-y-4"
              >
                <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-black text-neutral-900 uppercase italic">Safari haijapatikana</h4>
                  <p className="text-sm text-neutral-400 font-medium">Jaribu kubadilisha tarehe au mji unapotafuta.</p>
                </div>
                <Button variant="outline" className="rounded-xl border-2 border-neutral-100" onClick={() => {
                  setSearch({ origin: '', destination: '', date: search.date });
                  setHasSearched(false);
                }}>
                  Onyesha Mabasi Yote
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Featured Routes */}
      {!hasSearched && (
        <div className="max-w-4xl mx-auto space-y-6 pt-10">
          <div className="space-y-1">
            <h3 className="font-black text-xl text-neutral-900 uppercase italic tracking-tighter">Njia Maarufu (Hot Routes)</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Njia zinazosafiriwa zaidi leo</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { from: 'Dar', to: 'Arusha', price: '35,000' },
              { from: 'Dar', to: 'Mwanza', price: '60,000' },
              { from: 'Dar', to: 'Dodoma', price: '25,000' },
              { from: 'Arusha', to: 'Nairobi', price: '45,000' },
            ].map((route, i) => (
              <motion.div 
                key={`route-card-${route.from}-${route.to}-${i}`} 
                whileHover={{ scale: 1.05 }}
                className="bg-white p-6 rounded-[2rem] border-2 border-neutral-100 shadow-xl shadow-neutral-900/5 cursor-pointer relative overflow-hidden group"
                onClick={() => {
                  setSearch({ ...search, origin: route.from, destination: route.to });
                  handleSearch(route.from, route.to);
                }}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-neutral-50 rounded-bl-[2rem] flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-orange-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">{route.from}</p>
                  <ArrowRight className="w-4 h-4 text-neutral-300" />
                  <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest leading-none mt-1">{route.to}</p>
                </div>
                <p className="mt-4 text-sm font-black text-neutral-900 italic">TZS {route.price}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
