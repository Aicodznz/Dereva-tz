import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { usePartnerLocation } from '../../../hooks/parcel/partner/usePartnerLocation';
import { useTheme } from 'next-themes';

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

const MapController = ({ location, destination }: { location: [number, number], destination?: {lat:number, lng:number} }) => {
  const map = useMap();
  
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

  useEffect(() => {
    if (destination && partnerLoc) {
      fetch(`https://router.project-osrm.org/route/v1/driving/${partnerLoc.lng},${partnerLoc.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
            setRoute(coords);
          }
        });
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

  const tileLayerUrl = isDark 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <div className="w-full h-full bg-[#f3f4f6] dark:bg-[#111118] transition-colors">
      <MapContainer 
        center={[partnerLoc.lat, partnerLoc.lng]} 
        zoom={15} 
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'} // Re-render when theme changes
          url={tileLayerUrl}
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        
        <Marker position={[partnerLoc.lat, partnerLoc.lng]} icon={partnerIcon} />
        
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

        <MapController location={[partnerLoc.lat, partnerLoc.lng]} destination={destination} />
      </MapContainer>
    </div>
  );
};

export default ParcelMapView;
