import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  mockDaladalaRoutes, 
  mockDaladalaVehicles, 
  mockTrafficReports, 
  mockFleetRecords, 
  mockTerminalQueues 
} from '../../data/daladalaData';
import { DaladalaRoute, DaladalaVehicle, DaladalaStop } from '../../types/daladala.types';
import DaladalaMap from './DaladalaMap';
import DaladalaPassengerView from './DaladalaPassengerView';
import DaladalaRoutePlanner from './DaladalaRoutePlanner';
import DaladalaConductorMode from './DaladalaConductorMode';
import DaladalaFleetManager from './DaladalaFleetManager';
import { 
  Bus, 
  ArrowLeft, 
  Layers, 
  Navigation, 
  Users, 
  Building2, 
  Radio, 
  ShieldCheck, 
  Maximize2, 
  Minimize2,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

export default function DaladalaHome() {
  const navigate = useNavigate();

  // Primary Ecosystem Mode: passenger (Abiria), conductor (Kondakta/Dereva), fleet (Mmiliki/Stendi)
  const [ecosystemMode, setEcosystemMode] = useState<'passenger' | 'conductor' | 'fleet'>('passenger');

  // State for data
  const [routes, setRoutes] = useState<DaladalaRoute[]>(mockDaladalaRoutes);
  const [vehicles, setVehicles] = useState<DaladalaVehicle[]>(mockDaladalaVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(mockDaladalaVehicles[0].id);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Route Planner visibility
  const [isRoutePlannerOpen, setIsRoutePlannerOpen] = useState(false);

  // Map Expanded state
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // Simulated User Location (Dar es Salaam)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>({
    lat: -6.8040,
    lng: 39.2310,
  });

  // Try real geolocation safely
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // If in Tanzania / Dar es Salaam vicinity
          if (pos.coords.latitude < -5 && pos.coords.latitude > -8) {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // 🚌 Live GPS Simulation Engine: Every 4 seconds, subtly progress vehicles along their routes
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          const route = routes.find((r) => r.id === v.routeId);
          if (!route || route.pathCoordinates.length === 0) return v;

          // Jitter lat/lng slightly to simulate realistic motion
          const deltaLat = (Math.random() - 0.48) * 0.0006;
          const deltaLng = (Math.random() - 0.48) * 0.0006;
          const newSpeed = Math.floor(25 + Math.random() * 25);
          const newEta = Math.max(1, v.etaMinutesToNextStop - (Math.random() > 0.6 ? 1 : 0));

          return {
            ...v,
            currentLat: v.currentLat + deltaLat,
            currentLng: v.currentLng + deltaLng,
            speedKmH: newSpeed,
            etaMinutesToNextStop: newEta,
            lastUpdated: 'Sekunde chache zilizopita',
          };
        })
      );
    }, 4500);

    return () => clearInterval(interval);
  }, [routes]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  // Conductor update vehicle callback
  const handleUpdateVehicle = (updated: Partial<DaladalaVehicle>) => {
    if (!selectedVehicleId) return;
    setVehicles((prev) =>
      prev.map((v) => (v.id === selectedVehicleId ? { ...v, ...updated } : v))
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100/70 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 shadow-sm px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Back button & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              title="Rudi Huduma Zote"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                    PapoDaladala
                  </h1>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                    LIVE GPS
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 hidden sm:block">
                  Mtandao Rasmi wa Daladala Dar es Salaam • LATRA Compliant
                </p>
              </div>
            </div>
          </div>

          {/* Ecosystem Mode Switcher: Abiria vs Kondakta vs Mmiliki */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-bold shadow-inner">
            <button
              onClick={() => setEcosystemMode('passenger')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                ecosystemMode === 'passenger'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Abiria</span>
            </button>

            <button
              onClick={() => setEcosystemMode('conductor')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                ecosystemMode === 'conductor'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Kondakta / Dereva</span>
            </button>

            <button
              onClick={() => setEcosystemMode('fleet')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                ecosystemMode === 'fleet'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Mmiliki / Stendi</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-3 sm:p-4 flex-1 flex flex-col space-y-4">
        {/* Map & Live Radar View */}
        <div className={`relative transition-all duration-300 ${isMapExpanded ? 'h-[550px]' : 'h-[300px] sm:h-[360px]'}`}>
          <DaladalaMap
            routes={routes}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
            selectedRouteId={selectedRouteId}
            onSelectStop={(stop) => {
              toast.info(`Kituo: ${stop.name} (${stop.isTerminal ? 'Stendi Kuu' : 'Kituo cha abiria'})`);
            }}
            userCoords={userCoords}
          />

          {/* Map Controls Floating Badge */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="p-2 rounded-xl bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-200 shadow-md backdrop-blur-sm hover:bg-white text-xs font-bold flex items-center gap-1"
              title={isMapExpanded ? 'Punguza Ukubwa wa Ramani' : 'Ongeza Ukubwa wa Ramani'}
            >
              {isMapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMapExpanded ? 'Punguza' : 'Panua Ramani'}</span>
            </button>

            <button
              onClick={() => setIsRoutePlannerOpen(true)}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Panga Ruti (Planner)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Route Planner Modal Overlay */}
        {isRoutePlannerOpen && (
          <DaladalaRoutePlanner
            routes={routes}
            onSelectRoute={(routeId) => setSelectedRouteId(routeId)}
            onClose={() => setIsRoutePlannerOpen(false)}
          />
        )}

        {/* View Switcher based on Ecosystem Mode */}
        {ecosystemMode === 'passenger' && (
          <DaladalaPassengerView
            routes={routes}
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
            trafficReports={mockTrafficReports}
            userCoords={userCoords}
            onOpenRoutePlanner={() => setIsRoutePlannerOpen(true)}
          />
        )}

        {ecosystemMode === 'conductor' && (
          selectedVehicle ? (
            <DaladalaConductorMode
              vehicle={selectedVehicle}
              route={routes.find((r) => r.id === selectedVehicle.routeId)}
              onUpdateVehicle={handleUpdateVehicle}
            />
          ) : (
            <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-sm font-bold text-neutral-500">Tafadhali chagua daladala kwenye ramani kwanza.</p>
            </div>
          )
        )}

        {ecosystemMode === 'fleet' && (
          <DaladalaFleetManager
            fleetRecords={mockFleetRecords}
            terminals={mockTerminalQueues}
          />
        )}
      </main>
    </div>
  );
}
