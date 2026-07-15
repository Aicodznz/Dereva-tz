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

  const mapTileUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

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
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f] text-[#f0eeff]' : 'bg-neutral-50 text-neutral-800'} pb-32 font-sans`}>
      <AnimatePresence mode="wait">
        {!selectedRide ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* List Header */}
            <div className={`p-6 flex items-center gap-4 sticky top-0 ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-neutral-800' : 'bg-white/80 border-neutral-200/80'} backdrop-blur-xl z-50 border-b`}>
              <button 
                onClick={() => navigate('/taxi')} 
                className={`w-12 h-12 rounded-2xl ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-350 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50'} border flex items-center justify-center shadow-sm active:scale-95 transition-all`}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className={`text-2xl font-black uppercase tracking-tighter italic ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'}`}>Safari Zangu</h1>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-1">Historia ya safari zako za taxi</p>
              </div>
            </div>

            {/* List Content */}
            <div className="px-6 mt-6 max-w-xl mx-auto space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest italic">Pakia data...</p>
                </div>
              ) : rides.length === 0 ? (
                <div className={`rounded-[2.5rem] p-12 text-center border-2 border-dashed ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200'} shadow-sm`}>
                  <div className={`w-20 h-20 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                    <Car size={40} className="text-neutral-400" />
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tighter italic mb-2 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>Huna Safari Bado</h3>
                  <p className="text-xs text-neutral-500 font-bold leading-relaxed mb-8">Anza safari yako sasa kwa kutumia huduma yetu ya haraka na salama.</p>
                  <button 
                    onClick={() => navigate('/taxi')}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
                  >
                    Agiza Safari Sasa
                  </button>
                </div>
              ) : (
                rides.map((ride) => (
                  <div
                    key={ride.id}
                    onClick={() => setSelectedRide(ride)}
                    className={`rounded-[2rem] p-5 shadow-sm border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800/80 hover:border-neutral-700' : 'bg-white border-neutral-200/60 hover:border-neutral-300'} cursor-pointer active:scale-[0.98] transition-all group`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 ${theme === 'dark' ? 'bg-neutral-800/60' : 'bg-neutral-100'} rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-neutral-200/20`}>
                          {ride.driverInfo?.photo ? (
                            <img src={ride.driverInfo.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Car className="text-indigo-600 w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className={`font-black text-sm uppercase tracking-tighter italic ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-900'}`}>
                              {ride.vehicleType || 'Gari'}
                            </h4>
                            {ride.driverInfo?.rating && (
                              <div className="flex items-center gap-0.5 text-amber-500">
                                <Star size={9} className="fill-amber-500 text-amber-500" />
                                <span className="text-[9px] font-black">{ride.driverInfo.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                            {ride.createdAt ? format(typeof ride.createdAt.toDate === 'function' ? ride.createdAt.toDate() : (ride.createdAt.seconds ? new Date(ride.createdAt.seconds * 1000) : new Date(ride.createdAt)), 'dd MMM, HH:mm') : 'Hivi sasa'}
                          </p>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(ride.status)}`}>
                        {getStatusLabel(ride.status)}
                      </div>
                    </div>

                    <div className="space-y-3 pl-3 my-4">
                      <div className="flex items-start gap-4 relative">
                        <div className="flex flex-col items-center gap-1.5 pt-1.5 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                          <div className={`w-0.5 h-7 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full`} />
                          <div className="w-2 h-2 rounded-full bg-[#D85A30] ring-4 ring-[#D85A30]/10" />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                            {ride.pickup?.address || 'Location unknown'}
                          </p>
                          <p className={`text-xs font-bold truncate mt-4.5 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                            {ride.destination?.address || 'Location unknown'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={`mt-4 pt-4 flex items-center justify-between border-t ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-150'}`}>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">GHARAMA</span>
                        <span className={`text-sm font-black italic tracking-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                          TZS {(ride.fare || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 text-neutral-400 font-black uppercase tracking-widest text-[9px] ${theme === 'dark' ? 'group-hover:text-neutral-200' : 'group-hover:text-neutral-800'} transition-colors`}>
                        Maelezo zaidi <ChevronRight size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="relative"
          >
            {/* Details Header with Back Button */}
            <div className={`p-6 flex items-center gap-4 sticky top-0 ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-neutral-800' : 'bg-white/80 border-neutral-200/80'} backdrop-blur-xl z-50 border-b`}>
              <button 
                onClick={() => setSelectedRide(null)} 
                className={`w-12 h-12 rounded-2xl ${theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-neutral-350 hover:bg-neutral-800' : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50'} border flex items-center justify-center shadow-sm active:scale-95 transition-all`}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className={`text-2xl font-black uppercase tracking-tighter italic ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-800'}`}>Taarifa za Safari</h1>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mt-1">Stakabadhi na maelezo ya safari</p>
              </div>
            </div>

            {/* Offscreen Printable Receipt Preview */}
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
                             url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
                             subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                             maxZoom={22}
                             maxNativeZoom={19}
                             attribution="&copy; Google Maps"
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

            {/* Details Content */}
            <div className="px-6 mt-6 max-w-xl mx-auto space-y-6">
              {/* Driver / Vehicle Card */}
              {selectedRide.driverInfo ? (
                <div className={`p-5 rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/60'} flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full border-2 overflow-hidden flex items-center justify-center ${theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-200'}`}>
                      {selectedRide.driverInfo.photo ? (
                        <img src={selectedRide.driverInfo.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-indigo-500 font-black text-xl">
                          {selectedRide.driverInfo.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">DEREVA</p>
                      <h3 className={`text-xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-900'} leading-snug`}>
                        {selectedRide.driverInfo.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone size={12} className="text-emerald-500" />
                        <span className={`text-[11px] font-bold ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
                          {selectedRide.driverInfo.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0">
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-500/10 border-amber-500/20'} border`}>
                      <Star size={10} className="text-amber-500 fill-amber-500" />
                      <span className="text-[10px] font-black text-amber-600">
                        {(selectedRide.driverInfo.rating || 5.0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`p-5 rounded-[2rem] border ${theme === 'dark' ? 'bg-[#111118] border-neutral-800' : 'bg-white border-neutral-200/60'} flex items-center gap-4 shadow-sm`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-neutral-850 text-indigo-400 border-neutral-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} border shrink-0`}>
                    <Car size={26} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">GARI YA SAFARI</p>
                    <h3 className={`text-lg font-black italic tracking-tighter ${theme === 'dark' ? 'text-[#f0eeff]' : 'text-neutral-900'}`}>
                      {selectedRide.vehicleType || 'Taxi'}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                      ID: #{selectedRide.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>
              )}

              {/* Status and Date badges */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-neutral-800/40 border-neutral-800' : 'bg-white border-neutral-200/60'} shadow-sm`}>
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 italic leading-none">Hali</p>
                  <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${getStatusColor(selectedRide.status)}`}>
                    {getStatusLabel(selectedRide.status)}
                  </span>
                </div>
                <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-neutral-800/40 border-neutral-800' : 'bg-white border-neutral-200/60'} shadow-sm`}>
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 italic leading-none">Iliwekwa</p>
                  <p className={`text-xs font-black italic ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {selectedRide.createdAt ? format(typeof selectedRide.createdAt.toDate === 'function' ? selectedRide.createdAt.toDate() : (selectedRide.createdAt.seconds ? new Date(selectedRide.createdAt.seconds * 1000) : new Date(selectedRide.createdAt)), 'dd MMM, HH:mm') : 'Hivi sasa'}
                  </p>
                </div>
              </div>

              {/* Locations with Timeline */}
              <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-neutral-800/20 border-neutral-800/60' : 'bg-white border-neutral-200/60'} shadow-sm space-y-6`}>
                {/* Pickup */}
                <div className="flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${theme === 'dark' ? 'bg-neutral-850 border-neutral-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    <MapPin size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">KUTOKEA</p>
                    <p className={`text-[13px] font-bold ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'} leading-relaxed`}>
                      {selectedRide.pickup?.address || 'Location data missing'}
                    </p>
                  </div>
                </div>

                {/* Map Integration */}
                {selectedRide.pickup && selectedRide.destination && (
                  <div className={`h-48 w-full rounded-3xl overflow-hidden border relative z-0 ${theme === 'dark' ? 'border-neutral-800' : 'border-neutral-200'}`}>
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
                         subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                         maxZoom={22}
                         maxNativeZoom={19}
                         attribution="&copy; Google Maps"
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
                         opacity={0.7}
                         dashArray="5, 8"
                       />
                       <MapBoundsAdjuster points={[
                         [selectedRide.pickup.lat, selectedRide.pickup.lng],
                         [selectedRide.destination.lat, selectedRide.destination.lng]
                       ]} />
                     </MapContainer>
                  </div>
                )}

                {/* Destination */}
                <div className="flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${theme === 'dark' ? 'bg-neutral-850 border-neutral-800 text-[#D85A30]' : 'bg-[#D85A30]/5 border-[#D85A30]/10 text-[#D85A30]'}`}>
                    <Navigation2 size={20} className="rotate-45" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">KWENDA</p>
                    <p className={`text-[13px] font-bold ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'} leading-relaxed`}>
                      {selectedRide.destination?.address || 'Location data missing'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fare Banner */}
              <div className={`p-6 border rounded-[2rem] shadow-sm ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-200' : 'bg-indigo-50/70 border-indigo-100 text-indigo-950'} flex items-center justify-between`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600/80 mb-1 leading-none">GHARAMA YA SAFARI</span>
                  <span className={`text-2xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-neutral-150' : 'text-indigo-950'}`}>
                    TZS {(selectedRide.fare || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/10">
                  <CreditCard size={24} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={downloadReceipt}
                  className={`w-full py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all border ${theme === 'dark' ? 'bg-neutral-800/60 border-neutral-700 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'}`}
                >
                  <Download size={16} /> Pakua Receipt
                </button>
                {selectedRide.status !== 'completed' && selectedRide.status !== 'cancelled' && (
                  <button 
                    onClick={() => navigate('/taxi')}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/15 active:scale-[0.98] transition-all"
                  >
                    <Car size={16} /> Fuatilia Safari
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaxiHistory;
