import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, X, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';

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
}

function LocationMarker({ position, setPosition, onPositionChange }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void, onPositionChange: (pos: L.LatLng) => void }) {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo(position, map.getZoom());
  }, [position, map]);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onPositionChange(e.latlng);
    },
    dragend(e) {
      const center = e.target.getCenter();
      setPosition(center);
      onPositionChange(center);
    }
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export default function LocationPicker({ isOpen, onClose, onSelect, initialLocation }: LocationPickerProps) {
  const [position, setPosition] = useState<L.LatLng>(
    new L.LatLng(initialLocation?.lat || -6.7924, initialLocation?.lng || 39.2083) // Default to DSM
  );
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other' | null>(null);

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
          console.error(err);
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
              <h2 className="text-xl font-bold text-neutral-900">Chagua Mahali</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Select delivery location</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-neutral-100">
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            {/* Search & Input */}
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

            {/* Map Area */}
            <div className="relative h-[300px] shrink-0 bg-neutral-100 mx-4 rounded-3xl overflow-hidden border-2 border-neutral-50">
              <MapContainer 
                center={position} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <LocationMarker 
                  position={position} 
                  setPosition={setPosition} 
                  onPositionChange={(pos) => reverseGeocode(pos.lat, pos.lng)} 
                />
              </MapContainer>
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] mb-5">
                 <MapPin className="w-10 h-10 text-orange-600 drop-shadow-lg animate-bounce" />
              </div>
            </div>

            <div className="p-4 space-y-6">
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

              {/* Save As Labels */}
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
            </div>
          </div>

          {/* Footer - Sticky at bottom */}
          <div className="p-6 bg-white border-t border-neutral-100 shrink-0">
            <Button 
              className="w-full h-16 bg-orange-600 hover:bg-neutral-900 text-white rounded-[2rem] text-xl font-black italic uppercase tracking-tighter shadow-2xl shadow-orange-600/30 gap-3 transition-all transform active:scale-[0.96]"
              onClick={handleConfirm}
            >
              <MapPin className="w-6 h-6" />
              Hifadhi na Thibitisha
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
