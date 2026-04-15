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
          className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Chagua Mahali</h2>
              <p className="text-xs text-neutral-500">Select your delivery location</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Search & Input */}
          <div className="p-4 space-y-3 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input 
                placeholder="Andika anwani au jina la sehemu..." 
                className="pl-10 h-12 bg-neutral-50 border-none rounded-xl pr-12"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(address)}
              />
              {isSearching && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                </div>
              )}
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2"
              >
                <X className="w-4 h-4 shrink-0" onClick={() => setError(null)} />
                {error}
              </motion.div>
            )}

            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-neutral-200 gap-2 text-neutral-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
            >
              {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5 text-orange-600" />}
              Tumia Mahali Nilipo Sasa
            </Button>
          </div>

          {/* Map Area */}
          <div className="flex-1 relative min-h-[300px] bg-neutral-100">
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
            
            {/* Center Pin Overlay (Optional, but Marker is better for clarity) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1000] mb-5">
               <MapPin className="w-10 h-10 text-orange-600 drop-shadow-lg animate-bounce" />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-white border-t border-neutral-100">
            <div className="flex items-start gap-3 mb-4 p-3 bg-orange-50 rounded-2xl">
              <MapPin className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Anwani Iliyochaguliwa</p>
                <p className="text-sm font-medium text-neutral-900 line-clamp-2">
                  {address || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`}
                </p>
              </div>
            </div>

            {/* Save As Labels */}
            <div className="mb-6">
              <p className="text-xs font-bold text-neutral-500 mb-3 uppercase tracking-wider">Hifadhi kama:</p>
              <div className="flex gap-3">
                {[
                  { id: 'Home', icon: '🏠', label: 'Nyumbani' },
                  { id: 'Work', icon: '💼', label: 'Ofisini' },
                  { id: 'Other', icon: '📍', label: 'Ingine' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLabel(item.id as any)}
                    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
                      label === item.id 
                        ? 'border-orange-600 bg-orange-50 text-orange-600' 
                        : 'border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-[10px] font-bold uppercase">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button 
              className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-lg font-bold shadow-lg shadow-orange-200 gap-2 transition-all transform active:scale-[0.98]"
              onClick={handleConfirm}
            >
              <MapPin className="w-5 h-5" />
              Hifadhi na Thibitisha
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
