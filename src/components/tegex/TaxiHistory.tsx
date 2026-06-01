import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Car, Clock, CheckCircle2, ChevronRight, 
  MapPin, User, Phone, Map, Download, X,
  Navigation2, CreditCard, Star, Calendar, Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../AuthContext';
import { useTheme } from 'next-themes';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { getMapBounds } from '../../utils/mapHelpers';

const PickupIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'bg-transparent',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const DestinationIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-[#D85A30] rounded-full flex items-center justify-center border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`,
  className: 'bg-transparent',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const MapBoundsAdjuster = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    const bounds = getMapBounds(points);
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
};

interface Ride {
  id: string;
  status: 'pending' | 'accepted' | 'driver_arriving' | 'driver_arrived' | 'on_trip' | 'completed' | 'cancelled' | 'rated';
  createdAt: any;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  fare: number;
  vehicleType: string;
  driverId: string | null;
  driverInfo?: {
    name: string;
    phone: string;
    photo?: string;
    vehicleType?: string;
    rating?: number;
  };
  paymentMethod?: string;
}

const TaxiHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const mapTileUrl = theme === 'dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    if (!user) return;

    // Use query without orderBy to avoid index requirement
    const q = query(
      collection(db, 'rides'),
      where('customerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rideData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ride[];

      // Sort in memory
      rideData.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return dateB - dateA;
      });

      setRides(rideData);
      setLoading(false);
    }, (error) => {
      console.warn("Restricted access or error listening to taxi history:", error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'rated': return 'text-emerald-500 bg-emerald-500/10';
      case 'cancelled': return 'text-red-500 bg-red-500/10';
      case 'pending': return 'text-orange-500 bg-orange-500/10';
      default: return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Inasubiri';
      case 'accepted':
      case 'driver_arriving': return 'Dereva anakuja';
      case 'driver_arrived': return 'Dereva amefika';
      case 'on_trip': return 'Safarni';
      case 'completed':
      case 'rated': return 'Imekamilika';
      case 'cancelled': return 'Imeghairiwa';
      default: return status;
    }
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    
    try {
      const loadingToast = toast.loading("Inatengeneza stakabadhi...");
      
      // Ensure all images are loaded and map tiles are rendered
      // We use a longer delay and multiple frames to be safe
      await new Promise(resolve => setTimeout(resolve, 1500));

      const dataUrl = await toPng(receiptRef.current, { 
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `papo-hapo-stakabadhi-${selectedRide?.id.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss(loadingToast);
      toast.success("Stakabadhi imepakuliwa!");
    } catch (err) {
      console.error('Failed to download receipt:', err);
      toast.dismiss();
      toast.error("Imeshindwa kupakua stakabadhi.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 pb-32 font-sans text-white">
      <div className="p-6 flex items-center gap-4 sticky top-0 bg-neutral-950/80 backdrop-blur-xl z-50 border-b border-white/5">
        <button onClick={() => navigate('/taxi')} className="w-12 h-12 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center shadow-lg active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter italic">Safari Zangu</h1>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none mt-1">Historia ya safari zako za Taxi</p>
        </div>
      </div>

      <div className="px-6 mt-6 max-w-xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest italic">Pakia data...</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="bg-neutral-900 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-white/5">
            <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Car size={40} className="text-neutral-700" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tighter italic mb-2">Huna Safari Bado</h3>
            <p className="text-xs text-neutral-500 font-bold leading-relaxed mb-8">Anza safari yako sasa kwa kutumia huduma yetu ya haraka na salama.</p>
            <button 
              onClick={() => navigate('/taxi')}
              className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-white/10 active:scale-95 transition-all"
            >
              Agiza Safari Sasa
            </button>
          </div>
        ) : (
          rides.map((ride) => (
            <motion.div
              layoutId={ride.id}
              key={ride.id}
              onClick={() => setSelectedRide(ride)}
              className="bg-neutral-900 rounded-[2rem] p-5 shadow-2xl border border-white/5 cursor-pointer active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center overflow-hidden">
                    {ride.driverInfo?.photo ? (
                      <img src={ride.driverInfo.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Car size={20} className="text-[#1D9E75]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm uppercase tracking-tighter italic">{ride.vehicleType || 'Gari'}</h4>
                      {ride.driverInfo?.rating && (
                        <div className="flex items-center gap-0.5 text-amber-500">
                          <Star size={8} className="fill-amber-500" />
                          <span className="text-[8px] font-black">{ride.driverInfo.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                      {ride.createdAt ? format(typeof ride.createdAt.toDate === 'function' ? ride.createdAt.toDate() : (ride.createdAt.seconds ? new Date(ride.createdAt.seconds * 1000) : new Date(ride.createdAt)), 'dd MMM, HH:mm') : 'Hivi sasa'}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(ride.status)}`}>
                  {getStatusLabel(ride.status)}
                </div>
              </div>

              <div className="space-y-3 pl-2">
                <div className="flex items-start gap-4 h-full relative">
                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
                    <div className="w-0.5 h-6 bg-white/5 rounded-full" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D85A30]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white/90 truncate">{ride.pickup?.address || 'Location unknown'}</p>
                    <p className="text-xs font-bold text-white/90 truncate mt-3">{ride.destination?.address || 'Location unknown'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Gharama</span>
                  <span className="text-sm font-black text-white">TZS {(ride.fare || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400 font-black uppercase tracking-widest text-[9px] group-hover:text-white transition-colors">
                  Maelezo zaidi <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRide(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              layoutId={selectedRide.id}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-lg bg-neutral-900 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-white/10"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#1D9E75]/10 rounded-2xl flex items-center justify-center border border-[#1D9E75]/20">
                      <Car size={28} className="text-[#1D9E75]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter italic">{selectedRide.vehicleType || 'Taxi'}</h2>
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">ID: {selectedRide.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedRide(null)}
                    className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Receipt Preview (What will be downloaded) */}
                <div className="fixed top-0 left-0 pointer-events-none opacity-0 -z-50">
                  <div ref={receiptRef} className="p-10 bg-white text-black w-[400px] font-sans">
                     <div className="text-center mb-8">
                        <h1 className="text-2xl font-black uppercase italic tracking-tighter">PAPO HAPO</h1>
                        <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-neutral-400">Official Ride Receipt</p>
                     </div>
                     <div className="border-t border-b border-dashed border-neutral-200 py-6 my-6 space-y-4">
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-neutral-400 uppercase tracking-widest">Tarehe</span>
                           <span className="font-black">{selectedRide.createdAt ? format(typeof selectedRide.createdAt.toDate === 'function' ? selectedRide.createdAt.toDate() : (selectedRide.createdAt.seconds ? new Date(selectedRide.createdAt.seconds * 1000) : new Date(selectedRide.createdAt)), 'dd MMM yyyy, HH:mm') : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-neutral-400 uppercase tracking-widest">Booking ID</span>
                           <span className="font-black uppercase">{selectedRide.id.slice(0, 12)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-neutral-400 uppercase tracking-widest">Vehicle</span>
                           <span className="font-black uppercase">{selectedRide.vehicleType}</span>
                        </div>
                     </div>
                      <div className="space-y-4 mb-8">
                        <div>
                           <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic">Pickup</p>
                           <p className="text-xs font-bold leading-tight">{selectedRide.pickup?.address || 'Location data missing'}</p>
                        </div>
                        
                        {/* Map in Receipt */}
                        {selectedRide.pickup && selectedRide.destination && (
                          <div className="h-32 w-full rounded-xl overflow-hidden border border-neutral-100 relative my-2">
                             <MapContainer 
                               center={[selectedRide.pickup.lat, selectedRide.pickup.lng]} 
                               zoom={12} 
                               maxZoom={22}
                               zoomControl={false}
                               dragging={false}
                               scrollWheelZoom={false}
                               touchZoom={false}
                               doubleClickZoom={false}
                               boxZoom={false}
                               keyboard={false}
                               className="h-full w-full"
                             >
                               <TileLayer 
                                 url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png" 
                                 maxZoom={22}
                                 maxNativeZoom={19}
                               />
                               <Marker position={[selectedRide.pickup.lat, selectedRide.pickup.lng]} icon={PickupIcon} />
                               <Marker position={[selectedRide.destination.lat, selectedRide.destination.lng]} icon={DestinationIcon} />
                               <Polyline 
                                 positions={[
                                   [selectedRide.pickup.lat, selectedRide.pickup.lng],
                                   [selectedRide.destination.lat, selectedRide.destination.lng]
                                 ]}
                                 color="#1D9E75"
                                 weight={4}
                                 opacity={0.8}
                                 dashArray="5, 10"
                               />
                               <MapBoundsAdjuster points={[
                                 [selectedRide.pickup.lat, selectedRide.pickup.lng],
                                 [selectedRide.destination.lat, selectedRide.destination.lng]
                               ]} />
                             </MapContainer>
                          </div>
                        )}

                        <div>
                           <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic">Dropoff</p>
                           <p className="text-xs font-bold leading-tight">{selectedRide.destination?.address || 'Location data missing'}</p>
                        </div>
                     </div>
                     <div className="bg-neutral-50 p-6 rounded-2xl flex justify-between items-center">
                        <div>
                           <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1 italic">Total Paid</p>
                           <p className="text-xl font-black italic tracking-tighter">TZS {(selectedRide.fare || 0).toLocaleString()}</p>
                        </div>
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white">
                           <CheckCircle2 size={24} />
                        </div>
                     </div>
                     <div className="mt-12 pt-8 border-t border-neutral-100 text-center">
                        <p className="text-[7px] font-black uppercase tracking-widest text-neutral-300">Asante kwa kusafiri na Papo Hapo - Tunahamisha Maisha</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-800/50 p-4 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 italic">Hali</p>
                      <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${getStatusColor(selectedRide.status)}`}>
                        {getStatusLabel(selectedRide.status)}
                      </span>
                    </div>
                    <div className="bg-neutral-800/50 p-4 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 italic">Iliwekwa</p>
                      <p className="text-xs font-black italic">{selectedRide.createdAt ? format(typeof selectedRide.createdAt.toDate === 'function' ? selectedRide.createdAt.toDate() : (selectedRide.createdAt.seconds ? new Date(selectedRide.createdAt.seconds * 1000) : new Date(selectedRide.createdAt)), 'dd MMM, HH:mm') : 'Leo'}</p>
                    </div>
                  </div>

                  {selectedRide.driverInfo && (
                    <div className="p-5 bg-neutral-800/50 rounded-3xl border border-white/5 flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-700">
                          {selectedRide.driverInfo.photo ? (
                            <img src={selectedRide.driverInfo.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-500 font-black text-lg">
                              {selectedRide.driverInfo.name.charAt(0)}
                            </div>
                          )}
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">Dereva</p>
                            <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <Star size={10} className="text-amber-500 fill-amber-500" />
                              <span className="text-[10px] font-black text-amber-500">{selectedRide.driverInfo.rating?.toFixed(1) || '5.0'}</span>
                            </div>
                          </div>
                          <p className="text-lg font-black italic">{selectedRide.driverInfo.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                             <Phone size={12} className="text-[#1D9E75]" />
                             <p className="text-[10px] font-bold text-neutral-400">{selectedRide.driverInfo.phone}</p>
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-neutral-800 rounded-2xl flex items-center justify-center shrink-0 border border-white/5">
                        <MapPin size={20} className="text-[#1D9E75]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Kutokea</p>
                        <p className="text-xs font-bold text-white leading-relaxed">{selectedRide.pickup?.address || 'Location data missing'}</p>
                      </div>
                    </div>

                    {/* Trip Map */}
                    {selectedRide.pickup && selectedRide.destination && (
                      <div className="h-40 w-full rounded-2xl overflow-hidden border border-white/10 relative z-0">
                         <MapContainer 
                           center={[selectedRide.pickup.lat, selectedRide.pickup.lng]} 
                           zoom={13} 
                           maxZoom={22}
                           zoomControl={false}
                           dragging={true}
                           scrollWheelZoom={false}
                           className="h-full w-full"
                         >
                           <TileLayer 
                             url={mapTileUrl} 
                             maxZoom={22}
                             maxNativeZoom={19}
                           />
                           <Marker position={[selectedRide.pickup.lat, selectedRide.pickup.lng]} icon={PickupIcon} />
                           <Marker position={[selectedRide.destination.lat, selectedRide.destination.lng]} icon={DestinationIcon} />
                           <Polyline 
                             positions={[
                               [selectedRide.pickup.lat, selectedRide.pickup.lng],
                               [selectedRide.destination.lat, selectedRide.destination.lng]
                             ]}
                             color="#1D9E75"
                             weight={3}
                             opacity={0.6}
                             dashArray="5, 8"
                           />
                           <MapBoundsAdjuster points={[
                             [selectedRide.pickup.lat, selectedRide.pickup.lng],
                             [selectedRide.destination.lat, selectedRide.destination.lng]
                           ]} />
                         </MapContainer>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-neutral-800 rounded-2xl flex items-center justify-center shrink-0 border border-white/5">
                        <Navigation2 size={20} className="text-[#D85A30]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Kwenda</p>
                        <p className="text-xs font-bold text-white leading-relaxed">{selectedRide.destination?.address || 'Location data missing'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-white rounded-[2rem] text-black shadow-xl shadow-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Gharama ya Safari</span>
                        <span className="text-2xl font-black italic tracking-tighter">TZS {(selectedRide.fare || 0).toLocaleString()}</span>
                      </div>
                      <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-[#1D9E75]">
                        <CreditCard />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={downloadReceipt}
                      className="flex-1 py-5 bg-neutral-800 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                    >
                      <Download size={16} /> Pakua Receipt
                    </button>
                    {selectedRide.status !== 'completed' && selectedRide.status !== 'cancelled' && (
                      <button 
                        onClick={() => navigate('/taxi')}
                        className="flex-1 py-5 bg-[#7F77DD] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-[#7F77DD]/20 active:scale-[0.98] transition-all"
                      >
                        <Car size={16} /> Fuatilia Safari
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaxiHistory;
