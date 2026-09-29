import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  mockDaladalaRoutes, 
  mockDaladalaVehicles, 
  mockTrafficReports, 
  mockFleetRecords, 
  mockTerminalQueues,
  mockDaladalaPassengers
} from '../../data/daladalaData';
import { 
  DaladalaRoute, 
  DaladalaVehicle, 
  DaladalaStop, 
  FleetVehicleRecord, 
  DaladalaPassengerRecord,
  DaladalaSessionUser,
  DaladalaUserRole,
  DaladalaOwnerProfile
} from '../../types/daladala.types';
import DaladalaMap from './DaladalaMap';
import DaladalaPassengerView from './DaladalaPassengerView';
import DaladalaRoutePlanner from './DaladalaRoutePlanner';
import DaladalaConductorMode from './DaladalaConductorMode';
import DaladalaFleetManager from './DaladalaFleetManager';
import DaladalaRegisterPassengerModal from './DaladalaRegisterPassengerModal';
import DaladalaRegisterVehicleModal from './DaladalaRegisterVehicleModal';
import DaladalaAuthModal from './DaladalaAuthModal';
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
  X,
  PlusCircle,
  UserPlus,
  Lock,
  LogOut,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function DaladalaHome() {
  const navigate = useNavigate();

  // ----------------------------------------------------
  // OPERATOR AUTHENTICATION & ROLE-BASED ACCESS CONTROL
  // ----------------------------------------------------
  const [sessionUser, setSessionUser] = useState<DaladalaSessionUser | null>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_session_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialRole, setAuthModalInitialRole] = useState<DaladalaUserRole>('owner');

  // Primary Ecosystem Mode: passenger (Abiria), conductor (Kondakta/Dereva), fleet (Mmiliki/Stendi)
  const [ecosystemMode, setEcosystemMode] = useState<'passenger' | 'conductor' | 'fleet'>(() => {
    try {
      const savedUserRaw = localStorage.getItem('papo_daladala_session_user');
      if (savedUserRaw) {
        const u: DaladalaSessionUser = JSON.parse(savedUserRaw);
        if (u.role === 'owner') return 'fleet';
        if (u.role === 'conductor' || u.role === 'driver') return 'conductor';
      }
    } catch (e) {}
    return 'passenger';
  });

  // State for data
  const [routes, setRoutes] = useState<DaladalaRoute[]>(mockDaladalaRoutes);
  const [vehicles, setVehicles] = useState<DaladalaVehicle[]>(mockDaladalaVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Customer Journey Filter State: Kituo cha kupandia, ruti, kituo cha kushukia
  const [filterBoardingStop, setFilterBoardingStop] = useState<string>('');
  const [filterRouteId, setFilterRouteId] = useState<string>('all');
  const [filterAlightStop, setFilterAlightStop] = useState<string>('');
  const [filterSearchQuery, setFilterSearchQuery] = useState<string>('');
  const [filterSeatStatus, setFilterSeatStatus] = useState<'all' | 'available_only'>('all');

  // Custom fleets registered by specific owners
  const [customOwnerVehicles, setCustomOwnerVehicles] = useState<Record<string, FleetVehicleRecord[]>>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_owner_fleets');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Fleet records state (stored and initialized from mockFleetRecords)
  const [fleetRecords, setFleetRecords] = useState<FleetVehicleRecord[]>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_fleet_records');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return mockFleetRecords;
  });

  // Passengers manifest state
  const [passengers, setPassengers] = useState<DaladalaPassengerRecord[]>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_passengers_manifest');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return mockDaladalaPassengers;
  });

  // Modal and dropdown states for operators
  const [isRegisterVehicleOpen, setIsRegisterVehicleOpen] = useState(false);
  const [isRegisterPassengerOpen, setIsRegisterPassengerOpen] = useState(false);
  const [isOperatorDropdownOpen, setIsOperatorDropdownOpen] = useState(false);

  // Sync session changes
  const handleLoginSuccess = (user: DaladalaSessionUser) => {
    setSessionUser(user);
    try {
      localStorage.setItem('papo_daladala_session_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }

    if (user.role === 'owner') {
      setEcosystemMode('fleet');
    } else if (user.role === 'conductor' || user.role === 'driver') {
      setEcosystemMode('conductor');
      // If assigned to a plate, select that vehicle
      if (user.assignedPlate) {
        const found = vehicles.find((v) => v.plateNumber === user.assignedPlate);
        if (found) setSelectedVehicleId(found.id);
      }
    } else {
      setEcosystemMode('passenger');
    }
  };

  const handleLogout = () => {
    setSessionUser(null);
    try {
      localStorage.removeItem('papo_daladala_session_user');
    } catch (e) {
      console.error(e);
    }
    setEcosystemMode('passenger');
    setIsRegisterVehicleOpen(false);
    setIsRegisterPassengerOpen(false);
    toast.success('Umetoka kikamilifu kwenye akaunti ya mhusika. Sasa uko kama Abiria wa kawaida.');
  };

  // Helper guard: restricts feature to logged-in role
  const requireRole = (targetRole: 'owner' | 'conductor', onAllowed: () => void) => {
    if (!sessionUser) {
      setAuthModalInitialRole(targetRole);
      setIsAuthModalOpen(true);
      toast.info(`Tafadhali ingia au jisajili kama ${targetRole === 'owner' ? 'Mmiliki wa Daladala' : 'Kondakta au Dereva'} kwanza.`);
      return false;
    }

    if (targetRole === 'owner' && sessionUser.role !== 'owner') {
      setAuthModalInitialRole('owner');
      setIsAuthModalOpen(true);
      toast.warning(`Umeingia kama ${sessionUser.role === 'conductor' ? 'Kondakta' : 'Abiria'}. Sehemu hii ya mapato na hesabu ni ya Wamiliki wa Daladala pekee.`);
      return false;
    }

    if (targetRole === 'conductor' && sessionUser.role !== 'conductor' && sessionUser.role !== 'driver' && sessionUser.role !== 'owner') {
      setAuthModalInitialRole('conductor');
      setIsAuthModalOpen(true);
      toast.warning(`Tafadhali ingia kama Kondakta au Dereva.`);
      return false;
    }

    onAllowed();
    return true;
  };

  // Determine which fleet records to display for the active owner
  const currentOwnerFleetRecords = React.useMemo(() => {
    if (!sessionUser || sessionUser.role !== 'owner') return [];
    if (sessionUser.isCustomRegistered) {
      return customOwnerVehicles[sessionUser.id] || [];
    }
    // Demo Mzee Mwinyi (owner_01)
    return fleetRecords;
  }, [sessionUser, customOwnerVehicles, fleetRecords]);

  // Determine owner profile
  const currentOwnerProfile: DaladalaOwnerProfile = React.useMemo(() => {
    if (sessionUser && sessionUser.role === 'owner') {
      return {
        id: sessionUser.id,
        fullName: sessionUser.fullName,
        phone: sessionUser.phone,
        email: sessionUser.email || `${sessionUser.phone}@daladala.tz`,
        nidaNumber: sessionUser.nidaNumber || '19800101-11101-00001-01',
        organizationName: sessionUser.organizationName || 'Chama cha Wamiliki wa Daladala (UWADAR)',
        zone: 'Dar es Salaam',
        mPesaNumber: sessionUser.mPesaNumber || sessionUser.phone,
        joinedDate: sessionUser.joinedDate || '2024-01-01',
        verified: true,
      };
    }
    return {
      id: 'owner_01',
      fullName: 'Mzee Juma Rashidi Mwinyi',
      phone: '0754 892 110',
      email: 'mwinyitransport@gmail.com',
      nidaNumber: '19750814-11105-00002-19',
      organizationName: 'Mwinyi Coastal Express (UWADAR #428)',
      zone: 'Ilala / Kivukoni',
      mPesaNumber: '0754 892 110',
      joinedDate: '2023-04-12',
      verified: true,
    };
  }, [sessionUser]);

  // Handler for registering a passenger on a vehicle
  const handleRegisterPassenger = (newPassenger: DaladalaPassengerRecord) => {
    setPassengers((prev) => {
      const updated = [newPassenger, ...prev];
      try {
        localStorage.setItem('papo_daladala_passengers_manifest', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // Update vehicle seats taken
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === newPassenger.vehicleId || v.plateNumber === newPassenger.plateNumber) {
          const newTaken = Math.min(v.capacity, v.seatsTaken + 1);
          return {
            ...v,
            seatsTaken: newTaken,
            seatStatus: (v.capacity - newTaken) === 0 ? 'full' : (v.capacity - newTaken) <= 3 ? 'few' : 'available',
            lastUpdated: 'Muda huu',
          };
        }
        return v;
      })
    );

    // Update fleet record today revenue
    setFleetRecords((prev) => {
      const updated = prev.map((f) => {
        if (f.plateNumber === newPassenger.plateNumber) {
          return {
            ...f,
            todayRevenueTzs: f.todayRevenueTzs + newPassenger.fareTzs,
            cashCollectedTzs: newPassenger.paymentMethod === 'cash' ? f.cashCollectedTzs + newPassenger.fareTzs : f.cashCollectedTzs,
            digitalCollectedTzs: newPassenger.paymentMethod !== 'cash' ? f.digitalCollectedTzs + newPassenger.fareTzs : f.digitalCollectedTzs,
          };
        }
        return f;
      });
      try {
        localStorage.setItem('papo_daladala_fleet_records', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Handler for adding a new vehicle registered by the owner
  const handleAddVehicle = (newVehicle: DaladalaVehicle, newFleetRecord: FleetVehicleRecord) => {
    setVehicles((prev) => [newVehicle, ...prev]);
    setFleetRecords((prev) => {
      const updated = [newFleetRecord, ...prev];
      try {
        localStorage.setItem('papo_daladala_fleet_records', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // If custom registered owner, save to their personal fleet
    if (sessionUser && sessionUser.role === 'owner') {
      setCustomOwnerVehicles((prev) => {
        const ownerList = prev[sessionUser.id] || [];
        const updated = [newFleetRecord, ...ownerList];
        const nextState = { ...prev, [sessionUser.id]: updated };
        try {
          localStorage.setItem('papo_daladala_owner_fleets', JSON.stringify(nextState));
        } catch (e) {}
        return nextState;
      });
    }

    setSelectedVehicleId(newVehicle.id);
    setEcosystemMode('fleet'); // Take owner directly to their dashboard!
  };

  // Handler for adding a new route registered by the owner
  const handleAddRoute = (newRoute: DaladalaRoute) => {
    setRoutes((prev) => [newRoute, ...prev]);
    setSelectedRouteId(newRoute.id);
  };

  // Handler for updating vehicle crew (driver & conductor)
  const handleUpdateVehicleCrew = (vehicleId: string, driverName: string, conductorName: string, conductorPhone: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicleId
          ? { ...v, driverName, conductorName, conductorPhone }
          : v
      )
    );
    const targetVeh = vehicles.find((v) => v.id === vehicleId);
    if (targetVeh) {
      setFleetRecords((prev) => {
        const updated = prev.map((f) =>
          f.plateNumber === targetVeh.plateNumber
            ? { ...f, driverName, conductorName }
            : f
        );
        try {
          localStorage.setItem('papo_daladala_fleet_records', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }
  };

  // Route Planner visibility
  const [isRoutePlannerOpen, setIsRoutePlannerOpen] = useState(false);

  // Map sizing modes
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
          if (pos.coords.latitude < -5 && pos.coords.latitude > -8) {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Live GPS Simulation Engine
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          const route = routes.find((r) => r.id === v.routeId);
          if (!route || route.pathCoordinates.length === 0) return v;

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

  // Filter Daladalas according to customer criteria: Kituo cha kupandia, Ruti, Kituo cha Kushukia
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // 1. Route filter
      if (filterRouteId !== 'all') {
        if (v.routeId !== filterRouteId && v.routeCode !== filterRouteId) {
          return false;
        }
      }

      // Find route to inspect stops
      const vehicleRoute = routes.find((r) => r.id === v.routeId);

      // 2. Kituo cha Kupandia (Boarding Stop)
      if (filterBoardingStop.trim()) {
        const bTerm = filterBoardingStop.trim().toLowerCase();
        const hasBoardingStop = 
          vehicleRoute?.stops.some((s) => s.name.toLowerCase().includes(bTerm) || (s.zone && s.zone.toLowerCase().includes(bTerm))) ||
          v.nextStopName.toLowerCase().includes(bTerm) ||
          v.routeName.toLowerCase().includes(bTerm);

        if (!hasBoardingStop) return false;
      }

      // 3. Kituo cha Kushukia (Alight Stop)
      if (filterAlightStop.trim()) {
        const aTerm = filterAlightStop.trim().toLowerCase();
        const hasAlightStop = 
          vehicleRoute?.stops.some((s) => s.name.toLowerCase().includes(aTerm) || (s.zone && s.zone.toLowerCase().includes(aTerm))) ||
          vehicleRoute?.destination.toLowerCase().includes(aTerm) ||
          v.routeName.toLowerCase().includes(aTerm);

        if (!hasAlightStop) return false;
      }

      // 4. If BOTH Boarding & Alight Stop are entered, verify that route serves both!
      if (filterBoardingStop.trim() && filterAlightStop.trim() && vehicleRoute) {
        const bTerm = filterBoardingStop.trim().toLowerCase();
        const aTerm = filterAlightStop.trim().toLowerCase();
        const hasBoth = 
          vehicleRoute.stops.some((s) => s.name.toLowerCase().includes(bTerm) || (s.zone && s.zone.toLowerCase().includes(bTerm))) &&
          vehicleRoute.stops.some((s) => s.name.toLowerCase().includes(aTerm) || (s.zone && s.zone.toLowerCase().includes(aTerm)));
        
        if (!hasBoth) return false;
      }

      // 5. Seat Status
      if (filterSeatStatus === 'available_only') {
        if (v.seatStatus !== 'available' && v.seatStatus !== 'few') {
          return false;
        }
      }

      // 6. Free text search query (Plate, Nickname, Driver, Route)
      if (filterSearchQuery.trim()) {
        const q = filterSearchQuery.trim().toLowerCase();
        const matchPlate = v.plateNumber.toLowerCase().includes(q);
        const matchNickname = v.nickname.toLowerCase().includes(q);
        const matchRoute = v.routeName.toLowerCase().includes(q);
        const matchNextStop = v.nextStopName.toLowerCase().includes(q);
        const matchDriver = v.driverName.toLowerCase().includes(q);
        if (!matchPlate && !matchNickname && !matchRoute && !matchNextStop && !matchDriver) {
          return false;
        }
      }

      return true;
    });
  }, [vehicles, routes, filterRouteId, filterBoardingStop, filterAlightStop, filterSeatStatus, filterSearchQuery]);

  const selectedVehicle = selectedVehicleId ? (filteredVehicles.find((v) => v.id === selectedVehicleId) || null) : null;

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

          {/* Right Action Elements: Mode Switcher & Operator Auth Badge */}
          <div className="flex items-center gap-2">
            {/* Ecosystem Mode Switcher with Role Guards */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-bold shadow-inner">
              {/* Abiria (Public - Always accessible) */}
              <button
                onClick={() => setEcosystemMode('passenger')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  ecosystemMode === 'passenger'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title="Hali ya Abiria"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Abiria</span>
              </button>

              {/* Kondakta (Protected) */}
              <button
                onClick={() => {
                  requireRole('conductor', () => setEcosystemMode('conductor'));
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  ecosystemMode === 'conductor'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title={sessionUser?.role === 'conductor' || sessionUser?.role === 'driver' || sessionUser?.role === 'owner' ? 'Hali ya Kondakta na Dereva' : 'Inahitaji Kuingia kama Konda/Dereva'}
              >
                {(!sessionUser || (sessionUser.role !== 'conductor' && sessionUser.role !== 'driver' && sessionUser.role !== 'owner')) ? (
                  <Lock className="w-3 h-3 text-neutral-400" />
                ) : (
                  <Radio className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Kondakta</span>
                <span className="sm:hidden">Konda</span>
              </button>

              {/* Mmiliki / Stendi (Protected) */}
              <button
                onClick={() => {
                  requireRole('owner', () => setEcosystemMode('fleet'));
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  ecosystemMode === 'fleet'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title={sessionUser?.role === 'owner' ? 'Dasibodi ya Mmiliki wa Daladala' : 'Inahitaji Kuingia kama Mmiliki'}
              >
                {(!sessionUser || sessionUser.role !== 'owner') ? (
                  <Lock className="w-3 h-3 text-neutral-400" />
                ) : (
                  <Building2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Mmiliki</span>
                <span className="sm:hidden">Mmiliki</span>
              </button>
            </div>

            {/* Operator Login / User Profile Capsule */}
            {sessionUser ? (
              <div className="flex items-center gap-1.5">
                <div className={`px-2.5 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${
                  sessionUser.role === 'owner'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : sessionUser.role === 'conductor' || sessionUser.role === 'driver'
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[100px] sm:max-w-[130px] truncate">
                    {sessionUser.fullName.split(' ')[0]}
                  </span>
                  <span className="text-[10px] font-black uppercase opacity-75 hidden md:inline">
                    ({sessionUser.role === 'owner' ? 'Tajiri' : sessionUser.role === 'conductor' ? 'Konda' : sessionUser.role === 'driver' ? 'Dereva' : 'Abiria'})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition"
                  title="Ondoka (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalInitialRole('owner');
                  setIsAuthModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5 text-neutral-950" />
                <span className="hidden sm:inline">Ingia / Jisajili</span>
                <span className="sm:hidden">Ingia</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Single Unified Edge-to-Edge Map Section (Prevents duplicate map overlays & marker collisions) */}
      <section 
        className={`w-full transition-all duration-300 ${
          isFullscreenMap 
            ? 'fixed inset-0 z-[500] w-screen h-screen bg-neutral-950 flex flex-col' 
            : `relative ${isMapExpanded ? 'h-[560px] sm:h-[640px]' : 'h-[360px] sm:h-[440px]'}`
        }`}
      >
        <DaladalaMap
          routes={routes}
          vehicles={filteredVehicles}
          selectedVehicleId={selectedVehicleId}
          onSelectVehicle={(v) => setSelectedVehicleId(v.id === selectedVehicleId ? null : v.id)}
          selectedRouteId={filterRouteId === 'all' ? selectedRouteId : filterRouteId}
          boardingStopName={filterBoardingStop}
          alightStopName={filterAlightStop}
          onSetBoardingStop={(st) => {
            setFilterBoardingStop(st);
            toast.success(`Kituo cha kupandia: ${st}`);
          }}
          onSetAlightStop={(st) => {
            setFilterAlightStop(st);
            toast.success(`Kituo cha kushukia: ${st}`);
          }}
          onSelectStop={(stop) => {
            toast.info(`Kituo: ${stop.name} (${stop.isTerminal ? 'Stendi Kuu' : 'Kituo cha abiria'})`);
          }}
          userCoords={userCoords}
          resizeTrigger={isFullscreenMap || isMapExpanded}
          isEdgeToEdge={true}
        />

        {/* Map Controls Floating Badge */}
        <div className="absolute top-3 right-3 z-[450] flex items-center gap-1.5 sm:gap-2">
          {isFullscreenMap ? (
            <button
              onClick={() => setIsFullscreenMap(false)}
              className="px-3.5 py-2 rounded-xl bg-neutral-900/95 hover:bg-neutral-800 text-white border border-neutral-700/80 shadow-2xl backdrop-blur-md text-xs font-black flex items-center gap-1.5 transition active:scale-95"
              title="Toka Kioo Kizima (Exit Fullscreen)"
            >
              <Minimize2 className="w-4 h-4 text-orange-400" />
              <span>Toka Kioo Kizima</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsFullscreenMap(true)}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-100 shadow-xl backdrop-blur-md hover:bg-white dark:hover:bg-neutral-800 text-xs font-black flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700 transition active:scale-95"
                title="Fungua Kioo Kizima (Fullscreen Map)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Kioo Kizima</span>
              </button>

              <button
                onClick={() => setIsMapExpanded(!isMapExpanded)}
                className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-white/95 dark:bg-neutral-900/95 text-neutral-700 dark:text-neutral-200 shadow-md backdrop-blur-md hover:bg-white dark:hover:bg-neutral-800 text-xs font-bold flex items-center gap-1 border border-neutral-200 dark:border-neutral-700 transition active:scale-95"
                title={isMapExpanded ? 'Punguza Urefu wa Ramani' : 'Ongeza Urefu wa Ramani'}
              >
                {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{isMapExpanded ? 'Punguza' : 'Panua'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsRoutePlannerOpen(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Panga Ruti</span>
            <span className="sm:hidden">Ruti</span>
          </button>
        </div>
      </section>

      {/* Main Container for Details, Filters, and Subviews */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 flex-1 flex flex-col space-y-4 pb-10">
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
            vehicles={filteredVehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id === selectedVehicleId ? null : v.id)}
            onDeselectVehicle={() => setSelectedVehicleId(null)}
            trafficReports={mockTrafficReports}
            userCoords={userCoords}
            onOpenRoutePlanner={() => setIsRoutePlannerOpen(true)}
            onOpenRegisterVehicle={() => requireRole('owner', () => setIsRegisterVehicleOpen(true))}
            onOpenRegisterPassenger={() => requireRole('conductor', () => setIsRegisterPassengerOpen(true))}
            onOpenDashboard={() => requireRole('owner', () => setEcosystemMode('fleet'))}
            onOpenConductorMode={() => requireRole('conductor', () => setEcosystemMode('conductor'))}
            sessionUser={sessionUser}
            onOpenAuthModal={(role) => {
              setAuthModalInitialRole(role || 'owner');
              setIsAuthModalOpen(true);
            }}
            boardingStop={filterBoardingStop}
            onBoardingStopChange={setFilterBoardingStop}
            selectedRouteFilter={filterRouteId}
            onRouteChange={setFilterRouteId}
            alightStop={filterAlightStop}
            onAlightStopChange={setFilterAlightStop}
            searchQuery={filterSearchQuery}
            onSearchQueryChange={setFilterSearchQuery}
            seatFilter={filterSeatStatus}
            onSeatFilterChange={setFilterSeatStatus}
            onSwapStops={() => {
              const prev = filterBoardingStop;
              setFilterBoardingStop(filterAlightStop);
              setFilterAlightStop(prev);
            }}
            onResetFilters={() => {
              setFilterBoardingStop('');
              setFilterAlightStop('');
              setFilterRouteId('all');
              setFilterSearchQuery('');
              setFilterSeatStatus('all');
              setSelectedRouteId(null);
            }}
            totalVehiclesCount={vehicles.length}
          />
        )}

        {ecosystemMode === 'conductor' && (
          (selectedVehicle || vehicles[0]) ? (
            <DaladalaConductorMode
              vehicle={selectedVehicle || vehicles[0]}
              route={routes.find((r) => r.id === (selectedVehicle || vehicles[0]).routeId)}
              onUpdateVehicle={handleUpdateVehicle}
              passengers={passengers}
              onOpenRegisterPassenger={() => setIsRegisterPassengerOpen(true)}
              onOpenDashboard={sessionUser?.role === 'owner' ? () => setEcosystemMode('fleet') : undefined}
              sessionUser={sessionUser}
              onLogout={handleLogout}
            />
          ) : (
            <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-sm font-bold text-neutral-500">Tafadhali chagua daladala kwenye ramani kwanza.</p>
            </div>
          )
        )}

        {ecosystemMode === 'fleet' && (
          <DaladalaFleetManager
            fleetRecords={currentOwnerFleetRecords}
            terminals={mockTerminalQueues}
            routes={routes}
            vehicles={vehicles}
            passengers={passengers}
            onAddVehicle={handleAddVehicle}
            onAddRoute={handleAddRoute}
            onUpdateVehicleCrew={handleUpdateVehicleCrew}
            onOpenRegisterPassenger={() => setIsRegisterPassengerOpen(true)}
            ownerProfile={currentOwnerProfile}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Floating Bottom Quick Action Bar ONLY for Authenticated Daladala Operators */}
      {sessionUser && (sessionUser.role === 'owner' || sessionUser.role === 'conductor' || sessionUser.role === 'driver') && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-neutral-900/95 border border-neutral-700/80 text-white shadow-2xl backdrop-blur-md rounded-2xl p-1.5 flex items-center gap-1.5 pointer-events-auto max-w-md w-full sm:w-auto">
            <div className="px-2 py-1 text-[11px] font-black uppercase tracking-wider text-amber-400 hidden sm:flex items-center gap-1">
              <Bus className="w-3.5 h-3.5" />
              <span>{sessionUser.role === 'owner' ? 'Tajiri:' : 'Konda:'}</span>
            </div>

            {sessionUser.role === 'owner' && (
              <>
                <button
                  onClick={() => setIsRegisterVehicleOpen(true)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Sajili Chombo</span>
                </button>

                <button
                  onClick={() => setIsRegisterPassengerOpen(true)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sajili Abiria</span>
                </button>

                <button
                  onClick={() => setEcosystemMode(ecosystemMode === 'fleet' ? 'passenger' : 'fleet')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
                    ecosystemMode === 'fleet'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{ecosystemMode === 'fleet' ? 'Rudi Ramani' : 'Dasibodi Yangu'}</span>
                </button>
              </>
            )}

            {(sessionUser.role === 'conductor' || sessionUser.role === 'driver') && (
              <>
                <button
                  onClick={() => setIsRegisterPassengerOpen(true)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sajili Abiria</span>
                </button>

                <button
                  onClick={() => setEcosystemMode(ecosystemMode === 'conductor' ? 'passenger' : 'conductor')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
                    ecosystemMode === 'conductor'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  <span>{ecosystemMode === 'conductor' ? 'Rudi Ramani' : 'Njia ya Konda'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: SAJILI CHOMBO CHAKO (VEHICLE REGISTRATION) */}
      {isRegisterVehicleOpen && (
        <DaladalaRegisterVehicleModal
          routes={routes}
          onClose={() => setIsRegisterVehicleOpen(false)}
          onAddVehicle={handleAddVehicle}
        />
      )}

      {/* MODAL 2: SAJILI ABIRIA KWENYE CHOMBO (PASSENGER REGISTRATION) */}
      {isRegisterPassengerOpen && (
        <DaladalaRegisterPassengerModal
          vehicles={vehicles}
          routes={routes}
          selectedVehicleId={selectedVehicleId}
          onClose={() => setIsRegisterPassengerOpen(false)}
          onRegisterPassenger={handleRegisterPassenger}
        />
      )}

      {/* MODAL 3: DALADALA ROLE AUTHENTICATION & REGISTRATION */}
      <DaladalaAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        initialRole={authModalInitialRole}
        vehicles={vehicles}
      />
    </div>
  );
}
