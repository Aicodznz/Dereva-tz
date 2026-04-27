import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X, Navigation, Loader2, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

// Fix for default marker icon in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number; address: string };
  vendors?: any[];
  preSelectedVendorId?: string;
  isMapViewOnly?: boolean;
}

function MapController({ center, zoom }: { center: L.LatLng, zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    // Force a reasonable zoom if currently zoomed out too far
    const finalZoom = zoom || (map.getZoom() < 10 ? 14 : map.getZoom());
    map.flyTo(center, finalZoom, { duration: 1.5 });
  }, [center, map, zoom]);
  return null;
}

function AutoFitBounds({ vendors }: { vendors: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (vendors && vendors.length > 0) {
      const validVendors = vendors.filter(v => v.location && v.location.lat && v.location.lng);
      if (validVendors.length > 0) {
        const bounds = L.latLngBounds(validVendors.map(v => [v.location.lat, v.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [vendors, map]);
  return null;
}

// Custom hook to show/hide controls based on interaction
function InteractionHandler({ onInteraction }: { onInteraction: () => void }) {
  useMapEvents({
    mousedown: onInteraction,
    zoomstart: onInteraction,
  });
  return null;
}

function LocationMarker({ position, setPosition, onPositionChange, isMapViewOnly }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void, onPositionChange: (pos: L.LatLng) => void, isMapViewOnly?: boolean }) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      if (isMapViewOnly) return;
      setPosition(e.latlng);
      onPositionChange(e.latlng);
    },
    dragend(e) {
      if (isMapViewOnly) return;
      const center = e.target.getCenter();
      setPosition(center);
      onPositionChange(center);
    }
  });

  if (isMapViewOnly) return null;

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export default function LocationPicker({ isOpen, onClose, onSelect, initialLocation, vendors = [], preSelectedVendorId, isMapViewOnly = false }: LocationPickerProps) {
  const navigate = useNavigate();
  const [position, setPosition] = useState<L.LatLng>(
    new L.LatLng(initialLocation?.lat || -6.7924, initialLocation?.lng || 39.2083) // Default to DSM
  );
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other' | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  // Handle pre-selected vendor
  useEffect(() => {
    if (isOpen && preSelectedVendorId && vendors.length > 0) {
      const vendor = vendors.find(v => v.id === preSelectedVendorId);
      if (vendor && vendor.location) {
        const newPos = new L.LatLng(vendor.location.lat, vendor.location.lng);
        setPosition(newPos);
        setSelectedVendor(vendor);
        setAddress(vendor.address || vendor.businessName);
      }
    }
  }, [isOpen, preSelectedVendorId, vendors]);

  // Custom Icon for Vendors - Matching Screenshot Style (Blue Circle)
  const VendorIcon = L.divIcon({
    html: `<div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.3)] border-2 border-white transform transition-transform hover:scale-110 active:scale-95"><div class="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-bag"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div></div>`,
    className: 'bg-transparent',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  // Reverse geocoding function
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    }
  };

  // Search function
  const handleSearch = async (query: string) => {
    if (!query || query.length < 3) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const newPos = new L.LatLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
        setPosition(newPos);
        setAddress(data[0].display_name);
      } else {
        setError('Mahali hapajapatikana. Jaribu kusechi tena.');
      }
    } catch (err) {
      setError('Imeshindwa kutafuta mahali. Angalia intaneti yako.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen && !address && !initialLocation) {
      handleGetCurrentLocation();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !address && position) {
      reverseGeocode(position.lat, position.lng);
    }
  }, [isOpen]);

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    setError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(newPos);
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setIsLocating(false);
        },
        (err) => {
          if (err.code !== 1) console.warn(err);
          let msg = 'Imeshindwa kupata mahali ulipo.';
          if (err.code === 1) msg = 'Tafadhali ruhusu ruhusa ya mahali (location permission) kwenye browser yako.';
          else if (err.code === 2) msg = 'Mahali hapajapatikana. Angalia GPS yako.';
          else if (err.code === 3) msg = 'Muda wa kutafuta mahali umeisha.';
          setError(msg);
          setIsLocating(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setError('Browser yako haisupport geolocation.');
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    onSelect({
      address: address || `Location (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`,
      lat: position.lat,
      lng: position.lng
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh] shadow-2xl"
        >
          {/* Header */}
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Location Selector</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-sans">Select delivery location</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-neutral-100">
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            {/* Search & Input */}
            {!isMapViewOnly && (
              <div className="p-4 space-y-3 bg-white sticky top-0 z-20">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-orange-600 transition-colors" />
                  <Input 
                    placeholder="Andika anwani au jina la sehemu..." 
                    className="pl-12 h-14 bg-neutral-50 border-none rounded-2xl pr-12 text-base font-medium focus:ring-2 focus:ring-orange-500"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(address)}
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                    </div>
                  )}
                </div>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center gap-3"
                  >
                    <X className="w-4 h-4 shrink-0 bg-red-100 p-0.5 rounded-full" onClick={() => setError(null)} />
                    {error}
                  </motion.div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full h-14 rounded-2xl border-neutral-200 gap-3 text-neutral-600 font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all text-sm uppercase tracking-tighter italic"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                >
                  {isLocating ? <Loader2 className="w-5 h-5 animate-spin text-orange-600" /> : <Navigation className="w-5 h-5 text-orange-600 animate-pulse" />}
                  Tumia Mahali Nilipo Sasa
                </Button>
              </div>
            )}

            {/* Map Area */}
            <div className="relative h-[450px] shrink-0 bg-neutral-100 mx-4 rounded-3xl overflow-hidden border-2 border-neutral-50 shadow-inner">
              {/* Map Type Toggle */}
              <div className="absolute top-4 left-4 z-[1000] flex bg-white/90 backdrop-blur-md rounded-xl p-1 shadow-lg border border-white/50">
                <button 
                  onClick={() => setMapType('standard')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mapType === 'standard' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Map
                </button>
                <button 
                  onClick={() => setMapType('satellite')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mapType === 'satellite' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Satellite
                </button>
              </div>

              <MapContainer 
                center={position} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url={mapType === 'satellite' 
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                  attribution='&copy; ESRI &copy; OpenStreetMap'
                />
                <MapController center={position} />
                <AutoFitBounds vendors={vendors} />
                <InteractionHandler onInteraction={() => {}} />
                <LocationMarker 
                  position={position} 
                  setPosition={setPosition} 
                  isMapViewOnly={isMapViewOnly}
                  onPositionChange={(pos) => {
                    reverseGeocode(pos.lat, pos.lng);
                    setSelectedVendor(null); // Clear selection when user moves marker
                  }} 
                />
                
                {/* Vendor Markers */}
                {vendors?.map((v) => v.location && (
                  <Marker 
                    key={v.id} 
                    position={[v.location.lat, v.location.lng]} 
                    icon={VendorIcon}
                    eventHandlers={{
                      click: () => {
                        setSelectedVendor(v);
                        setPosition(new L.LatLng(v.location.lat, v.location.lng));
                      }
                    }}
                  />
                ))}
              </MapContainer>

              {/* No Stores Found Banner */}
              {vendors.length === 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1002] pointer-events-none">
                   <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-[2rem] shadow-2xl border border-white flex flex-col items-center gap-3 w-64 text-center">
                      <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                         <X className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="text-xs font-black uppercase text-neutral-900 tracking-tight">Hakuna Maduka</p>
                         <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">No active stores found in the database currently.</p>
                      </div>
                   </div>
                </div>
              )}

              {/* Fit to Stores Button UI */}
              {vendors.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
                   <button 
                      onClick={() => {
                        const validVendors = vendors.filter(v => v.location);
                        if (validVendors.length > 0) {
                           const firstVendor = validVendors[0];
                           setPosition(new L.LatLng(firstVendor.location.lat, firstVendor.location.lng));
                        }
                      }}
                      className="bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all transform active:scale-95"
                   >
                      <Star className="w-4 h-4" />
                      Onyesha Maduka Yote
                   </button>
                </div>
              )}
              
              {!isMapViewOnly && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] mb-5">
                   <MapPin className="w-10 h-10 text-orange-600 drop-shadow-lg animate-bounce" />
                </div>
              )}

              {/* Selected Vendor Card Overlay - RECREATING SCREENSHOT UI */}
              <AnimatePresence>
                {selectedVendor && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="absolute top-20 left-4 right-4 z-[1001]"
                  >
                    <div 
                      onClick={() => {
                        onClose();
                        navigate(`/vendor/${selectedVendor.id}`);
                      }}
                      className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-white p-0 cursor-pointer group/card"
                    >
                       <div className="h-32 relative overflow-hidden">
                          <img 
                            src={selectedVendor.bannerUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
                            alt="" 
                            className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                             <div className="flex items-center gap-2 text-white font-black uppercase text-[10px] tracking-widest bg-orange-600 px-6 py-2.5 rounded-full transform translate-y-4 group-hover/card:translate-y-0 transition-all">
                                Tembelea Duka <ArrowRight className="w-4 h-4" />
                             </div>
                          </div>
                          <div className="absolute top-3 right-3 z-10">
                             <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVendor(null);
                                }}
                                className="w-8 h-8 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
                             >
                                <X className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                       <div className="p-6 pt-2 flex gap-4 relative">
                          <div className="w-16 h-16 bg-white rounded-2xl shadow-2xl p-1 -mt-10 relative z-20 border-4 border-white overflow-hidden shrink-0">
                             <img 
                                src={selectedVendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedVendor.businessName}`} 
                                alt="" 
                                className="w-full h-full object-contain rounded-xl"
                                referrerPolicy="no-referrer"
                             />
                          </div>
                          <div className="flex-1 flex flex-col justify-center min-w-0">
                             <div className="flex items-center justify-between gap-2">
                                <h4 className="font-black text-lg text-neutral-900 truncate uppercase tracking-tight">{selectedVendor.businessName}</h4>
                                <div className="flex items-center gap-1 shrink-0">
                                   <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                                   <span className="text-xs font-black text-neutral-900">{selectedVendor.rating || '5.00'} (1)</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                <p className="text-[11px] text-neutral-400 font-bold truncate uppercase tracking-tighter">{selectedVendor.address || 'Shop No. 22, Elegant Tower, New...'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-4 space-y-6">
              {!isMapViewOnly && (
                <div className="flex items-start gap-4 p-4 bg-neutral-50 rounded-3xl border border-neutral-100 group hover:border-orange-100 transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest italic">Anwani Iliyochaguliwa</p>
                    <p className="text-sm font-bold text-neutral-900 mt-1">
                      {address || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Save As Labels */}
              {!isMapViewOnly && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">Hifadhi kama:</p>
                  <div className="flex gap-3">
                    {[
                      { id: 'Home', icon: '🏠', label: 'Nyumbani' },
                      { id: 'Work', icon: '💼', label: 'Ofisini' },
                      { id: 'Other', icon: '📍', label: 'Ingine' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setLabel(item.id as any)}
                        className={`flex-1 flex flex-col items-center gap-1.5 p-4 rounded-3xl border-2 transition-all ${
                          label === item.id 
                            ? 'border-orange-600 bg-orange-50 text-orange-600 shadow-lg shadow-orange-100 scale-105 z-10' 
                            : 'border-neutral-50 bg-neutral-50 text-neutral-500 hover:border-neutral-200'
                        }`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter italic">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Sticky at bottom */}
          {!isMapViewOnly && (
            <div className="p-6 bg-white border-t border-neutral-100 shrink-0">
              <Button 
                className="w-full h-16 bg-blue-600 hover:bg-neutral-900 text-white rounded-[2rem] text-xl font-black italic uppercase tracking-tighter shadow-2xl shadow-blue-600/30 gap-3 transition-all transform active:scale-[0.96]"
                onClick={handleConfirm}
              >
                Confirm Location
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
