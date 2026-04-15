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

function LocationMarker({ position, setPosition }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void }) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
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

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(newPos);
          setIsLocating(false);
          // In a real app, you'd reverse geocode here
          setAddress(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.error(error);
          setIsLocating(false);
        }
      );
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
                className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-neutral-200 gap-2 text-neutral-600"
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
              <LocationMarker position={position} setPosition={setPosition} />
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
              <div>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Anwani Iliyochaguliwa</p>
                <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                  {address || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`}
                </p>
              </div>
            </div>
            <Button 
              className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-lg font-bold shadow-lg shadow-orange-200"
              onClick={handleConfirm}
            >
              Thibitisha Mahali
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
