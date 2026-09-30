import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DaladalaRoute, DaladalaVehicle, DaladalaStop } from '../../types/daladala.types';
import { 
  Bus, 
  Navigation, 
  Crown, 
  User, 
  Phone, 
  TrendingUp, 
  Clock, 
  Gauge, 
  Maximize2 
} from 'lucide-react';

interface DaladalaOwnerFleetMapProps {
  vehicles: DaladalaVehicle[];
  routes: DaladalaRoute[];
  selectedVehicleId: string | null;
  onSelectVehicle: (v: DaladalaVehicle) => void;
}

// Controller to auto-center when a vehicle is selected
function MapRecenter({ selectedVehicle }: { selectedVehicle?: DaladalaVehicle }) {
  const map = useMap();
  useEffect(() => {
    if (selectedVehicle) {
      map.flyTo([selectedVehicle.currentLat, selectedVehicle.currentLng], 14, { duration: 1.2 });
    }
  }, [selectedVehicle, map]);
  return null;
}

// Authentic Glowing Gold Owner Vehicle Marker
const createOwnerBusMarkerIcon = (vehicle: DaladalaVehicle, isSelected: boolean) => {
  const shortPlate = vehicle.plateNumber.replace(/^T\s*/, '');
  const seatsLeft = Math.max(0, vehicle.capacity - vehicle.seatsTaken);

  const html = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; z-index: ${isSelected ? 500 : 300};">
      <!-- Crown Tag -->
      <div style="
        position: absolute;
        top: -12px;
        background: #f59e0b;
        color: #0f172a;
        border-radius: 9999px;
        font-size: 8.5px;
        font-weight: 900;
        padding: 1px 6px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.35);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 2px;
        letter-spacing: -0.02em;
      ">
        👑 ${shortPlate}
      </div>

      <!-- Marker Body -->
      <div style="
        display: flex;
        align-items: center;
        background: #ffffff;
        border: ${isSelected ? '3px solid #2563eb' : '2.5px solid #f59e0b'};
        border-radius: 9999px;
        padding: 3px 8px 3px 4px;
        gap: 5px;
        box-shadow: ${isSelected ? '0 0 15px rgba(37,99,235,0.7)' : '0 4px 10px rgba(245,158,11,0.5)'};
        cursor: pointer;
        transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
        transition: transform 0.2s ease;
      ">
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f59e0b;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 11px;
        ">
          🚌
        </div>
        <div style="display: flex; flex-direction: column; line-height: 1.1;">
          <span style="font-weight: 900; font-size: 10px; color: #0f172a;">${vehicle.nickname}</span>
          <span style="font-size: 8.5px; font-weight: 700; color: #16a34a;">${vehicle.speedKmH} km/h • ${seatsLeft} wazi</span>
        </div>
      </div>

      <!-- Arrow Pointer -->
      <div style="
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid #f59e0b;
        margin-top: -1px;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'daladala-owner-map-icon',
    iconSize: [110, 42],
    iconAnchor: [55, 38],
  });
};

export default function DaladalaOwnerFleetMap({
  vehicles,
  routes,
  selectedVehicleId,
  onSelectVehicle,
}: DaladalaOwnerFleetMapProps) {
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const defaultCenter: [number, number] = vehicles[0] 
    ? [vehicles[0].currentLat, vehicles[0].currentLng]
    : [-6.8140, 39.2450];

  // Associated routes for owner vehicles
  const activeRoutes = useMemo(() => {
    const routeIds = new Set(vehicles.map((v) => v.routeId));
    return routes.filter((r) => routeIds.has(r.id));
  }, [routes, vehicles]);

  return (
    <div className="relative w-full h-[450px] sm:h-[500px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-inner">
      {/* Top Banner */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 pointer-events-auto">
          <div className="w-6 h-6 rounded-lg bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-xs">
            👑
          </div>
          <div>
            <h4 className="text-xs font-black text-neutral-900 dark:text-white">
              Ramani ya Vyombo Vyako Tu ({vehicles.length})
            </h4>
            <p className="text-[10px] text-neutral-500">
              Live GPS Radar • Hakuna mabasi ya watu wengine
            </p>
          </div>
        </div>

        <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-300 pointer-events-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Vinafanya kazi sasa</span>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors, HOT'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapRecenter selectedVehicle={selectedVehicle} />

        {/* Route Polylines */}
        {activeRoutes.map((route) => (
          <Polyline
            key={`owner_route_${route.id}`}
            positions={route.pathCoordinates}
            pathOptions={{
              color: route.color || '#f59e0b',
              weight: 4,
              opacity: 0.75,
              dashArray: '4, 8',
            }}
          />
        ))}

        {/* Owner Daladala Markers */}
        {vehicles.map((v) => {
          const isSelected = selectedVehicleId === v.id;
          return (
            <Marker
              key={`owner_marker_${v.id}`}
              position={[v.currentLat, v.currentLng]}
              icon={createOwnerBusMarkerIcon(v, isSelected)}
              eventHandlers={{
                click: () => onSelectVehicle(v),
              }}
            >
              <Popup className="daladala-custom-popup">
                <div className="p-3 text-xs space-y-2 min-w-[200px]">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <div>
                      <strong className="text-sm font-black text-neutral-900 block">{v.plateNumber}</strong>
                      <span className="text-[10px] text-neutral-500">"{v.nickname}" • {v.routeCode}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[9px]">
                      👑 Gari Lako
                    </span>
                  </div>

                  <div className="space-y-1 text-neutral-600">
                    <p>👨‍✈️ <strong>Dereva:</strong> {v.driverName}</p>
                    <p>🎫 <strong>Konda:</strong> {v.conductorName}</p>
                    <p>⚡ <strong>Kasi:</strong> {v.speedKmH} km/h</p>
                    <p>📍 <strong>Kuelekea:</strong> {v.nextStopName}</p>
                    <p>💺 <strong>Viti:</strong> {v.seatsTaken}/{v.capacity} (Wazi: {Math.max(0, v.capacity - v.seatsTaken)})</p>
                  </div>

                  <button
                    onClick={() => onSelectVehicle(v)}
                    className="w-full py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                  >
                    Tazama Diteli Zote za Gari Hili
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
