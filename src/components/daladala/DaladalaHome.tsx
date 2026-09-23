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
  MapPin,
  ChevronUp,
  ChevronDown,
  X
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

  // Map sizing modes: isMapExpanded (tall height in page) & isFullscreenMap (true full-screen kioo kizima)
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [isBottomSheetCollapsed, setIsBottomSheetCollapsed] = useState(false);

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

      {/* Fullscreen Map Overlay (Kioo Kizima) */}
      {isFullscreenMap && (
        <div className="fixed inset-0 z-[200] w-screen h-screen bg-neutral-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Floating Top Nav in Fullscreen */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setIsFullscreenMap(false)}
                className="px-3.5 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-950 text-white border border-neutral-700/80 shadow-2xl backdrop-blur-md text-xs font-black flex items-center gap-2 transition active:scale-95"
                title="Toka Kioo Kizima"
              >
                <Minimize2 className="w-4 h-4 text-orange-400" />
                <span>Toka Kioo Kizima</span>
              </button>

              <div className="px-3 py-2 rounded-xl bg-blue-600/90 text-white shadow-xl backdrop-blur-md text-xs font-bold hidden sm:flex items-center gap-1.5">
                <Bus className="w-4 h-4" />
                <span>PapoDaladala Live GPS</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Ecosystem switch in fullscreen */}
              <div className="hidden md:flex items-center bg-neutral-900/90 border border-neutral-700/80 backdrop-blur-md p-1 rounded-xl text-xs font-bold text-neutral-300">
                <button
                  onClick={() => setEcosystemMode('passenger')}
                  className={`px-2.5 py-1 rounded-lg ${ecosystemMode === 'passenger' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  Abiria
                </button>
                <button
                  onClick={() => setEcosystemMode('conductor')}
                  className={`px-2.5 py-1 rounded-lg ${ecosystemMode === 'conductor' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  Kondakta
                </button>
                <button
                  onClick={() => setEcosystemMode('fleet')}
                  className={`px-2.5 py-1 rounded-lg ${ecosystemMode === 'fleet' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
                >
                  Mmiliki
                </button>
              </div>

              <button
                onClick={() => setIsRoutePlannerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xl backdrop-blur-md text-xs font-black flex items-center gap-1.5 transition active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Panga Ruti</span>
              </button>
            </div>
          </div>

          {/* Map Canvas taking 100% viewport */}
          <div className="flex-1 w-full h-full relative">
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
              resizeTrigger={isFullscreenMap}
              isEdgeToEdge={true}
            />
          </div>

          {/* Floating Bottom Drawer / Quick Vehicle Switcher in Fullscreen */}
          <div className="absolute bottom-4 left-3 right-3 z-20 pointer-events-none flex flex-col items-center">
            <div className="w-full max-w-xl bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto overflow-hidden transition-all">
              {/* Drawer Header & Minimize Button */}
              <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs">
                <span className="font-extrabold text-neutral-300 flex items-center gap-1.5">
                  <Bus className="w-3.5 h-3.5 text-blue-400" />
                  Magari Yanayosafiri ({vehicles.length})
                </span>
                <button
                  onClick={() => setIsBottomSheetCollapsed(!isBottomSheetCollapsed)}
                  className="text-neutral-400 hover:text-white flex items-center gap-1 font-bold text-[11px]"
                >
                  {isBottomSheetCollapsed ? (
                    <>
                      <span>Fungua Maelezo</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Ficha Maelezo</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {!isBottomSheetCollapsed && (
                <div className="p-3 space-y-2.5">
                  {selectedVehicle ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white tracking-wide">{selectedVehicle.plateNumber}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                              {selectedVehicle.routeCode}
                            </span>
                            <span className="text-xs text-neutral-400 italic">"{selectedVehicle.nickname}"</span>
                          </div>
                          <p className="text-xs text-neutral-300 mt-0.5">
                            Kuelekea: <strong className="text-white">{selectedVehicle.nextStopName}</strong> (Dk {selectedVehicle.etaMinutesToNextStop})
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            selectedVehicle.seatStatus === 'available'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : selectedVehicle.seatStatus === 'few'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}>
                            {selectedVehicle.seatStatus === 'available' 
                              ? `${selectedVehicle.capacity - selectedVehicle.seatsTaken} Viti Wazi` 
                              : selectedVehicle.seatStatus}
                          </span>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{selectedVehicle.speedKmH} km/h</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => {
                            toast.success(`Kengele ya kushuka imewekwa kwa ajili ya kituo cha ${selectedVehicle.nextStopName}!`);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-neutral-700 transition"
                        >
                          <span>🔔 Nishushe Hapa</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsFullscreenMap(false);
                            toast.info(`Angalia maelezo na tiketi ya ${selectedVehicle.plateNumber}`);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition"
                        >
                          <span>🎫 Panda / Tiketi</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 text-center py-1">
                      Bofya gari lolote kwenye ramani kuona taarifa zake na viti vilivyobaki.
                    </p>
                  )}

                  {/* Horizontal Vehicle Picker */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-neutral-800">
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVehicleId(v.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                          v.id === selectedVehicleId
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Bus className="w-3 h-3" />
                        <span>{v.plateNumber}</span>
                        <span className="text-[9px] opacity-75">({v.routeCode})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edge-to-Edge Full Width Map Section (Standard View) */}
      <section className={`relative w-full transition-all duration-300 ${isMapExpanded ? 'h-[560px] sm:h-[640px]' : 'h-[360px] sm:h-[440px]'}`}>
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
          resizeTrigger={isMapExpanded}
          isEdgeToEdge={true}
        />

        {/* Map Controls Floating Badge */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {/* True Fullscreen Button */}
          <button
            onClick={() => setIsFullscreenMap(true)}
            className="px-3 py-2 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-100 shadow-lg backdrop-blur-md hover:bg-white dark:hover:bg-neutral-800 text-xs font-black flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700 transition active:scale-95"
            title="Fungua Kioo Kizima (Fullscreen Map)"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Kioo Kizima (Full)</span>
          </button>

          {/* Toggle Map Height in Page */}
          <button
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="p-2 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-200 shadow-md backdrop-blur-md hover:bg-white dark:hover:bg-neutral-800 text-xs font-bold flex items-center gap-1 border border-neutral-200 dark:border-neutral-700 transition active:scale-95"
            title={isMapExpanded ? 'Punguza Urefu wa Ramani' : 'Ongeza Urefu wa Ramani'}
          >
            {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMapExpanded ? 'Punguza' : 'Panua'}</span>
          </button>

          {/* Route Planner trigger */}
          <button
            onClick={() => setIsRoutePlannerOpen(true)}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Panga Ruti (Planner)</span>
            <span className="sm:hidden">Ruti</span>
          </button>
        </div>
      </section>

      {/* Main Container for Details, Filters, and Subviews */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 flex-1 flex flex-col space-y-4 pb-28 md:pb-16">
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
