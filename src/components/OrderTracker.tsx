import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Navigation, 
  MapPin, 
  Phone, 
  MessageSquare, 
  Clock, 
  CheckCircle2,
  Package,
  Truck,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderTrackerProps {
  order: Order;
  onBack: () => void;
}

export default function OrderTracker({ order, onBack }: OrderTrackerProps) {
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [vendorLocation, setVendorLocation] = useState<[number, number] | null>(null);
  const [customerLocation, setCustomerLocation] = useState<[number, number] | null>(null);

  // Custom Icons
  const driverIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="bg-orange-600 text-white p-2 rounded-full shadow-lg border-2 border-white animate-bounce">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });

  const vendorIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="bg-emerald-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-2.4-1.4l-.4-.8a2.7 2.7 0 0 0-4.4 0l-.4.8a2.7 2.7 0 0 1-2.4 1.4 2.7 2.7 0 0 1-2.4-1.4l-.4-.8a2.7 2.7 0 0 0-4.4 0l-.4.8A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });

  const customerIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });

  useEffect(() => {
    if (!order.riderId) return;

    const unsub = onSnapshot(doc(db, 'drivers', order.riderId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.location) {
          setDriverLocation([data.location.lat, data.location.lng]);
        }
        setDriverProfile(data);
      }
    });

    return () => unsub();
  }, [order.riderId]);

  useEffect(() => {
    const fetchLocations = async () => {
      // Vendor Location
      try {
        const vSnap = await getDoc(doc(db, 'vendors', order.vendorId));
        if (vSnap.exists() && vSnap.data().location) {
          setVendorLocation([vSnap.data().location.lat, vSnap.data().location.lng]);
        }
      } catch (e) { console.error(e); }

      // In real app, order would have delivery coordinates. 
      // For now we'll mock it if not present based on address or static
      setCustomerLocation([-6.7924, 39.2083]); // Mock location in Dar
    };

    fetchLocations();
  }, [order.vendorId]);

  function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      if (center) map.flyTo(center, 15);
    }, [center]);
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white dark:bg-neutral-950 flex flex-col md:flex-row transition-colors duration-500">
      {/* Sidebar Info */}
      <div className="w-full md:w-96 bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 flex flex-col z-[210] shadow-2xl">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-orange-600 font-black uppercase tracking-widest text-[10px] mb-6 hover:translate-x-[-4px] transition-transform"
          >
            <ChevronLeft className="w-4 h-4" />
            Rudi Kwenye Oda
          </button>
          
          <div className="flex items-center justify-between items-start">
             <div>
               <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest mb-1">Status ya Oda</p>
               <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase italic tracking-tighter">
                 {order.status === 'out_for_delivery' ? 'Njiani Inakuja' : 'Tayari Kwa Safari'}
               </h2>
             </div>
             <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center text-orange-600">
               <Truck className="w-6 h-6" />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
           {/* Driver Profile */}
           {driverProfile ? (
             <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-[2rem] p-6 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-2xl bg-orange-200 dark:bg-orange-900/40 overflow-hidden shrink-0 border-2 border-white dark:border-neutral-800 shadow-md">
                     <img src={driverProfile.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${driverProfile.businessName}`} alt="" className="w-full h-full object-cover" />
                   </div>
                   <div className="min-w-0">
                     <h3 className="font-black text-lg text-neutral-900 dark:text-white truncate uppercase mt-[-4px]">{driverProfile.displayName || driverProfile.businessName}</h3>
                     <div className="flex items-center gap-2 mt-1">
                       <ShieldCheck className="w-4 h-4 text-emerald-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Verified Driver</span>
                     </div>
                   </div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2">
                    <Phone className="w-4 h-4" />
                    Piga Simu
                  </Button>
                  <Button variant="outline" className="w-12 h-12 rounded-xl border-neutral-200 dark:border-neutral-700 flex items-center justify-center dark:bg-neutral-800 dark:text-white">
                    <MessageSquare className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
                  </Button>
                </div>

                <div className="pt-4 border-t border-neutral-200/50 dark:border-neutral-700">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-bold uppercase tracking-widest">Usafiri</span>
                    <span className="font-black text-neutral-900 dark:text-white">{driverProfile.vehicleBrand} {driverProfile.vehicleModel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-neutral-400 font-bold uppercase tracking-widest">Plate Number</span>
                    <span className="bg-white dark:bg-neutral-800 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 font-black text-neutral-900 dark:text-white">{driverProfile.licensePlate || 'T 456 ABC'}</span>
                  </div>
                </div>
             </div>
           ) : (
             <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-[2rem] animate-pulse">
                <div className="w-16 h-16 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-4" />
                <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 mx-auto rounded-full" />
                <p className="text-xs text-neutral-400 mt-4">Kutafuta dereva...</p>
             </div>
           )}

           {/* Progress Steps */}
           <div className="space-y-6">
              {[
                { label: 'Oda Imechakatwa', done: true, icon: CheckCircle2 },
                { label: 'Maandalizi Kakamilika', done: true, icon: Package },
                { label: 'Dereva Amepokea', done: order.status === 'out_for_delivery' || order.status === 'delivered', icon: Navigation },
                { label: 'Njiani kwako', done: order.status === 'out_for_delivery', current: true, icon: Truck },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-4 relative group">
                  {idx < 3 && (
                    <div className={`absolute left-4 top-8 bottom-[-24px] w-0.5 ${step.done ? 'bg-orange-600' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${step.done ? 'bg-orange-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div className="pt-1">
                    <p className={`text-xs font-black uppercase tracking-widest ${step.done ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>{step.label}</p>
                    {step.current && <span className="text-[10px] text-orange-600 font-bold">Inafanyika sasa</span>}
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 relative">
         <MapContainer 
           center={driverLocation || [-6.7924, 39.2083]} 
           zoom={13} 
           className="w-full h-full"
           zoomControl={false}
         >
           <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
           
           {driverLocation && (
             <>
               <Marker position={driverLocation} icon={driverIcon}>
                 <Popup>Dereva wako hapa</Popup>
               </Marker>
               <MapUpdater center={driverLocation} />
             </>
           )}

           {vendorLocation && (
             <Marker position={vendorLocation} icon={vendorIcon}>
               <Popup>Duka</Popup>
             </Marker>
           )}

           {customerLocation && (
             <Marker position={customerLocation} icon={customerIcon}>
               <Popup>Eneo lako</Popup>
             </Marker>
           )}

           {driverLocation && vendorLocation && (
             <Polyline positions={[driverLocation, vendorLocation]} color="#ea580c" dashArray="10, 10" />
           )}
           {driverLocation && customerLocation && (
             <Polyline positions={[driverLocation, customerLocation]} color="#3b82f6" weight={4} />
           )}
         </MapContainer>

         {/* Floating Map Controls */}
         <div className="absolute top-6 right-6 flex flex-col gap-3 z-[200]">
            <Button variant="secondary" className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-800 shadow-2xl p-0 flex items-center justify-center border border-white/20 dark:border-neutral-700">
              <Navigation className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
            </Button>
            <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-4 rounded-[1.5rem] shadow-2xl border border-white/20 dark:border-neutral-800">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white">Live Tracking Active</span>
               </div>
            </div>
         </div>
      </div>
    </div>

  );
}
