import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DaladalaRoute, DaladalaVehicle, DaladalaStop } from '../../types/daladala.types';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom Bus Icon Generator
const createBusIcon = (vehicle: DaladalaVehicle, isSelected: boolean) => {
  const seatBg = 
    vehicle.seatStatus === 'available' ? '#16a34a' :
    vehicle.seatStatus === 'few' ? '#ca8a04' :
    vehicle.seatStatus === 'standing' ? '#ea580c' : '#dc2626';

  const seatLabel = 
    vehicle.seatStatus === 'available' ? `${vehicle.capacity - vehicle.seatsTaken} Viti` :
    vehicle.seatStatus === 'few' ? `${vehicle.capacity - vehicle.seatsTaken} Viti` :
    vehicle.seatStatus === 'standing' ? 'Msimamo' : 'FULL';

  const html = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: scale(${isSelected ? '1.2' : '1'}); transition: transform 0.3s;">
      <div style="
        background: ${vehicle.colorHex || '#2563eb'};
        color: white;
        padding: 4px 7px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 800;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        border: 2px solid white;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
          <path d="M4 11h16"/>
          <path d="M6 18v2"/>
          <path d="M18 18v2"/>
          <circle cx="8" cy="14" r="1.5"/>
          <circle cx="16" cy="14" r="1.5"/>
        </svg>
        <span>${vehicle.plateNumber}</span>
      </div>
      <div style="
        background: ${seatBg};
        color: white;
        font-size: 8px;
        font-weight: 900;
        padding: 1px 5px;
        border-radius: 4px;
        margin-top: -3px;
        border: 1px solid white;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">
        ${seatLabel}
      </div>
      ${vehicle.isOffRoute ? `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ef4444;
          color: white;
          border-radius: 9999px;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: bold;
          border: 1.5px solid white;
          animation: pulse 1.5s infinite;
        ">!</div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'daladala-bus-marker',
    iconSize: [80, 40],
    iconAnchor: [40, 20],
  });
};

// Custom Stop Icon
const createStopIcon = (stop: DaladalaStop) => {
  const html = `
    <div style="
      width: ${stop.isTerminal ? '16px' : '10px'};
      height: ${stop.isTerminal ? '16px' : '10px'};
      background: ${stop.isTerminal ? '#ea580c' : '#ffffff'};
      border: 2.5px solid ${stop.isTerminal ? '#ffffff' : '#2563eb'};
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>
  `;

  return L.divIcon({
    html,
    className: 'daladala-stop-marker',
    iconSize: [stop.isTerminal ? 16 : 10, stop.isTerminal ? 16 : 10],
    iconAnchor: [stop.isTerminal ? 8 : 5, stop.isTerminal ? 8 : 5],
  });
};

interface DaladalaMapProps {
  routes: DaladalaRoute[];
  vehicles: DaladalaVehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (v: DaladalaVehicle) => void;
  selectedRouteId: string | null;
  onSelectStop?: (stop: DaladalaStop) => void;
  userCoords?: { lat: number; lng: number } | null;
}

// Controller to auto-pan when selected vehicle changes
function MapRecenter({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 14, { duration: 1.2 });
    }
  }, [targetCoords, map]);
  return null;
}

export default function DaladalaMap({
  routes,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  selectedRouteId,
  onSelectStop,
  userCoords,
}: DaladalaMapProps) {
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const activeRoutes = selectedRouteId
    ? routes.filter((r) => r.id === selectedRouteId)
    : routes;

  const defaultCenter: [number, number] = [-6.8140, 39.2450]; // Central Dar es Salaam

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-neutral-200 dark:border-neutral-800">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selectedVehicle && (
          <MapRecenter targetCoords={[selectedVehicle.currentLat, selectedVehicle.currentLng]} />
        )}

        {/* Polylines for Daladala Routes */}
        {activeRoutes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.pathCoordinates}
            pathOptions={{
              color: route.color,
              weight: selectedRouteId === route.id ? 6 : 4,
              opacity: selectedRouteId === route.id ? 0.9 : 0.65,
              dashArray: selectedRouteId === route.id ? undefined : '4, 4',
            }}
          >
            <Tooltip sticky>
              <div className="text-xs font-bold text-neutral-900">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] mr-1">
                  {route.routeCode}
                </span>
                {route.name}
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* Bus Stops */}
        {activeRoutes.flatMap((route) =>
          route.stops.map((stop) => (
            <Marker
              key={`${route.id}-${stop.id}`}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(stop)}
              eventHandlers={{
                click: () => onSelectStop && onSelectStop(stop),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    <h4 className="font-bold text-xs text-neutral-900">{stop.name}</h4>
                  </div>
                  <p className="text-[10px] text-neutral-600 mb-2">
                    {stop.isTerminal ? 'Stendi Kuu (Terminal)' : `Kituo cha ${stop.zone || 'Daladala'}`}
                  </p>
                  {onSelectStop && (
                    <button
                      onClick={() => onSelectStop(stop)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-2 rounded transition"
                    >
                      Panda / Shuka Hapa
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))
        )}

        {/* Moving Daladala Vehicles */}
        {vehicles.map((v) => {
          const isSelected = v.id === selectedVehicleId;
          return (
            <Marker
              key={v.id}
              position={[v.currentLat, v.currentLng]}
              icon={createBusIcon(v, isSelected)}
              eventHandlers={{
                click: () => onSelectVehicle(v),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[210px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-neutral-900">{v.plateNumber}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      {v.routeCode}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-blue-700 italic">"{v.nickname}"</div>
                  <div className="text-[11px] text-neutral-600">
                    Kuelekea: <strong className="text-neutral-800">{v.nextStopName}</strong> (Dk {v.etaMinutesToNextStop})
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-neutral-100">
                    <span className="text-neutral-500">Spidi: {v.speedKmH} km/h</span>
                    <span className="font-bold text-emerald-600">
                      {v.seatStatus === 'available' ? 'Viti Wazi' : v.seatStatus}
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectVehicle(v)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 rounded-lg shadow-sm transition"
                  >
                    Angalia Safari & Tiketi
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* User Current Location Marker */}
        {userCoords && (
          <Marker
            position={[userCoords.lat, userCoords.lng]}
            icon={L.divIcon({
              html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                  <div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(59, 130, 246, 0.25); animation: ping 1.5s infinite; position: absolute;"></div>
                  <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
                </div>
              `,
              className: 'user-location-marker',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Tooltip>Uko hapa</Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
