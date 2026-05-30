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
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BusBookingProps {
  vendors: VendorProfile[];
  products: Product[];
}

export default function BusBooking({ vendors, products }: BusBookingProps) {
  const navigate = useNavigate();
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

  const handleSearch = () => {
    setIsSearching(true);
    setHasSearched(true);
    
    // Simulate search delay
    setTimeout(() => {
      const filtered = products.filter(p => {
        const isBus = p.vendorCategory === 'bus_ticket';
        const matchesOrigin = !search.origin || (p as any).origin?.toLowerCase().includes(search.origin.toLowerCase());
        const matchesDest = !search.destination || (p as any).destination?.toLowerCase().includes(search.destination.toLowerCase());
        return isBus && matchesOrigin && matchesDest;
      });
      setResults(filtered);
      setIsSearching(false);
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
                <div className="hidden md:block absolute -left-8 top-1/2 -translate-y-1/2 z-20">
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
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
              return (
                <motion.div
                  key={`trip-${trip.id}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group"
                  onClick={() => navigate(`/product/${trip.id}?booking=true`)}
                >
                  <Card className="overflow-hidden rounded-[2rem] border-2 border-neutral-100 hover:border-orange-500/30 transition-all cursor-pointer group-hover:shadow-2xl group-hover:shadow-orange-600/5">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row items-stretch">
                        {/* Vendor & Bus Branding */}
                        <div className="w-full md:w-64 bg-neutral-50 p-6 flex flex-col items-center justify-center space-y-4 border-r border-neutral-100">
                          <div className="w-20 h-20 bg-white rounded-3xl p-1 shadow-xl border border-neutral-100 relative group-hover:scale-105 transition-transform duration-500">
                            <img 
                              src={vendor?.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor?.businessName || 'Bus'}`} 
                              alt="Bus Logo" 
                              className="w-full h-full object-contain rounded-2xl"
                            />
                            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                          </div>
                          <div className="text-center">
                            <h4 className="font-black text-lg text-neutral-900 uppercase italic tracking-tighter leading-tight">
                              {vendor?.businessName}
                            </h4>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-orange-500 fill-current" />
                              <span className="text-[10px] font-black text-neutral-600">4.8 (320 Reviews)</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-white border-neutral-100 text-[9px] uppercase font-bold tracking-widest text-neutral-400">
                            Luxury Bus
                          </Badge>
                        </div>

                        {/* Trip Details */}
                        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-8 md:gap-12 flex-1">
                              {/* From */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                                  Ondoka 
                                  {(trip as any).branchId && branches.find(b => b.id === (trip as any).branchId) && (
                                    <span className="text-orange-600">({branches.find(b => b.id === (trip as any).branchId)?.name})</span>
                                  )}
                                </p>
                                <h5 className="text-2xl font-black text-neutral-900">{(trip as any).departureTime || '06:00'}</h5>
                                <p className="text-xs font-bold text-neutral-500 uppercase italic">{(trip as any).origin || 'Dar'}</p>
                              </div>

                              {/* Duration line */}
                              <div className="flex-1 flex flex-col items-center gap-2 max-w-[100px]">
                                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-tighter">{(trip as any).duration || '12h'}</p>
                                <div className="w-full h-0.5 bg-neutral-100 rounded-full relative">
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-neutral-200 rotate-45" />
                                  <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-neutral-300" />
                                  <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-600" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Bus className="w-3 h-3 text-neutral-300" />
                                </div>
                              </div>

                              {/* To */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Fika</p>
                                <h5 className="text-2xl font-black text-neutral-900">{(trip as any).arrivalTime || '18:00'}</h5>
                                <p className="text-xs font-bold text-neutral-500 uppercase italic">{(trip as any).destination || 'Arusha'}</p>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Tiketi</p>
                              <p className="text-2xl font-black text-orange-600 tracking-tighter italic">
                                TZS {trip.price.toLocaleString()}
                              </p>
                              <p className="text-[9px] text-green-600 font-bold uppercase mt-1">Free Cancellation</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-dashed border-neutral-100">
                             <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 rounded-xl text-neutral-600">
                                  <Armchair className="w-3.5 h-3.5 text-orange-500" />
                                  <span className="text-[10px] font-black uppercase tracking-tight">{(trip as any).availableSeats || '45'} Seats left</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/50 rounded-xl text-blue-600">
                                  <Info className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase tracking-tight">Wi-Fi & AC</span>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                               <div className="sm:hidden text-right mr-4">
                                 <p className="text-xl font-black text-orange-600 italic">TZS {trip.price.toLocaleString()}</p>
                               </div>
                               <Button className="rounded-2xl bg-neutral-900 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[10px] px-6 h-11 transition-all">
                                 Book Ticket
                               </Button>
                             </div>
                          </div>
                        </div>
                      </div>
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
                  handleSearch();
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
