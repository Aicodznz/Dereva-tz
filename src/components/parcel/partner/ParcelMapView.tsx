import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
import { SmoothDriverMarker } from '../../map/SmoothDriverMarker';
import { usePartnerLocation } from '../../../hooks/parcel/partner/usePartnerLocation';
import { useTheme } from '../../../ThemeContext';

interface Props {
  destination?: { lat: number; lng: number };
  isDashed?: boolean;
  routeColor?: string;
}

// Fixed Leaflet Icon issue
const partnerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2850/2850335.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

const MapController = ({ location, destination, onMapReady }: { location: [number, number], destination?: {lat:number, lng:number}, onMapReady?: (map: L.Map) => void }) => {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  useEffect(() => {
    if (destination) {
      const bounds = L.latLngBounds([location, [destination.lat, destination.lng]]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(location, 15);
    }
  }, [location[0], location[1], destination?.lat, destination?.lng, map]);

  return null;
};

const ParcelMapView: React.FC<Props> = ({ destination, isDashed = false, routeColor = '#6366f1' }) => {
  const { location, error: gpsError } = usePartnerLocation();
  const partnerLoc = location || { lat: -6.7924, lng: 39.2083 }; // Default Dar center
  const [route, setRoute] = useState<[number, number][]>([]);
  const { theme, resolvedTheme } = useTheme();
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (destination && partnerLoc) {
      const coords = `${partnerLoc.lng},${partnerLoc.lat};${destination.lng},${destination.lat}`;
      fetch(`/api/geo/route?coords=${coords}`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setRoute(coords);
          }
        })
        .catch(err => console.error("Parcel routing failed", err));
    } else {
      setRoute([]);
    }
  }, [partnerLoc?.lat, partnerLoc?.lng, destination?.lat, destination?.lng]);

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check next-themes and fallback to document class
    const checkTheme = () => {
      const dark = resolvedTheme === 'dark' || document.documentElement.classList.contains('dark');
      setIsDark(dark);
    };

    checkTheme();
    
    // Set up an observer for class changes on html element
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, [resolvedTheme]);

  const tileLayerUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

  return (
    <div className="w-full h-full bg-[#f3f4f6] dark:bg-[#111118] transition-colors">
      <MapContainer 
        center={[partnerLoc.lat, partnerLoc.lng]} 
        zoom={15} 
        maxZoom={22}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'} // Re-render when theme changes
          url={tileLayerUrl}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={22}
          maxNativeZoom={19}
          attribution='&copy; Google Maps'
        />
        
        <SmoothDriverMarker 
          position={[partnerLoc.lat, partnerLoc.lng]} 
          vehicleType="bike" 
          driverId="parcel-partner" 
          isAssignedDriver={true} 
        />
        
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />
        )}

        {route.length > 0 && (
          <Polyline 
            positions={route} 
            pathOptions={{ 
                color: routeColor, 
                weight: 5, 
                dashArray: isDashed ? '10, 10' : undefined 
            }} 
          />
        )}

        <MapController 
          location={[partnerLoc.lat, partnerLoc.lng]} 
          destination={destination} 
          onMapReady={(m) => { mapRef.current = m; }}
        />
      </MapContainer>

      {/* Floating GPS Recenter Button for Parcel Partner */}
      <button
        onClick={() => {
          if (mapRef.current) {
            mapRef.current.flyTo([partnerLoc.lat, partnerLoc.lng], 17, { animate: true });
          }
        }}
        className="absolute bottom-6 right-4 z-[400] w-12 h-12 rounded-full bg-white dark:bg-[#111118] border border-neutral-200 dark:border-neutral-700 shadow-xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
        title="Lenga Eneo Lako"
      >
        <div className="w-9 h-9 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.8" fill="currentColor" />
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
          </svg>
        </div>
      </button>
    </div>
  );
};

export default ParcelMapView;
