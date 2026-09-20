import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, X, Navigation, Loader2, Star, ArrowRight, Package, Clock, RotateCw, Layers, Camera, Volume2, CheckCircle2, Play, ExternalLink, Car, Flame, Check } from 'lucide-react';
import { AISmartHeatMap } from './map/AISmartHeatMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import ARMapView from './map/ARMapView';
import { useBusinessConfig } from '../BusinessConfigContext';
import { useNearbyDrivers } from '../hooks/useNearbyDrivers';
// Fix for default marker icon in Leaflet - using CDN for maximum stability in preview environment
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Custom Icon for Vendors - Dynamic based on category
const getVendorIcon = (category: string = '') => {
  const cat = category.toLowerCase();
  let iconSvg = '';
  let bgColor = 'bg-blue-600'; // Default blue

  if (cat.includes('chakula') || cat.includes('food') || cat.includes('mgahawa') || cat.includes('restaurant')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
    bgColor = 'bg-red-500';
  } else if (cat.includes('soko') || cat.includes('grocery') || cat.includes('market')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-basket"><path d="m5 11 4-7"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="M9 11v1.5"/><path d="M15 11v1.5"/></svg>`;
    bgColor = 'bg-green-600';
  } else if (cat.includes('bus') || cat.includes('ticket') || cat.includes('basi')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bus"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 19v2"/></svg>`;
    bgColor = 'bg-orange-600';
  } else if (cat.includes('dawa') || cat.includes('pharmacy') || cat.includes('medicine')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pill"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
    bgColor = 'bg-blue-500';
  } else if (cat.includes('saluni') || cat.includes('salon') || cat.includes('kinyozi') || cat.includes('hair')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scissors"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/><path d="M14.8 9.2 20 4"/><path d="M8.12 15.88 12 12"/></svg>`;
    bgColor = 'bg-pink-500';
  } else if (cat.includes('hotel') || cat.includes('malazi') || cat.includes('accommodation') || cat.includes('hoteli')) {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hotel"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><path d="m9 16 .348-.24c1.465-1.013 3.84-1.013 5.304 0L15 16"/><path d="M8 7h.01"/><path d="M16 7h.01"/><path d="M12 7h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/><path d="M10 22v-4a2 2 0 1 1 4 0v4"/></svg>`;
    bgColor = 'bg-indigo-500';
  } else {
    // Default eCommerce / Shopping Bag
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-bag"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    bgColor = 'bg-purple-600';
  }

  return L.divIcon({
    html: `<div class="w-10 h-10 ${bgColor} rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.3)] border-2 border-white transform transition-transform hover:scale-110 active:scale-95"><div class="text-white">${iconSvg}</div></div>`,
    className: 'bg-transparent',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Custom Icon for General Location Selection (Clean standard pin)
const getStandardLocationPinIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center pointer-events-none select-none" style="width: 140px; height: 82px;">
        <!-- Ground target ripple / radar -->
        <div class="absolute bottom-[1px] left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div class="w-10 h-3 rounded-[100%] bg-orange-500/40 animate-ping"></div>
          <div class="absolute w-6 h-2 rounded-[100%] bg-orange-600/60"></div>
          <div class="absolute w-2.5 h-1 rounded-[100%] bg-neutral-950/70 blur-[0.5px]"></div>
        </div>

        <!-- Floating Badge -->
        <div class="mb-0.5 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white text-[8.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-orange-500/50 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-orange-400 font-extrabold">Eneo Lako</span>
        </div>

        <!-- Premium 3D SVG Pin -->
        <svg width="42" height="50" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter drop-shadow-[0_10px_14px_rgba(234,88,12,0.5)]">
          <defs>
            <linearGradient id="stdPinGrad" x1="4" y1="2" x2="40" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FF6B00"/>
              <stop offset="50%" stop-color="#EA580C"/>
              <stop offset="100%" stop-color="#C2410C"/>
            </linearGradient>
            <linearGradient id="stdPinGloss" x1="12" y1="4" x2="32" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M22 0C9.84974 0 0 9.84974 0 22C0 35.2 18.7 48.7 20.8 50.2C21.5 50.7 22.5 50.7 23.2 50.2C25.3 48.7 44 35.2 44 22C44 9.84974 34.1503 0 22 0Z" fill="url(#stdPinGrad)" stroke="#FFFFFF" stroke-width="2.5"/>
          <ellipse cx="22" cy="11" rx="13" ry="6" fill="url(#stdPinGloss)"/>
          <circle cx="22" cy="21" r="11.5" fill="#FFFFFF" />
          <circle cx="22" cy="21" r="6" fill="#EA580C"/>
          <circle cx="22" cy="21" r="2.5" fill="#FFFFFF"/>
          <line x1="22" y1="12" x2="22" y2="14" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="28" x2="22" y2="30" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="13" y1="21" x2="15" y2="21" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="29" y1="21" x2="31" y2="21" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    className: 'bg-transparent',
    iconSize: [140, 82],
    iconAnchor: [70, 80],
  });
};

// Custom Icon for Pickup Location (Mahali pa Kuchukulia)
const getPickupPinIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center pointer-events-none select-none" style="width: 150px; height: 82px;">
        <!-- Ground target ripple / radar -->
        <div class="absolute bottom-[1px] left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div class="w-10 h-3 rounded-[100%] bg-emerald-500/40 animate-ping"></div>
          <div class="absolute w-6 h-2 rounded-[100%] bg-emerald-600/60"></div>
          <div class="absolute w-2.5 h-1 rounded-[100%] bg-neutral-950/70 blur-[0.5px]"></div>
        </div>

        <div class="mb-0.5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-emerald-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-400/50 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>🟢 Mahali pa Kuchukulia</span>
        </div>

        <!-- Premium 3D SVG Pin Emerald -->
        <svg width="42" height="50" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter drop-shadow-[0_10px_14px_rgba(5,150,105,0.5)]">
          <defs>
            <linearGradient id="pickupPinGrad" x1="4" y1="2" x2="40" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#10B981"/>
              <stop offset="50%" stop-color="#059669"/>
              <stop offset="100%" stop-color="#047857"/>
            </linearGradient>
            <linearGradient id="pickupPinGloss" x1="12" y1="4" x2="32" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M22 0C9.84974 0 0 9.84974 0 22C0 35.2 18.7 48.7 20.8 50.2C21.5 50.7 22.5 50.7 23.2 50.2C25.3 48.7 44 35.2 44 22C44 9.84974 34.1503 0 22 0Z" fill="url(#pickupPinGrad)" stroke="#FFFFFF" stroke-width="2.5"/>
          <ellipse cx="22" cy="11" rx="13" ry="6" fill="url(#pickupPinGloss)"/>
          <circle cx="22" cy="21" r="11.5" fill="#FFFFFF" />
          <circle cx="22" cy="21" r="6" fill="#059669"/>
          <circle cx="22" cy="21" r="2.5" fill="#FFFFFF"/>
          <line x1="22" y1="12" x2="22" y2="14" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="28" x2="22" y2="30" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="13" y1="21" x2="15" y2="21" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="29" y1="21" x2="31" y2="21" stroke="#059669" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    className: 'bg-transparent',
    iconSize: [150, 82],
    iconAnchor: [75, 80],
  });
};

// Custom Icon for Drop-off / Delivery Location (Eneo la Kufikisha)
const getDeliveryPinIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center pointer-events-none select-none" style="width: 150px; height: 82px;">
        <!-- Ground target ripple / radar -->
        <div class="absolute bottom-[1px] left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div class="w-10 h-3 rounded-[100%] bg-rose-500/40 animate-ping"></div>
          <div class="absolute w-6 h-2 rounded-[100%] bg-rose-600/60"></div>
          <div class="absolute w-2.5 h-1 rounded-[100%] bg-neutral-950/70 blur-[0.5px]"></div>
        </div>

        <div class="mb-0.5 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 text-rose-100 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-rose-400/50 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
          <span>🔴 Eneo la Kufikisha</span>
        </div>

        <!-- Premium 3D SVG Pin Rose -->
        <svg width="42" height="50" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter drop-shadow-[0_10px_14px_rgba(225,29,72,0.5)]">
          <defs>
            <linearGradient id="deliveryPinGrad" x1="4" y1="2" x2="40" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#F43F5E"/>
              <stop offset="50%" stop-color="#E11D48"/>
              <stop offset="100%" stop-color="#BE123C"/>
            </linearGradient>
            <linearGradient id="deliveryPinGloss" x1="12" y1="4" x2="32" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="M22 0C9.84974 0 0 9.84974 0 22C0 35.2 18.7 48.7 20.8 50.2C21.5 50.7 22.5 50.7 23.2 50.2C25.3 48.7 44 35.2 44 22C44 9.84974 34.1503 0 22 0Z" fill="url(#deliveryPinGrad)" stroke="#FFFFFF" stroke-width="2.5"/>
          <ellipse cx="22" cy="11" rx="13" ry="6" fill="url(#deliveryPinGloss)"/>
          <circle cx="22" cy="21" r="11.5" fill="#FFFFFF" />
          <circle cx="22" cy="21" r="6" fill="#E11D48"/>
          <circle cx="22" cy="21" r="2.5" fill="#FFFFFF"/>
          <line x1="22" y1="12" x2="22" y2="14" stroke="#E11D48" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="28" x2="22" y2="30" stroke="#E11D48" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="13" y1="21" x2="15" y2="21" stroke="#E11D48" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="29" y1="21" x2="31" y2="21" stroke="#E11D48" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    className: 'bg-transparent',
    iconSize: [150, 82],
    iconAnchor: [75, 80],
  });
};

const ParcelPinIcon = getDeliveryPinIcon();

const CurrentLocationPulseIcon = L.divIcon({
  html: `
    <div class="relative w-10 h-10 flex items-center justify-center">
      <div class="absolute w-8 h-8 rounded-full bg-blue-500 opacity-25 animate-ping"></div>
      <div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]"></div>
    </div>
  `,
  className: 'bg-transparent',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Custom Icon for Vehicles - Dynamic based on type and heading
const getVehicleIcon = (vehicleType: string = '', heading: number = 0) => {
  const type = (vehicleType || '').toLowerCase();
  let emoji = '🏍️';
  let color = 'bg-sky-500';

  if (type.includes('bajaj') || type.includes('rickshaw') || type.includes('tuktuk')) {
    emoji = '🛺';
    color = 'bg-amber-500';
  } else if (type.includes('delivery') || type.includes('parcel') || type.includes('cargo') || type.includes('truck')) {
    emoji = '🚚';
    color = 'bg-emerald-500';
  } else if (type.includes('car') || type.includes('mini') || type.includes('gari') || type.includes('xl') || type.includes('cab') || type.includes('taxi')) {
    emoji = '🚗';
    color = 'bg-yellow-500';
  }

  return L.divIcon({
    html: `
      <div class="relative w-10 h-10 flex items-center justify-center">
        <div class="absolute w-10 h-10 rounded-full ${color} opacity-25 animate-ping"></div>
        <div class="w-8 h-8 rounded-full ${color} border-2 border-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center relative transition-transform duration-500" style="transform: rotate(${heading}deg);">
          <div class="absolute -top-1.5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-neutral-900 dark:border-b-white"></div>
          <span class="text-base select-none leading-none">${emoji}</span>
        </div>
      </div>
    `,
    className: 'bg-transparent',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

try {
  L.Marker.prototype.options.icon = DefaultIcon;
} catch (e) {
  console.warn('Failed to set default Leaflet icon:', e);
}

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number; address: string };
  vendors?: any[];
  preSelectedVendorId?: string;
  isMapViewOnly?: boolean;
  useParcelIcon?: boolean;
  pickerType?: 'pickup' | 'delivery' | 'sender' | 'recipient' | 'dropoff' | string;
  title?: string;
  subtitle?: string;
  arRouteId?: string | null;
  zIndex?: string;
}

function MapController({ center, zoom }: { center: L.LatLng, zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    try {
      const currentCenter = map.getCenter();
      const distance = currentCenter.distanceTo(center);
      // If the map is already centered within 10 meters, don't trigger flyTo to avoid fighting user dragging/clicking
      if (distance < 10) return;

      const currentZoom = map.getZoom();
      const finalZoom = zoom || (currentZoom < 10 ? 14 : currentZoom);
      map.flyTo(center, finalZoom, { duration: 1.5 });
    } catch (e) {
      console.warn('Map flyTo failed:', e);
    }
  }, [center?.lat, center?.lng, map, zoom]);
  return null;
}

function AutoFitBounds({ vendors, categoryFilter }: { vendors: any[], categoryFilter: string }) {
  const map = useMap();
  const lastFitFilterRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!vendors || vendors.length === 0) return;
    
    // Only fit bounds if we haven't fitted bounds for this category filter yet
    if (lastFitFilterRef.current === categoryFilter) return;

    const validVendors = vendors.filter(v => v.location && v.location.lat && v.location.lng);
    if (validVendors.length > 0) {
      const bounds = L.latLngBounds(validVendors.map(v => [v.location.lat, v.location.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 20 });
      lastFitFilterRef.current = categoryFilter;
    }
  }, [vendors, categoryFilter, map]);
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

function LocationMarker({ position, setPosition, onPositionChange, isMapViewOnly, icon }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void, onPositionChange: (pos: L.LatLng) => void, isMapViewOnly?: boolean, icon: L.Icon | L.DivIcon }) {
  const markerRef = React.useRef<any>(null);

  useMapEvents({
    click(e) {
      if (isMapViewOnly) return;
      setPosition(e.latlng);
      onPositionChange(e.latlng);
    }
  });

  const eventHandlers = React.useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const latLng = marker.getLatLng();
        setPosition(latLng);
        onPositionChange(latLng);
      }
    },
  }), [setPosition, onPositionChange]);

  return (
    <Marker 
      position={position} 
      icon={icon} 
      draggable={!isMapViewOnly}
      eventHandlers={eventHandlers}
      ref={markerRef}
    />
  );
}

const safeLatLng = (lat: any, lng: any, defaultLat = -6.7924, defaultLng = 39.2083): L.LatLng => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  const finalLat = (lat !== undefined && lat !== null && !isNaN(nLat)) ? nLat : defaultLat;
  const finalLng = (lng !== undefined && lng !== null && !isNaN(nLng)) ? nLng : defaultLng;
  return new L.LatLng(finalLat, finalLng);
};

export default function LocationPicker({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialLocation, 
  vendors = [], 
  preSelectedVendorId, 
  isMapViewOnly = false, 
  useParcelIcon = false, 
  pickerType,
  title,
  subtitle,
  arRouteId = null,
  zIndex,
}: LocationPickerProps) {
  const navigate = useNavigate();
  const { config: businessConfig } = useBusinessConfig();
  const initLat = initialLocation?.lat ?? -6.7924;
  const initLng = initialLocation?.lng ?? (initialLocation as any)?.lon ?? 39.2083;
  const [position, setPosition] = useState<L.LatLng>(() => safeLatLng(initLat, initLng));
  const [userOrigin, setUserOrigin] = useState<L.LatLng | null>(() => safeLatLng(initLat, initLng));
  const [address, setAddress] = useState(initialLocation?.address || '');

  // Detect mode: 'pickup' vs 'delivery' vs 'general' (when not in parcel flow)
  const isParcelFlow = Boolean(
    pickerType === 'sender' || 
    pickerType === 'recipient' || 
    pickerType === 'dropoff' || 
    pickerType === 'pickup' || 
    pickerType === 'parcel' || 
    useParcelIcon
  );

  const initialMode: 'pickup' | 'delivery' | 'general' = !isParcelFlow
    ? 'general'
    : (pickerType === 'sender' || pickerType === 'pickup') 
    ? 'pickup' 
    : 'delivery';

  const [currentMode, setCurrentMode] = useState<'pickup' | 'delivery' | 'general'>(initialMode);

  useEffect(() => {
    if (!isParcelFlow) {
      setCurrentMode('general');
    } else if (pickerType === 'sender' || pickerType === 'pickup') {
      setCurrentMode('pickup');
    } else if (pickerType === 'recipient' || pickerType === 'delivery' || pickerType === 'dropoff') {
      setCurrentMode('delivery');
    }
  }, [pickerType, isParcelFlow]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other' | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [selectedVendorReviews, setSelectedVendorReviews] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAROpen, setIsAROpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<any>(null);

  // Nearby drivers & vehicles states
  const { drivers: realDrivers } = useNearbyDrivers();
  const [simulatedDrivers, setSimulatedDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  // Generate simulated drivers when there are no real drivers in range
  useEffect(() => {
    // Respect user feedback: "kama hakuna Moving Vehicles basi yasionekane"
    // (If there are no real active/moving vehicles, do not show any simulated ones either)
    setSimulatedDrivers([]);
  }, [isOpen]);

  // Slowly simulate movement/drift for simulated drivers
  useEffect(() => {
    if (simulatedDrivers.length === 0) return;

    const timer = setInterval(() => {
      setSimulatedDrivers(prev => prev.map(drv => {
        const deltaLat = (Math.random() - 0.5) * 0.00015;
        const deltaLng = (Math.random() - 0.5) * 0.00015;
        const newLat = drv.lat + deltaLat;
        const newLng = drv.lng + deltaLng;
        let newHeading = drv.heading;
        if (Math.abs(deltaLat) > 0 || Math.abs(deltaLng) > 0) {
          newHeading = Math.round((Math.atan2(deltaLng, deltaLat) * 180) / Math.PI);
          if (newHeading < 0) newHeading += 360;
        }
        return { ...drv, lat: newLat, lng: newLng, heading: newHeading };
      }));
    }, 4000);

    return () => clearInterval(timer);
  }, [simulatedDrivers.length > 0]);

  // Stop & Media Interactive States on 2D map
  const [selectedStopIdx, setSelectedStopIdx] = useState<number | null>(null);
  const [quizSelectedOption, setQuizSelectedOption] = useState<string>('');
  const [quizSolved, setQuizSolved] = useState(false);
  const [quizRewardInfo, setQuizRewardInfo] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Clear speech synthesizer when closing or switching stops
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const playVoiceText = (text: string) => {
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const swKeywords = ["kituo", "sasa", "duka", "karibu", "jinsi", "ya", "kushinda", "habari", "mambo", "funga", "fungua", "tembelea", "sauti"];
      const isSwahili = swKeywords.some(word => text.toLowerCase().includes(word));
      
      if (isSwahili) {
        utterance.lang = "sw-TZ";
      } else {
        utterance.lang = "en-US";
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed:", e);
    }
  };

  const stopVoiceText = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const renderVideoPlayerLocal = (url: string) => {
    if (!url) return null;
    const youtubeRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(youtubeRegExp);
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return (
        <iframe
          className="w-full h-full rounded-2xl border-0"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    const vimeoRegExp = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegExp);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return (
        <iframe
          className="w-full h-full rounded-2xl border-0"
          src={`https://player.vimeo.com/video/${videoId}`}
          title="Vimeo video player"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <video 
        src={url} 
        controls 
        playsInline
        className="w-full h-full object-contain bg-black rounded-2xl"
      />
    );
  };

  // Load AR Route for 2D map tracing if arRouteId is provided or preSelectedVendorId is set
  useEffect(() => {
    async function loadRoute() {
      if (arRouteId) {
        try {
          const routeDoc = await getDoc(doc(db, 'ar_routes', arRouteId));
          if (routeDoc.exists()) {
            setActiveRoute({ id: routeDoc.id, ...routeDoc.data() });
          }
        } catch (e) {
          console.error("Error loading route in LocationPicker:", e);
        }
      } else if (preSelectedVendorId) {
        try {
          const q = query(
            collection(db, 'ar_routes'),
            where('vendorId', '==', preSelectedVendorId)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setActiveRoute({ id: snap.docs[0].id, ...snap.docs[0].data() });
          } else {
            setActiveRoute(null);
          }
        } catch (e) {
          console.error("Error loading route for vendor in LocationPicker:", e);
        }
      } else {
        setActiveRoute(null);
      }
    }
    if (isOpen) {
      loadRoute();
    }
  }, [isOpen, arRouteId, preSelectedVendorId]);

  const categories = [
    { id: 'all', label: 'Zote', icon: <Layers size={14} /> },
    { id: 'vehicles', label: 'Magari / Boda', icon: <Car size={14} className="text-yellow-500 shrink-0" /> },
    { id: 'food', label: 'Chakula', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('food').options.html || '' }} className="scale-50" /> },
    { id: 'grocery', label: 'Soko', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('grocery').options.html || '' }} className="scale-50" /> },
    { id: 'bus', label: 'Tiketi', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('bus').options.html || '' }} className="scale-50" /> },
    { id: 'pharmacy', label: 'Dawa', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('pharmacy').options.html || '' }} className="scale-50" /> },
    { id: 'ecommerce', label: 'Shopping', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('ecommerce').options.html || '' }} className="scale-50" /> },
    { id: 'salon', label: 'Saluni', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('salon').options.html || '' }} className="scale-50" /> },
    { id: 'hotel', label: 'Hoteli', icon: <div dangerouslySetInnerHTML={{ __html: getVendorIcon('hotel').options.html || '' }} className="scale-50" /> },
  ];

  const filteredVendors = React.useMemo(() => {
    const isBusTicketEnabled = businessConfig?.services?.bus_ticket?.enabled === true;
    const availableVendors = vendors.filter(v => {
      if (v.category === 'bus_ticket') {
        return isBusTicketEnabled;
      }
      return true;
    });

    if (preSelectedVendorId) {
      const found = availableVendors.filter(v => v.id === preSelectedVendorId);
      if (found.length > 0) return found;
      if (selectedVendor && selectedVendor.id === preSelectedVendorId) {
        if (selectedVendor.category !== 'bus_ticket' || isBusTicketEnabled) {
          return [selectedVendor];
        }
      }
      return [];
    }

    if (categoryFilter === 'vehicles') return [];

    return availableVendors.filter(v => {
      if (categoryFilter === 'all') return true;
      const cat = (v.category || '').toLowerCase();
      
      if (categoryFilter === 'food') return cat.includes('chakula') || cat.includes('food') || cat.includes('mgahawa') || cat.includes('restaurant');
      if (categoryFilter === 'grocery') return cat.includes('soko') || cat.includes('grocery') || cat.includes('market');
      if (categoryFilter === 'bus') return cat.includes('bus') || cat.includes('ticket') || cat.includes('basi');
      if (categoryFilter === 'pharmacy') return cat.includes('dawa') || cat.includes('pharmacy') || cat.includes('medicine');
      if (categoryFilter === 'salon') return cat.includes('saluni') || cat.includes('salon') || cat.includes('kinyozi') || cat.includes('hair');
      if (categoryFilter === 'hotel') return cat.includes('hotel') || cat.includes('malazi') || cat.includes('accommodation') || cat.includes('hoteli');
      if (categoryFilter === 'ecommerce') return !(['chakula', 'food', 'mgahawa', 'restaurant', 'soko', 'grocery', 'market', 'bus', 'ticket', 'basi', 'dawa', 'pharmacy', 'medicine', 'saluni', 'salon', 'kinyozi', 'hair', 'hotel', 'malazi', 'accommodation', 'hoteli'].some(c => cat.includes(c)));
      
      return true;
    });
  }, [vendors, categoryFilter, preSelectedVendorId, selectedVendor, businessConfig]);

  // Load recent places from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_places');
    if (saved) {
      try {
        setRecentPlaces(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent places', e);
      }
    }
  }, []);

  // Fetch reviews for selected vendor
  useEffect(() => {
    if (selectedVendor?.id) {
      const fetchReviews = async () => {
        try {
          const q = query(
            collection(db, 'reviews'),
            where('targetId', '==', selectedVendor.id),
            where('targetType', '==', 'vendor')
          );
          const snap = await getDocs(q);
          setSelectedVendorReviews(snap.docs.map(doc => doc.data()));
        } catch (error) {
          console.error('Error fetching reviews for map vendor:', error);
        }
      };
      fetchReviews();
    } else {
      setSelectedVendorReviews([]);
    }
  }, [selectedVendor?.id]);

  const saveRecentPlace = (place: { address: string; lat: number; lng: number }) => {
    const updated = [place, ...recentPlaces.filter(p => p.address !== place.address)].slice(0, 5);
    setRecentPlaces(updated);
    localStorage.setItem('recent_places', JSON.stringify(updated));
  };

  // Debounced search for suggestions
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (address.length > 2 && !isSearching) {
        fetchSuggestions(address);
      } else if (address.length <= 2) {
        setSuggestions([]);
      }
    }, 1000); // Increased to 1s to match Nominatim rate limits

    return () => clearTimeout(delayDebounceFn);
  }, [address]);

  const fetchSuggestions = async (query: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
      
      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!response.ok) {
        let errorMsg = `Search failed (${response.status})`;
        if (isJson) {
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.detail || errorMsg;
          } catch (e) {
            // Fallback
          }
        }
        throw new Error(errorMsg);
      }
      
      if (!isJson) {
        throw new Error("Received non-JSON response from geocoding service");
      }
      
      const data = await response.json();
      setSuggestions(data);
    } catch (err: any) {
      console.error('Failed to fetch suggestions:', err);
      // Only set error if it's not a generic "Failed to fetch" which is often transient
      if (err.message !== 'Failed to fetch') {
        setError('Imeshindwa kupata mapendekezo. Jaribu tena.');
      }
    }
  };

  // Handle pre-selected vendor or direct QR load with direct Firestore fetching fallback
  useEffect(() => {
    async function initPreselected() {
      if (!isOpen) return;
      if (preSelectedVendorId) {
        let vendor = vendors.find(v => v.id === preSelectedVendorId);
        if (!vendor) {
          try {
            const docRef = await getDoc(doc(db, 'vendors', preSelectedVendorId));
            if (docRef.exists()) {
              vendor = { id: docRef.id, ...docRef.data() } as any;
            }
          } catch (e) {
            console.error("Error loading deep-linked vendor directly in LocationPicker:", e);
          }
        }
        if (vendor && vendor.location) {
          const newPos = new L.LatLng(vendor.location.lat, vendor.location.lng);
          setPosition(newPos);
          setSelectedVendor(vendor);
          setAddress(vendor.address || vendor.businessName);
        }
      }
      
      // Auto-open AR viewer directly for deep-linked scanning!
      if (isMapViewOnly && (preSelectedVendorId || arRouteId)) {
        setIsAROpen(true);
      }
    }
    initPreselected();
  }, [isOpen, preSelectedVendorId, arRouteId, vendors, isMapViewOnly]);

  const getNearestPopularPlace = (lat: number, lng: number): string => {
    let nearestName = "Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania";
    let minDistance = Infinity;
    const places = [
      { display_name: "Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "New City Road off Bagamoyo Road, Police Quarters, Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.7650, lon: 39.2485 },
      { display_name: "Vikawe Bondeni, Kibaha Town, Mkoa wa Pwani, Coastal Zone, Tanzania", lat: -6.7580, lon: 38.9320 },
      { display_name: "Kariakoo, Ilala Municipal, Dar es Salaam, Coastal Zone, 11101, Tanzania", lat: -6.82, lon: 39.278 },
      { display_name: "Posta, Kivukoni, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.8164, lon: 39.2902 },
      { display_name: "Mwenge, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7681, lon: 39.2274 },
      { display_name: "Sinza, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7812, lon: 39.2223 },
      { display_name: "Masaki, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7441, lon: 39.2812 },
      { display_name: "Mikocheni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7645, lon: 39.2492 },
      { display_name: "Ubungo Bus Terminal, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14114, Tanzania", lat: -6.7961, lon: 39.2155 },
      { display_name: "Mbezi Luis, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14115, Tanzania", lat: -6.7831, lon: 39.1952 },
      { display_name: "Kinondoni, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7952, lon: 39.2631 },
      { display_name: "Temeke, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.855, lon: 39.265 },
      { display_name: "Kigamboni, Kigamboni Municipal, Dar es Salaam, Coastal Zone, 17101, Tanzania", lat: -6.825, lon: 39.31 },
      { display_name: "Ilala, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.827, lon: 39.262 },
      { display_name: "Gerezani, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.8239, lon: 39.2797 },
      { display_name: "Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.7725, lon: 39.2789 },
      { display_name: "Msasani, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14111, Tanzania", lat: -6.7561, lon: 39.2741 },
      { display_name: "Tabata, Ilala Municipal, Dar es Salaam, Coastal Zone, 12105, Tanzania", lat: -6.819, lon: 39.215 },
      { display_name: "Segerea, Ilala Municipal, Dar es Salaam, Coastal Zone, 12108, Tanzania", lat: -6.84, lon: 39.19 },
      { display_name: "Kawe, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14109, Tanzania", lat: -6.7389, lon: 39.2558 },
      { display_name: "Tegeta, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14108, Tanzania", lat: -6.685, lon: 39.214 },
      { display_name: "Kunduchi, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.669, lon: 39.219 },
      { display_name: "Kibamba, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14116, Tanzania", lat: -6.79, lon: 39.11 },
      { display_name: "Kimara, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.792, lon: 39.167 },
      { display_name: "Kisutu, Ilala Municipal, Dar es Salaam, Coastal Zone, 11104, Tanzania", lat: -6.814, lon: 39.287 },
      { display_name: "Upanga, Ilala Municipal, Dar es Salaam, Coastal Zone, 11102, Tanzania", lat: -6.804, lon: 39.28 },
      { display_name: "Mbagala, Temeke Municipal, Dar es Salaam, Coastal Zone, 15102, Tanzania", lat: -6.891, lon: 39.269 },
      { display_name: "Chanika, Ilala Municipal, Dar es Salaam, Coastal Zone, 12111, Tanzania", lat: -6.91, lon: 39.08 },
      { display_name: "Kivukoni Ferry, Ilala Municipal, Dar es Salaam, Coastal Zone, 11105, Tanzania", lat: -6.821, lon: 39.299 },
      { display_name: "Boko, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14107, Tanzania", lat: -6.649, lon: 39.191 },
      { display_name: "Bunju, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14106, Tanzania", lat: -6.611, lon: 39.166 },
      { display_name: "Julius Nyerere Airport (JNIA), Kipawa, Ukonga, Ilala Municipal, Dar es Salaam, Coastal Zone, 12109, Tanzania", lat: -6.8781, lon: 39.2026 },
      { display_name: "Tazara, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.843, lon: 39.241 },
      { display_name: "Morocco, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.7885, lon: 39.2604 },
      { display_name: "Tandika, Temeke Municipal, Dar es Salaam, Coastal Zone, 15103, Tanzania", lat: -6.858, lon: 39.259 },
      { display_name: "Buguruni, Ilala Municipal, Dar es Salaam, Coastal Zone, 12102, Tanzania", lat: -6.828, lon: 39.245 },
      { display_name: "Vingunguti, Ilala Municipal, Dar es Salaam, Coastal Zone, 12103, Tanzania", lat: -6.842, lon: 39.218 },
      { display_name: "Kijitonyama, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.778, lon: 39.245 },
      { display_name: "Makumbusho, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.776, lon: 39.241 },
      { display_name: "Coco Beach, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.765, lon: 39.294 },
      { display_name: "The Slipway, Oysterbay, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14112, Tanzania", lat: -6.749, lon: 39.284 },
      { display_name: "Mlimani City Mall, Sam Nujoma Road, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.7722, lon: 39.2241 },
      { display_name: "Karume, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8202, lon: 39.2612 },
      { display_name: "Machinga Complex, Ilala Municipal, Dar es Salaam, Coastal Zone, 12101, Tanzania", lat: -6.8218, lon: 39.2598 },
      { display_name: "Kigogo, Kinondoni Municipal, Dar es Salaam, Coastal Zone, 14110, Tanzania", lat: -6.807, lon: 39.231 },
      { display_name: "Mabibo, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.801, lon: 39.211 },
      { display_name: "Manzese, Ubungo Municipal, Dar es Salaam, Coastal Zone, 14113, Tanzania", lat: -6.793, lon: 39.217 },
      { display_name: "Keko, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.837, lon: 39.282 },
      { display_name: "Chang’ombe, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.841, lon: 39.268 },
      { display_name: "Kurasini, Temeke Municipal, Dar es Salaam, Coastal Zone, 15101, Tanzania", lat: -6.848, lon: 39.289 },
      { display_name: "Dodoma Town Central, Dodoma City, Mkoa wa Dodoma, Central Zone, Tanzania", lat: -6.1722, lon: 35.7481 },
      { display_name: "Arusha Clock Tower, Arusha Urban, Mkoa wa Arusha, Northern Zone, Tanzania", lat: -3.3731, lon: 36.6857 },
      { display_name: "Mwanza City Centre, Nyamagana, Mkoa wa Mwanza, Lake Zone, Tanzania", lat: -2.5164, lon: 32.9018 },
      { display_name: "Zanzibar Stone Town, Mjini Magharibi, Zanzibar, Tanzania", lat: -6.1659, lon: 39.199 },
    ];
    for (const p of places) {
      const d = Math.pow(p.lat - lat, 2) + Math.pow(p.lon - lng, 2);
      if (d < minDistance) {
        minDistance = d;
        nearestName = p.display_name;
      }
    }
    return nearestName;
  };

// Reverse geocoding function
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lng}&zoom=18`);
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(`Reverse geocoding failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data && data.display_name && data.display_name !== "Unknown Area" && data.display_name !== "Unknown Location" && data.display_name !== "Eneo Halijapatikana") {
        setAddress(data.display_name);
      } else {
        throw new Error('No valid display name');
      }
    } catch (err) {
      console.warn('Reverse geocoding failed, trying fallback:', err);
      try {
        const bdcResponse = await fetch(`/api/geo/bdc-reverse?lat=${lat}&lon=${lng}`);
        const bdcContentType = bdcResponse.headers.get("content-type");
        if (!bdcResponse.ok || !bdcContentType || !bdcContentType.includes("application/json")) {
           throw new Error(`BDC failed with status ${bdcResponse.status}`);
        }
        const bdcData = await bdcResponse.json();
        const bdcAddress = bdcData.locality || bdcData.city || bdcData.principalSubdivision;
        if (bdcAddress && bdcAddress !== "Unknown Location" && bdcAddress !== "Unknown Area") {
          setAddress(bdcAddress);
        } else {
          throw new Error('BDC also returned unknown');
        }
      } catch (bdcErr) {
        console.warn('All geocoding attempts failed:', bdcErr);
        setAddress(getNearestPopularPlace(lat, lng));
      }
    }
  };

  // Search function
  const handleSearch = async (query: string) => {
    if (!query || query.length < 3) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}&limit=1`);
      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!response.ok) {
        let errorMsg = `Search failed with status ${response.status}`;
        if (isJson) {
          try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } catch (e) {
            // Fallback
          }
        }
        throw new Error(errorMsg);
      }

      if (!isJson) {
        throw new Error("Received non-JSON response from search service");
      }

      const data = await response.json();
      if (data && data.length > 0) {
        const newPos = safeLatLng(data[0].lat, data[0].lon ?? data[0].lng);
        setPosition(newPos);
        setUserOrigin(newPos);
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
          const newPos = safeLatLng(pos.coords?.latitude, pos.coords?.longitude);
          setPosition(newPos);
          setUserOrigin(newPos);
          reverseGeocode(newPos.lat, newPos.lng);
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
    const selectedData = {
      address: address || `Location (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`,
      lat: position.lat,
      lng: position.lng
    };
    saveRecentPlace(selectedData);
    onSelect(selectedData);
    onClose();
  };

  if (!isOpen) return null;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className={`fixed inset-0 ${zIndex || 'z-[2000]'} flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md transition-all`}>
        <motion.div 
          initial={{ y: '100%', opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="bg-white dark:bg-neutral-900 w-full max-w-[480px] rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-neutral-200/80 dark:border-neutral-800"
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-white dark:bg-neutral-900 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-colors shrink-0 ${
                currentMode === 'pickup' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' 
                  : currentMode === 'delivery'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  : 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60'
              }`}>
                {currentMode === 'delivery' ? <Package className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white tracking-tight leading-snug truncate">
                  {title || (currentMode === 'pickup' ? 'Mahali pa Kuchukulia' : currentMode === 'delivery' ? 'Eneo la Kufikisha' : 'Chagua Eneo Lako')}
                </h2>
                <p className="text-[10px] sm:text-[10.5px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-bold truncate">
                  {subtitle || (currentMode === 'pickup' ? 'Chagua eneo la kuchukulia mzigo' : currentMode === 'delivery' ? 'Chagua eneo la kufikisha mzigo' : 'Gusa kwenye ramani au tafuta anwani')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
            {/* Mode Switcher Tabs (Only in Parcel Flow) */}
            {isParcelFlow && !isMapViewOnly && !isMapExpanded && (
              <div className="px-3.5 pt-2.5 pb-1 bg-white dark:bg-neutral-900 shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMode('pickup')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                    currentMode === 'pickup'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25'
                      : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${currentMode === 'pickup' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                  <span className="truncate uppercase tracking-tight text-[11px]">Mahali pa Kuchukulia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMode('delivery')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                    currentMode === 'delivery'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25'
                      : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${currentMode === 'delivery' ? 'bg-white' : 'bg-rose-500'}`}></span>
                  <span className="truncate uppercase tracking-tight text-[11px]">Eneo la Kufikisha</span>
                </button>
              </div>
            )}

            {/* Search & Input */}
            {!isMapViewOnly && !isMapExpanded && (
              <motion.div 
                initial={{ opacity: 1, height: 'auto' }}
                animate={{ opacity: isMapExpanded ? 0 : 1, height: isMapExpanded ? 0 : 'auto' }}
                className="px-3.5 py-2.5 space-y-2 bg-white dark:bg-neutral-900 sticky top-0 z-20 overflow-hidden"
              >
                {/* Unified Search Input + GPS Quick Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-orange-500 transition-colors" />
                    <Input 
                      placeholder="Andika mtaa, jengo au eneo..." 
                      className="pl-9 pr-9 h-11 bg-neutral-50 dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700/80 rounded-xl text-xs sm:text-sm font-medium focus-visible:ring-2 focus-visible:ring-orange-500/40 text-neutral-900 dark:text-white"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (e.target.value.length === 0) setSuggestions([]);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch(address)}
                    />
                    {address && (
                      <button
                        type="button"
                        onClick={() => { setAddress(''); setSuggestions([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
                        title="Futa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      </div>
                    )}
                  </div>

                  {/* Integrated Compact GPS Location Button */}
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    className="h-11 px-3 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-800/60 rounded-xl flex items-center gap-1.5 text-xs font-bold shrink-0 transition-all active:scale-95 shadow-xs cursor-pointer"
                    title="Tumia eneo nililopo sasa (GPS)"
                  >
                    {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 fill-current" />}
                    <span className="hidden xs:inline sm:inline text-[11px]">Nilipo</span>
                  </button>
                </div>

                {/* Autocomplete Suggestions */}
                <AnimatePresence>
                  {suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 rounded-xl shadow-xl max-h-48 overflow-y-auto no-scrollbar"
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={`location-suggest-${suggestion.place_id || index}`}
                          onClick={() => {
                            const newPos = safeLatLng(suggestion.lat, suggestion.lon ?? suggestion.lng);
                            setPosition(newPos);
                            setAddress(suggestion.display_name);
                            setSuggestions([]);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 flex items-start gap-2.5 border-b border-neutral-100 dark:border-neutral-700/50 last:border-0 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 mt-0.5 text-orange-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-neutral-900 dark:text-white leading-tight truncate">{suggestion.display_name.split(',')[0]}</p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate">{suggestion.display_name}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-200 dark:border-red-900/50 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{error}</span>
                    <button type="button" onClick={() => setError(null)} className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900">
                      <X className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </motion.div>
                )}

                {/* Recent Places Section - Compact Chips */}
                {recentPlaces.length > 0 && address.length < 3 && suggestions.length === 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <span className="text-[9.5px] font-bold text-neutral-400 uppercase shrink-0 flex items-center gap-1">
                      <Clock size={10} /> Hivi Karibuni:
                    </span>
                    {recentPlaces.slice(0, 3).map((place, i) => (
                      <button
                        key={`recent-place-${place.address}-${i}`}
                        onClick={() => {
                          setPosition(new L.LatLng(place.lat, place.lng));
                          setAddress(place.address);
                        }}
                        className="shrink-0 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[10.5px] font-medium border border-neutral-200/60 dark:border-neutral-700 transition-colors flex items-center gap-1 max-w-[140px] truncate cursor-pointer"
                        title={place.address}
                      >
                        <MapPin className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{place.address.split(',')[0]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Map Area */}
            <div className={`relative ${isMapExpanded ? 'flex-1 h-full mx-0 rounded-none' : 'h-[270px] sm:h-[300px] mx-3 sm:mx-3.5 rounded-2xl'} shrink-0 bg-neutral-100 dark:bg-neutral-800 overflow-hidden border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs transition-all duration-300 z-10`}>
              {/* Map Type Toggle */}
              <div className="absolute top-2.5 left-2.5 z-[1000] flex bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl p-0.5 shadow-md border border-white/60 dark:border-neutral-700/60">
                <button 
                  onClick={() => setMapType('standard')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mapType === 'standard' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
                >
                  Ramani
                </button>
                <button 
                  onClick={() => setMapType('satellite')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mapType === 'satellite' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
                >
                  Satellite
                </button>
              </div>

              {/* Expansion & GPS Toggle in Top Right */}
              <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  title="Lenga nilipo (GPS)"
                  className="w-8 h-8 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl flex items-center justify-center text-orange-600 shadow-md border border-white/60 dark:border-neutral-700/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  title={isMapExpanded ? "Punguza ramani" : "Panua ramani"}
                  className="w-8 h-8 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-md border border-white/60 dark:border-neutral-700/60 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isMapExpanded ? <RotateCw className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                </button>
              </div>

              <MapContainer 
                center={position} 
                zoom={14} 
                maxZoom={22}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
                dragging={true}
                doubleClickZoom={true}
                scrollWheelZoom={true}
                touchZoom={true}
                whenReady={() => setTimeout(() => setMapReady(true), 100)}
              >
                <TileLayer
                  url={mapType === 'satellite' 
                    ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  }
                  subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                  maxZoom={22}
                  maxNativeZoom={19}
                  attribution="&copy; Google Maps"
                />

                {mapReady && (
                  <>
                    <MapController center={position} />
                    <AutoFitBounds vendors={filteredVendors} categoryFilter={categoryFilter} />
                    <InteractionHandler onInteraction={() => {}} />
                    <LocationMarker 
                      position={position} 
                      setPosition={setPosition} 
                      isMapViewOnly={isMapViewOnly}
                      icon={
                        currentMode === 'pickup' 
                          ? getPickupPinIcon() 
                          : currentMode === 'delivery' 
                          ? getDeliveryPinIcon() 
                          : getStandardLocationPinIcon()
                      }
                      onPositionChange={(pos) => {
                        reverseGeocode(pos.lat, pos.lng);
                        setUserOrigin(pos);
                        setSelectedVendor(null); // Clear selection when user moves marker
                        setSelectedStopIdx(null); // Clear active stop preview
                        window.speechSynthesis.cancel();
                        setIsSpeaking(false);
                      }} 
                    />

                    {userOrigin && (currentMode === 'pickup' || currentMode === 'delivery') && (
                      <Marker 
                        position={userOrigin} 
                        icon={CurrentLocationPulseIcon}
                      />
                    )}
                    
                    {/* Filtered Vendor Markers */}
                    {filteredVendors?.map((v) => v.location && (
                      <Marker 
                        key={v.id} 
                        position={[v.location.lat, v.location.lng]} 
                        icon={getVendorIcon(v.category)}
                        eventHandlers={{
                          click: () => {
                            setSelectedVendor(v);
                            setSelectedDriver(null); // Clear active driver card
                            setSelectedStopIdx(null); // Close active stop preview
                            window.speechSynthesis.cancel();
                            setIsSpeaking(false);
                            setPosition(new L.LatLng(v.location.lat, v.location.lng));
                          }
                        }}
                      />
                    ))}

                    {/* Real and Simulated Driver/Vehicle Markers */}
                    {(categoryFilter === 'all' || categoryFilter === 'vehicles') && (
                      <>
                        {/* Real Drivers from Firebase */}
                        {realDrivers?.map((drv) => (
                          <Marker
                            key={drv.id}
                            position={[drv.lat, drv.lng]}
                            icon={getVehicleIcon(drv.vehicleType, drv.heading)}
                            eventHandlers={{
                              click: () => {
                                setSelectedDriver(drv);
                                setSelectedVendor(null); // Clear selected store card
                                setSelectedStopIdx(null); // Close active stop preview
                                window.speechSynthesis.cancel();
                                setIsSpeaking(false);
                                setPosition(new L.LatLng(drv.lat, drv.lng));
                              }
                            }}
                          />
                        ))}

                        {/* Simulated Drivers */}
                        {simulatedDrivers?.map((drv) => (
                          <Marker
                            key={drv.id}
                            position={[drv.lat, drv.lng]}
                            icon={getVehicleIcon(drv.vehicleType, drv.heading)}
                            eventHandlers={{
                              click: () => {
                                setSelectedDriver(drv);
                                setSelectedVendor(null); // Clear selected store card
                                setSelectedStopIdx(null); // Close active stop preview
                                window.speechSynthesis.cancel();
                                setIsSpeaking(false);
                                setPosition(new L.LatLng(drv.lat, drv.lng));
                              }
                            }}
                          />
                        ))}
                      </>
                    )}

                    {/* Render active route's path / polyline on the 2D map */}
                    {activeRoute && activeRoute.stops && activeRoute.stops.length > 0 && (
                      <>
                        <Polyline 
                          positions={activeRoute.stops.map((stop: any) => [stop.lat, stop.lng])} 
                          color="#f97316" 
                          weight={5} 
                          dashArray="5, 10" 
                          lineCap="round"
                        />
                        {/* Render active route's stops as numbered/custom emoji markers */}
                        {activeRoute.stops.map((stop: any, idx: number) => {
                          const charType = stop.character || 'guide';
                          const stopEmoji = [
                            { id: 'lion', icon: '🦁' },
                            { id: 'castle', icon: '🏰' },
                            { id: 'guide', icon: '🤖' },
                            { id: 'treasure', icon: '🎁' },
                            { id: 'coin', icon: '🪙' },
                            { id: 'dragon', icon: '🐉' },
                            { id: 'bread', icon: '🍞' },
                            { id: 'soda', icon: '🥤' },
                            { id: 'tv', icon: '📺' },
                            { id: 'teacher', icon: '👩‍🏫' },
                            { id: 'fireworks', icon: '🎉' },
                          ].find(c => c.id === charType)?.icon || '📍';

                          const stopIcon = L.divIcon({
                            html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 border-2 border-white shadow-lg text-sm text-white">${stopEmoji}</div>`,
                            className: 'custom-stop-icon',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16],
                          });

                          return (
                            <Marker 
                              key={`stop-marker-${idx}`}
                              position={[stop.lat, stop.lng]}
                              icon={stopIcon}
                              eventHandlers={{
                                click: () => {
                                  setSelectedStopIdx(idx);
                                  setSelectedVendor(null); // Close active vendor card
                                  setQuizSelectedOption('');
                                  setQuizSolved(false);
                                  setQuizError(null);
                                  setQuizRewardInfo(null);
                                  window.speechSynthesis.cancel();
                                  setIsSpeaking(false);
                                }
                              }}
                            />
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </MapContainer>

              {/* Category Filter UI - Compact Horizontal Scroll Overlay */}
              <div className="absolute bottom-2 left-2 right-2 z-[1000] flex justify-center pointer-events-none">
                <div className="flex bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl p-0.5 gap-1 shadow-md border border-neutral-200/80 dark:border-neutral-700/80 overflow-x-auto no-scrollbar max-w-[96%] pointer-events-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                        categoryFilter === cat.id 
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs' 
                          : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <div className={`w-4 h-4 flex items-center justify-center rounded-md ${categoryFilter === cat.id ? 'bg-white/20 dark:bg-neutral-900/20' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                        {cat.id === 'all' ? <Layers size={10} className={categoryFilter === cat.id ? 'text-white dark:text-neutral-900' : 'text-neutral-500'} /> : (
                          <div className="w-4 h-4 scale-[0.35] flex items-center justify-center">
                             {cat.icon}
                          </div>
                        )}
                      </div>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtle No Stores Found Pill if category filter has no results (non-blocking) */}
              {categoryFilter !== 'all' && filteredVendors.length === 0 && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                  <div className="bg-neutral-900/85 backdrop-blur-md text-white text-[10px] font-bold px-3.5 py-1.5 rounded-full shadow-lg border border-white/10 flex items-center gap-1.5">
                    <span>ℹ️</span>
                    <span>Hakuna maduka katika aina hii kwa sasa</span>
                  </div>
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
                            src={selectedVendor.arImageUrl || selectedVendor.bannerUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80'} 
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
                                   <div 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const origin = userOrigin || position;
                                        const originStr = origin ? `&origin=${origin.lat},${origin.lng}` : '';
                                        const url = `https://www.google.com/maps/dir/?api=1${originStr}&destination=${selectedVendor.location.lat},${selectedVendor.location.lng}`;
                                        window.open(url, '_blank');
                                      }}
                                      className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded-lg border border-green-100 hover:bg-green-600 hover:text-white transition-all mr-1"
                                   >
                                      <Navigation className="w-3 h-3" />
                                      <span className="text-[10px] font-black italic tracking-tighter">
                                        {(() => {
                                          const origin = userOrigin || position;
                                          if (!origin || !selectedVendor.location) return '0.0';
                                          const lat1 = origin.lat;
                                          const lon1 = origin.lng;
                                          const lat2 = selectedVendor.location.lat;
                                          const lon2 = selectedVendor.location.lng;
                                          
                                          const R = 6371; // km
                                          const dLat = (lat2 - lat1) * Math.PI / 180;
                                          const dLon = (lon2 - lon1) * Math.PI / 180;
                                          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                            Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                          const d = R * c;
                                          return d.toFixed(1);
                                        })()}KM
                                      </span>
                                   </div>
                                   <span className="text-[9px] font-black text-neutral-900 uppercase">Star</span>
                                   <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                                   <span className="text-xs font-black text-neutral-900">
                                     {(() => {
                                       const vCount = Number(selectedVendor.ratingCount || 0);
                                       const vRating = Number(selectedVendor.rating || 0);
                                       return vCount > 0 ? vRating.toFixed(1) : '0.0';
                                     })()} ({Number(selectedVendor.ratingCount || 0)})
                                   </span>
                                </div>
                             </div>
                             <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                <p className="text-[11px] text-neutral-400 font-bold truncate uppercase tracking-tighter">{selectedVendor.address || 'Shop No. 22, Elegant Tower, New...'}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-3.5 justify-start">
                                 <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsAROpen(true);
                                    }}
                                    className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-orange-950/20 transition-all font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer"
                                 >
                                    <Camera className="w-4 h-4 animate-pulse" />
                                    <span>AR Camera / Scan QR</span>
                                 </button>
                             </div>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Selected Driver Card Overlay */}
              <AnimatePresence>
                {selectedDriver && (
                  <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="absolute top-20 left-4 right-4 z-[1001]"
                  >
                    <div 
                      className="bg-neutral-900 text-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 p-5 cursor-default"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl shadow-lg relative shrink-0">
                            {selectedDriver.vehicleType === 'boda' ? '🏍️' : selectedDriver.vehicleType === 'bajaji' ? '🛺' : selectedDriver.vehicleType === 'delivery' ? '🚚' : '🚗'}
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-900 rounded-full"></span>
                          </div>
                          <div>
                            <h4 className="font-black text-base uppercase tracking-tight text-white">{selectedDriver.name}</h4>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">
                              {selectedDriver.vehicleType === 'boda' ? 'Pikipiki / Boda' : selectedDriver.vehicleType === 'bajaji' ? 'Bajaji Smart' : selectedDriver.vehicleType === 'delivery' ? 'Mjumbe wa Vifurushi' : 'Taxi ya Kirafiki'}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedDriver(null)}
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                        <div className="bg-white/5 rounded-2xl p-3 flex flex-col justify-center">
                          <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">Umbali Kutoka Kwako</span>
                          <span className="text-base font-black text-amber-500 mt-1">
                            {(() => {
                              const origin = userOrigin || position;
                              if (!origin) return '0.2 KM';
                              const lat1 = origin.lat;
                              const lon1 = origin.lng;
                              const lat2 = selectedDriver.lat;
                              const lon2 = selectedDriver.lng;
                              
                              const R = 6371; // km
                              const dLat = (lat2 - lat1) * Math.PI / 180;
                              const dLon = (lon2 - lon1) * Math.PI / 180;
                              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                Math.sin(dLon / 2) * Math.sin(dLon / 2);
                              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                              const d = R * c;
                              return `${d.toFixed(2)} KM`;
                            })()}
                          </span>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 flex flex-col justify-center">
                          <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">Muda wa Kufika (ETA)</span>
                          <span className="text-base font-black text-green-400 mt-1">
                            {(() => {
                              const origin = userOrigin || position;
                              if (!origin) return 'Dakika 3';
                              const lat1 = origin.lat;
                              const lon1 = origin.lng;
                              const lat2 = selectedDriver.lat;
                              const lon2 = selectedDriver.lng;
                              
                              const R = 6371; // km
                              const dLat = (lat2 - lat1) * Math.PI / 180;
                              const dLon = (lon2 - lon1) * Math.PI / 180;
                              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                Math.sin(dLon / 2) * Math.sin(dLon / 2);
                              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                              const d = R * c;
                              const mins = Math.max(2, Math.round((d / 40) * 60));
                              return `Dk ${mins} hivi`;
                            })()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button 
                          onClick={() => {
                            onClose();
                            if (selectedDriver.vehicleType === 'delivery') {
                              navigate('/service/vifurushi');
                            } else {
                              navigate('/taxi');
                            }
                          }}
                          className="flex-1 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-center cursor-pointer shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <span>{selectedDriver.vehicleType === 'delivery' ? 'Tuma Kifurushi Sasa 📦' : 'Agiza Safari Hapa 🚕'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Interactive Indoor Stop & Media Overlay */}
              <AnimatePresence>
                {selectedStopIdx !== null && activeRoute && activeRoute.stops && activeRoute.stops[selectedStopIdx] && (
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    className="absolute top-20 left-4 right-4 z-[1001] max-h-[68vh] overflow-y-auto no-scrollbar bg-neutral-900/95 backdrop-blur-xl rounded-[2.5rem] border border-white/15 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] text-left flex flex-col gap-4 text-white"
                  >
                    {(() => {
                      const stop = activeRoute.stops[selectedStopIdx];
                      const stopName = stop.stopName || stop.name || `Kituo cha ${selectedStopIdx + 1}`;
                      const stopDesc = stop.stopDescription || stop.voiceText || stop.description;
                      const hasVoice = !!stopDesc;
                      const hasQuiz = stop.hasQuiz || !!stop.quiz;

                      // Extract character name and emoji
                      const charType = stop.character || 'guide';
                      const charObj = [
                        { id: 'lion', name: 'Simba Jasiri', icon: '🦁' },
                        { id: 'castle', name: 'Mlinzi wa Ngome', icon: '🏰' },
                        { id: 'guide', name: 'Mwongozo wako wa Smart', icon: '🤖' },
                        { id: 'treasure', name: 'Fumbo la Hazina', icon: '🎁' },
                        { id: 'coin', name: 'Sarafu ya Dhahabu', icon: '🪙' },
                        { id: 'dragon', name: 'Joka Mpole', icon: '🐉' },
                        { id: 'bread', name: 'Mpishi wa Mikate', icon: '🍞' },
                        { id: 'soda', name: 'Muuzaji wa Vinywaji', icon: '🥤' },
                        { id: 'tv', name: 'Televisheni ya Ajabu', icon: '📺' },
                        { id: 'teacher', name: 'Mwalimu Mkuu', icon: '👩‍🏫' },
                        { id: 'fireworks', name: 'Mtaalamu wa Sherehe', icon: '🎉' },
                      ].find(c => c.id === charType) || { id: 'guide', name: 'Mwongozo wa AI', icon: '🤖' };

                      return (
                        <>
                          {/* Card Header */}
                          <div className="flex items-start justify-between border-b border-white/10 pb-3">
                            <div className="min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400">
                                Kituo cha Ndani / Stop {selectedStopIdx + 1} la {activeRoute.stops.length}
                              </span>
                              <h4 className="text-lg font-black uppercase text-white tracking-tight leading-tight mt-0.5 truncate">
                                {stopName}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-base">{charObj.icon}</span>
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Kiongozi: {charObj.name}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedStopIdx(null);
                                stopVoiceText();
                              }}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Media Display Area - High Robustness */}
                          <div className="space-y-4">
                            {/* 1. Stop Description & Voice Readout */}
                            {stopDesc && (
                              <div className="bg-white/5 border border-white/5 p-4 rounded-3xl relative">
                                <p className="text-xs text-neutral-200 font-medium leading-relaxed mb-3">
                                  {stopDesc}
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (isSpeaking) {
                                        stopVoiceText();
                                      } else {
                                        playVoiceText(stopDesc);
                                      }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                                      isSpeaking 
                                        ? 'bg-red-600 text-white animate-pulse' 
                                        : 'bg-orange-600 hover:bg-orange-500 text-white shadow-md'
                                    }`}
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>{isSpeaking ? 'Zima Sauti / Mute' : 'Sikiliza Maelekezo (Sauti) 🔊'}</span>
                                  </button>
                                  {isSpeaking && (
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1 h-3 bg-orange-400 animate-bounce rounded-full" style={{ animationDelay: '0s' }}></span>
                                      <span className="w-1 h-4 bg-orange-400 animate-bounce rounded-full" style={{ animationDelay: '0.1s' }}></span>
                                      <span className="w-1 h-2 bg-orange-400 animate-bounce rounded-full" style={{ animationDelay: '0.2s' }}></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 2. Image Display */}
                            {(stop.imageUrl || stop.image) && (
                              <div className="w-full h-44 rounded-3xl overflow-hidden border border-white/10 bg-neutral-950 relative group">
                                <img
                                  src={stop.imageUrl || stop.image}
                                  alt={stopName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-white">📷 Picha ya Kituo</span>
                                </div>
                              </div>
                            )}

                            {/* 3. Video Embed / Player */}
                            {(stop.videoUrl || stop.video) && (
                              <div className="w-full p-3 bg-white/5 border border-white/5 rounded-3xl">
                                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 block mb-2">🎥 Video Guide:</span>
                                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center relative border border-white/10">
                                  {renderVideoPlayerLocal(stop.videoUrl || stop.video)}
                                </div>
                              </div>
                            )}

                            {/* 4. External Redirect Link */}
                            {(stop.linkUrl || stop.link) && (
                              <a
                                href={stop.linkUrl || stop.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-900/30"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Fungua Tovuti Iliyowekwa / Visit Website Link</span>
                              </a>
                            )}

                            {/* 5. Interactive Quiz Station */}
                            {hasQuiz && (
                              <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/40 border border-orange-500/20 p-5 rounded-3xl space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">🎮</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                                    Fumbo la Bonasi / Quiz Challenge
                                  </span>
                                </div>

                                {!quizSolved ? (
                                  <div className="space-y-3">
                                    <p className="text-xs font-bold text-white leading-relaxed">
                                      {stop.quizQuestion || stop.quiz?.question || "Je, unaweza kujibu swali hili kuhusu kituo hiki?"}
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {(stop.quiz?.options || stop.quizOptions || []).map((opt: string, oIdx: number) => {
                                        const isSelected = quizSelectedOption === opt;
                                        return (
                                          <button
                                            key={`quiz-opt-${oIdx}`}
                                            onClick={() => {
                                              setQuizSelectedOption(opt);
                                              setQuizError(null);
                                            }}
                                            className={`w-full text-left p-3 rounded-2xl text-[11px] font-bold transition-all border ${
                                              isSelected
                                                ? 'bg-orange-600/30 border-orange-500 text-white shadow-lg'
                                                : 'bg-white/5 border-transparent text-neutral-300 hover:bg-white/10'
                                            }`}
                                          >
                                            <span className="inline-block w-5 h-5 rounded-lg bg-white/10 text-center leading-5 text-[9px] mr-2">
                                              {String.fromCharCode(65 + oIdx)}
                                            </span>
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {quizError && (
                                      <p className="text-[10px] text-red-500 font-bold">{quizError}</p>
                                    )}
                                    <Button
                                      onClick={() => {
                                        if (!quizSelectedOption) {
                                          setQuizError("Tafadhali chagua jibu moja kwanza!");
                                          return;
                                        }
                                        // Determine correct answer
                                        let correctAnswerStr = "";
                                        if (stop.quiz) {
                                          correctAnswerStr = stop.quiz.options[stop.quiz.answer] || "";
                                        } else if (stop.quizAnswer) {
                                          correctAnswerStr = stop.quizAnswer;
                                        }
                                        
                                        const isCorrect = quizSelectedOption.trim().toLowerCase() === correctAnswerStr.trim().toLowerCase();
                                        if (isCorrect) {
                                          const pts = stop.quiz?.points || stop.rewardPoints || 10;
                                          const couponStr = stop.rewardCoupon ? ` na kupewa Kuponi: ${stop.rewardCoupon}` : "";
                                          setQuizRewardInfo(stop.quizReward || `Hongera sana! Umepata pointi ${pts} za Uaminifu${couponStr}! 🎉`);
                                          setQuizSolved(true);
                                        } else {
                                          setQuizError("Jibu si sahihi. Jaribu tena au kagua maelezo ya kituo!");
                                        }
                                      }}
                                      className="w-full h-11 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider"
                                    >
                                      Hifadhi na Thibitisha Jibu / Submit Answer
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="bg-green-600/20 border border-green-500/20 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                                    <CheckCircle2 className="w-10 h-10 text-green-500 animate-bounce" />
                                    <h5 className="text-xs font-black uppercase tracking-wider text-green-400">Hongera Sana! Sahihi!</h5>
                                    <p className="text-[11px] text-green-100 font-medium mt-1 leading-relaxed">
                                      {quizRewardInfo}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer with Prev/Next Stop Switchers & Open in AR Mode */}
                          <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10 mt-2">
                            <div className="flex gap-2">
                              <button
                                disabled={selectedStopIdx === 0}
                                onClick={() => {
                                  setSelectedStopIdx(selectedStopIdx - 1);
                                  setQuizSelectedOption('');
                                  setQuizSolved(false);
                                  setQuizError(null);
                                  setQuizRewardInfo(null);
                                  window.speechSynthesis.cancel();
                                  setIsSpeaking(false);
                                }}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-2xl text-[9px] font-black uppercase tracking-wider text-white transition-all"
                              >
                                ⬅️ Nyuma / Prev
                              </button>
                              <button
                                disabled={selectedStopIdx === activeRoute.stops.length - 1}
                                onClick={() => {
                                  setSelectedStopIdx(selectedStopIdx + 1);
                                  setQuizSelectedOption('');
                                  setQuizSolved(false);
                                  setQuizError(null);
                                  setQuizRewardInfo(null);
                                  window.speechSynthesis.cancel();
                                  setIsSpeaking(false);
                                }}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-2xl text-[9px] font-black uppercase tracking-wider text-white transition-all"
                              >
                                Mbele / Next ➡️
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                stopVoiceText();
                                setIsAROpen(true);
                              }}
                              className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white rounded-2xl shadow-xl shadow-orange-950/40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all transform active:scale-95"
                            >
                              <Camera className="w-4 h-4 animate-pulse" />
                              <span>Fungua AR Camera ya Kituo Hiki / Open in AR Mode</span>
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={`px-3.5 py-2.5 ${isMapExpanded ? 'hidden' : ''}`}>
              {!isMapViewOnly && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 flex items-start gap-2.5 shadow-xs">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    currentMode === 'pickup' 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                      : currentMode === 'delivery'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400'
                  }`}>
                    {useParcelIcon ? (
                      <Package className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                        {currentMode === 'pickup' ? 'Mahali pa Kuchukulia' : currentMode === 'delivery' ? 'Eneo la Kufikisha' : 'Anwani Iliyochaguliwa'}
                      </span>
                      
                      {/* Compact Quick Save Chips */}
                      <div className="flex items-center gap-1 shrink-0">
                        {[
                          { id: 'Home', icon: '🏠', label: 'Nyumbani' },
                          { id: 'Work', icon: '💼', label: 'Ofisini' },
                          { id: 'Other', icon: '📍', label: 'Ingine' }
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setLabel(label === item.id ? null : item.id as any)}
                            className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold flex items-center gap-0.5 transition-all border cursor-pointer ${
                              label === item.id 
                                ? 'border-orange-500 bg-orange-500 text-white shadow-xs' 
                                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'
                            }`}
                            title={`Hifadhi kama ${item.label}`}
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs sm:text-[13px] font-bold text-neutral-900 dark:text-white mt-1 leading-snug line-clamp-2">
                      {address || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Sticky at bottom */}
          {!isMapViewOnly && !isMapExpanded && (
            <div className="p-3.5 sm:p-4 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
              <button 
                type="button"
                className={`w-full h-12 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer ${
                  currentMode === 'pickup'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
                    : currentMode === 'delivery'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-rose-600/25'
                    : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25'
                }`}
                onClick={handleConfirm}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Thibitisha Eneo Lako</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
      {isAROpen && (
        <ARMapView 
          vendors={vendors} 
          initialTargetVendorId={preSelectedVendorId || selectedVendor?.id} 
          onClose={() => setIsAROpen(false)}
          userCoords={{ lat: position.lat, lng: position.lng }}
          arRouteId={arRouteId}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
