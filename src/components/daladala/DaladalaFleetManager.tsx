import React, { useState, useEffect } from 'react';
import { 
  FleetVehicleRecord, 
  TerminalQueueInfo, 
  DaladalaRoute, 
  DaladalaVehicle,
  DaladalaStop,
  DaladalaOwnerProfile,
  DaladalaCrewMember
} from '../../types/daladala.types';
import { 
  Building2, 
  Banknote, 
  Wrench, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Fuel, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  ArrowRight,
  PlusCircle,
  Users,
  UserCheck,
  UserPlus,
  Bus,
  MapPin,
  Route as RouteIcon,
  Phone,
  CreditCard,
  Check,
  X,
  FileText,
  Calendar,
  Sparkles,
  LogOut,
  Edit3,
  Trash2,
  Send,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';

// Default initial demo owner profile
const DEFAULT_OWNER_PROFILE: DaladalaOwnerProfile = {
  id: 'owner_01',
  fullName: 'Mzee Juma Rashidi Mwinyi',
  phone: '0754 892 110',
  email: 'mwinyitransport@gmail.com',
  nidaNumber: '19750814-11105-00002-19',
  organizationName: 'Mwinyi Coastal Express (UWADAR #428)',
  zone: 'Ilala / Kivukoni',
  mPesaNumber: '0754 892 110',
  bankAccount: 'CRDB Bank: 015248900234',
  joinedDate: '2023-04-12',
  verified: true
};

// Initial crew members
const INITIAL_CREW: DaladalaCrewMember[] = [
  {
    id: 'crew_01',
    name: 'Juma Ramadhani "Kapteni"',
    role: 'driver',
    phone: '0713 456 789',
    licenseNumber: 'LATRA-DRV-8942-TZ (Class C)',
    nidaNumber: '19840211-14102-00001-22',
    assignedVehiclePlate: 'T 541 CXY',
    rating: 4.9,
    tripsCount: 1420,
    status: 'active',
  },
  {
    id: 'crew_02',
    name: 'Hamisi Bakari "Konda Mbunge"',
    role: 'conductor',
    phone: '0754 112 233',
    nidaNumber: '19920518-21104-00003-14',
    assignedVehiclePlate: 'T 541 CXY',
    rating: 4.8,
    tripsCount: 1390,
    status: 'active',
  },
  {
    id: 'crew_03',
    name: 'Omary Mussa "Speedy"',
    role: 'driver',
    phone: '0784 990 011',
    licenseNumber: 'LATRA-DRV-7719-TZ (Class C)',
    nidaNumber: '19880923-11109-00004-31',
    assignedVehiclePlate: 'T 392 DKR',
    rating: 4.7,
    tripsCount: 980,
    status: 'active',
  },
  {
    id: 'crew_04',
    name: 'Ally Khalfan "Fundi"',
    role: 'conductor',
    phone: '0767 334 455',
    nidaNumber: '19951201-13101-00005-40',
    assignedVehiclePlate: 'T 392 DKR',
    rating: 4.9,
    tripsCount: 950,
    status: 'active',
  },
  {
    id: 'crew_05',
    name: 'Said Athumani "Mzee wa Kazi"',
    role: 'driver',
    phone: '0714 887 766',
    licenseNumber: 'LATRA-DRV-6204-TZ (Class C)',
    nidaNumber: '19800315-18105-00002-15',
    assignedVehiclePlate: 'T 184 AZF',
    rating: 4.8,
    tripsCount: 1650,
    status: 'active',
  },
  {
    id: 'crew_06',
    name: 'Hassan Kingu',
    role: 'conductor',
    phone: '0759 221 144',
    nidaNumber: '19960720-19102-00006-28',
    assignedVehiclePlate: 'T 184 AZF',
    rating: 4.6,
    tripsCount: 1120,
    status: 'active',
  }
];

interface DaladalaFleetManagerProps {
  fleetRecords: FleetVehicleRecord[];
  terminals: TerminalQueueInfo[];
  routes?: DaladalaRoute[];
  vehicles?: DaladalaVehicle[];
  onAddVehicle?: (vehicle: DaladalaVehicle, fleetRecord: FleetVehicleRecord) => void;
  onAddRoute?: (route: DaladalaRoute) => void;
  onUpdateVehicleCrew?: (vehicleId: string, driverName: string, conductorName: string, conductorPhone: string) => void;
}

export default function DaladalaFleetManager({
  fleetRecords,
  terminals,
  routes = [],
  vehicles = [],
  onAddVehicle,
  onAddRoute,
  onUpdateVehicleCrew,
}: DaladalaFleetManagerProps) {
  // Navigation tabs in Owner Panel
  const [activeTab, setActiveTab] = useState<'revenue' | 'vehicles' | 'crew' | 'routes' | 'maintenance' | 'terminals'>('revenue');

  // Owner authentication & profile state (saved in localStorage)
  const [ownerProfile, setOwnerProfile] = useState<DaladalaOwnerProfile>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_owner_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_OWNER_PROFILE;
  });

  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('papo_daladala_owner_logged_in') !== 'false';
  });

  // Crew state
  const [crewMembers, setCrewMembers] = useState<DaladalaCrewMember[]>(() => {
    try {
      const saved = localStorage.getItem('papo_daladala_crew_members');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CREW;
  });

  // Modals visibility
  const [showRegisterVehicleModal, setShowRegisterVehicleModal] = useState(false);
  const [showRegisterCrewModal, setShowRegisterCrewModal] = useState(false);
  const [showRegisterRouteModal, setShowRegisterRouteModal] = useState(false);
  const [showOwnerRegisterModal, setShowOwnerRegisterModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('papo_daladala_owner_profile', JSON.stringify(ownerProfile));
      localStorage.setItem('papo_daladala_owner_logged_in', isOwnerLoggedIn ? 'true' : 'false');
      localStorage.setItem('papo_daladala_crew_members', JSON.stringify(crewMembers));
    } catch (e) {
      console.error(e);
    }
  }, [ownerProfile, isOwnerLoggedIn, crewMembers]);

  // Aggregates for revenue
  const totalRevenue = fleetRecords.reduce((acc, f) => acc + f.todayRevenueTzs, 0);
  const totalTarget = fleetRecords.reduce((acc, f) => acc + f.dailyTargetTzs, 0);
  const totalFuel = fleetRecords.reduce((acc, f) => acc + f.fuelExpenseTzs, 0);
  const totalTerminalFee = fleetRecords.reduce((acc, f) => acc + f.terminalFeeTzs, 0);
  const totalNetProfit = totalRevenue - totalFuel - totalTerminalFee;
  const digitalCollections = fleetRecords.reduce((acc, f) => acc + f.digitalCollectedTzs, 0);
  const cashCollections = fleetRecords.reduce((acc, f) => acc + f.cashCollectedTzs, 0);

  // ----------------------------------------------------
  // FORM STATES: REGISTER VEHICLE
  // ----------------------------------------------------
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleNickname, setNewVehicleNickname] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('Toyota Coaster (30 Seater)');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState('30');
  const [newVehicleRouteId, setNewVehicleRouteId] = useState(routes[0]?.id || 'route_morogoro_rd');
  const [newVehicleDriverId, setNewVehicleDriverId] = useState('');
  const [newVehicleConductorId, setNewVehicleConductorId] = useState('');
  const [newVehicleTargetTzs, setNewVehicleTargetTzs] = useState('140000');
  const [newVehicleColor, setNewVehicleColor] = useState('#2563eb');

  const handleRegisterVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehiclePlate.trim() || !newVehicleNickname.trim()) {
      toast.error('Tafadhali jaza namba ya gari na jina la utani!');
      return;
    }

    const selectedRoute = routes.find((r) => r.id === newVehicleRouteId) || routes[0];
    const driver = crewMembers.find((c) => c.id === newVehicleDriverId);
    const conductor = crewMembers.find((c) => c.id === newVehicleConductorId);

    const plate = newVehiclePlate.toUpperCase().trim();
    const capacityNum = parseInt(newVehicleCapacity, 10) || 30;
    const targetNum = parseInt(newVehicleTargetTzs, 10) || 120000;

    // Build the vehicle object for real-time map
    const firstStop = selectedRoute?.stops[0] || { lat: -6.8140, lng: 39.2450, name: 'Stendi Kuu' };
    const secondStop = selectedRoute?.stops[1] || { name: 'Kituo cha Mbele' };

    const newVehicle: DaladalaVehicle = {
      id: `daladala_${Date.now()}`,
      plateNumber: plate,
      nickname: newVehicleNickname,
      routeId: selectedRoute?.id || 'route_morogoro_rd',
      routeCode: selectedRoute?.routeCode || 'DL-01',
      routeName: selectedRoute?.name || 'Ruti Mpya',
      capacity: capacityNum,
      seatsTaken: Math.floor(capacityNum * 0.4),
      standingCount: 0,
      seatStatus: 'available',
      currentLat: firstStop.lat,
      currentLng: firstStop.lng,
      heading: 90,
      speedKmH: 34,
      nextStopId: selectedRoute?.stops[1]?.id || 'stop_next',
      nextStopName: secondStop.name,
      etaMinutesToNextStop: 3,
      driverName: driver ? driver.name : 'Dereva Mpya',
      conductorName: conductor ? conductor.name : 'Konda Mpya',
      conductorPhone: conductor ? conductor.phone : '0754000000',
      rating: 5.0,
      ratingCount: 1,
      isOffRoute: false,
      lastUpdated: 'Sasa hivi',
      colorHex: newVehicleColor,
      vehicleModel: newVehicleModel,
    };

    const newFleetRecord: FleetVehicleRecord = {
      id: `fleet_${Date.now()}`,
      plateNumber: plate,
      nickname: newVehicleNickname,
      routeCode: selectedRoute?.routeCode || 'DL-01',
      driverName: driver ? driver.name : 'Dereva Mpya',
      conductorName: conductor ? conductor.name : 'Konda Mpya',
      dailyTargetTzs: targetNum,
      todayRevenueTzs: 0,
      cashCollectedTzs: 0,
      digitalCollectedTzs: 0,
      fuelExpenseTzs: 0,
      terminalFeeTzs: 4000,
      tripsCount: 0,
      oilServiceKmRemaining: 4800,
      latraExpiryDate: '2027-04-30',
      insuranceExpiryDate: '2027-04-30',
      status: 'active',
    };

    if (onAddVehicle) {
      onAddVehicle(newVehicle, newFleetRecord);
    }

    // Update crew assigned plates
    if (driver || conductor) {
      setCrewMembers((prev) =>
        prev.map((c) => {
          if (c.id === newVehicleDriverId || c.id === newVehicleConductorId) {
            return { ...c, assignedVehiclePlate: plate };
          }
          return c;
        })
      );
    }

    setShowRegisterVehicleModal(false);
    setNewVehiclePlate('');
    setNewVehicleNickname('');
    toast.success(`Chombo ${plate} ("${newVehicleNickname}") kimesajiliwa kikamilifu na kiko hewani kazini!`);
  };

  // ----------------------------------------------------
  // FORM STATES: REGISTER CREW (DEREVA AU KONDA)
  // ----------------------------------------------------
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewRole, setNewCrewRole] = useState<'driver' | 'conductor'>('driver');
  const [newCrewPhone, setNewCrewPhone] = useState('');
  const [newCrewLicense, setNewCrewLicense] = useState('');
  const [newCrewNida, setNewCrewNida] = useState('');
  const [newCrewPlate, setNewCrewPlate] = useState('');

  const handleRegisterCrew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrewName.trim() || !newCrewPhone.trim()) {
      toast.error('Tafadhali jaza jina na namba ya simu!');
      return;
    }

    const member: DaladalaCrewMember = {
      id: `crew_${Date.now()}`,
      name: newCrewName.trim(),
      role: newCrewRole,
      phone: newCrewPhone.trim(),
      licenseNumber: newCrewRole === 'driver' ? (newCrewLicense.trim() || 'LATRA-DRV-PENDING') : undefined,
      nidaNumber: newCrewNida.trim() || '19900101-11101-00001-01',
      assignedVehiclePlate: newCrewPlate ? newCrewPlate : undefined,
      rating: 5.0,
      tripsCount: 0,
      status: 'active',
    };

    setCrewMembers((prev) => [member, ...prev]);

    // If assigned to a vehicle, update vehicle in real-time
    if (newCrewPlate && onUpdateVehicleCrew) {
      const v = vehicles.find((veh) => veh.plateNumber === newCrewPlate);
      if (v) {
        if (newCrewRole === 'driver') {
          onUpdateVehicleCrew(v.id, member.name, v.conductorName, v.conductorPhone);
        } else {
          onUpdateVehicleCrew(v.id, v.driverName, member.name, member.phone);
        }
      }
    }

    setShowRegisterCrewModal(false);
    setNewCrewName('');
    setNewCrewPhone('');
    setNewCrewLicense('');
    setNewCrewNida('');
    toast.success(`${newCrewRole === 'driver' ? 'Dereva' : 'Kondakta'} ${member.name} amesajiliwa kikamilifu!`);
  };

  // ----------------------------------------------------
  // FORM STATES: REGISTER ROUTE & STOPS
  // ----------------------------------------------------
  const [newRouteCode, setNewRouteCode] = useState('DL-06');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteOrigin, setNewRouteOrigin] = useState('');
  const [newRouteDestination, setNewRouteDestination] = useState('');
  const [newRouteVia, setNewRouteVia] = useState('');
  const [newRouteBaseFare, setNewRouteBaseFare] = useState('500');
  const [newRouteStudentFare, setNewRouteStudentFare] = useState('200');
  const [newRouteColor, setNewRouteColor] = useState('#8b5cf6');
  const [stopsList, setStopsList] = useState<string[]>([
    'Kituo cha Kuanzia',
    'Kituo cha Kati 1',
    'Kituo cha Kati 2',
    'Kituo cha Mwisho'
  ]);
  const [currentStopInput, setCurrentStopInput] = useState('');

  const handleAddStopToRoute = () => {
    if (!currentStopInput.trim()) return;
    setStopsList((prev) => [...prev, currentStopInput.trim()]);
    setCurrentStopInput('');
  };

  const handleRemoveStopFromRoute = (index: number) => {
    setStopsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRegisterRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim() || !newRouteOrigin.trim() || !newRouteDestination.trim()) {
      toast.error('Tafadhali jaza jina la ruti, kituo cha kuanzia na cha mwisho!');
      return;
    }

    // Build synthesized coordinates along Dar es Salaam
    const baseLat = -6.8140;
    const baseLng = 39.2450;
    const stopsCount = Math.max(stopsList.length, 2);

    const generatedStops: DaladalaStop[] = stopsList.map((stopName, idx) => {
      const step = idx / (stopsCount - 1);
      return {
        id: `stop_${Date.now()}_${idx}`,
        name: stopName,
        lat: baseLat + (step - 0.5) * 0.08 + (Math.sin(step * Math.PI) * 0.02),
        lng: baseLng + (step - 0.5) * 0.09,
        isTerminal: idx === 0 || idx === stopsCount - 1,
        zone: idx === 0 ? newRouteOrigin : idx === stopsCount - 1 ? newRouteDestination : 'Kati',
      };
    });

    const pathCoordinates: [number, number][] = generatedStops.map((s) => [s.lat, s.lng]);

    const createdRoute: DaladalaRoute = {
      id: `route_${Date.now()}`,
      routeCode: newRouteCode.trim().toUpperCase(),
      name: newRouteName.trim(),
      origin: newRouteOrigin.trim(),
      destination: newRouteDestination.trim(),
      via: newRouteVia.trim() || 'Barabara Kuu',
      distanceKm: 15.5,
      baseFareTzs: parseInt(newRouteBaseFare, 10) || 500,
      studentFareTzs: parseInt(newRouteStudentFare, 10) || 200,
      color: newRouteColor,
      operatingHours: '05:00 - 23:00',
      frequencyMinutes: 4,
      stops: generatedStops,
      pathCoordinates,
    };

    if (onAddRoute) {
      onAddRoute(createdRoute);
    }

    setShowRegisterRouteModal(false);
    setNewRouteName('');
    setNewRouteOrigin('');
    setNewRouteDestination('');
    setNewRouteVia('');
    toast.success(`Ruti mpya ${createdRoute.routeCode} (${createdRoute.name}) yenye vituo ${generatedStops.length} imesajiliwa kikamilifu!`);
  };

  // ----------------------------------------------------
  // OWNER REGISTRATION / EDIT FORM
  // ----------------------------------------------------
  const [ownerFormName, setOwnerFormName] = useState(ownerProfile.fullName);
  const [ownerFormPhone, setOwnerFormPhone] = useState(ownerProfile.phone);
  const [ownerFormEmail, setOwnerFormEmail] = useState(ownerProfile.email);
  const [ownerFormNida, setOwnerFormNida] = useState(ownerProfile.nidaNumber);
  const [ownerFormOrg, setOwnerFormOrg] = useState(ownerProfile.organizationName || '');
  const [ownerFormZone, setOwnerFormZone] = useState(ownerProfile.zone);
  const [ownerFormMpesa, setOwnerFormMpesa] = useState(ownerProfile.mPesaNumber);

  const handleSaveOwnerProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerFormName.trim() || !ownerFormPhone.trim()) {
      toast.error('Tafadhali jaza jina lako na namba ya simu!');
      return;
    }

    const updated: DaladalaOwnerProfile = {
      ...ownerProfile,
      fullName: ownerFormName.trim(),
      phone: ownerFormPhone.trim(),
      email: ownerFormEmail.trim(),
      nidaNumber: ownerFormNida.trim(),
      organizationName: ownerFormOrg.trim(),
      zone: ownerFormZone.trim(),
      mPesaNumber: ownerFormMpesa.trim(),
      verified: true,
    };

    setOwnerProfile(updated);
    setIsOwnerLoggedIn(true);
    setShowOwnerRegisterModal(false);
    toast.success(`Taarifa za Mmiliki (${updated.fullName}) zimesajiliwa kikamilifu!`);
  };

  // ----------------------------------------------------
  // WITHDRAW REVENUE MODAL
  // ----------------------------------------------------
  const [withdrawAmount, setWithdrawAmount] = useState('100000');
  const [withdrawMethod, setWithdrawMethod] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'crdb'>('mpesa');

  const handleConfirmWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(withdrawAmount, 10);
    if (!amt || amt <= 0) {
      toast.error('Tafadhali weka kiasi sahihi cha kutoa!');
      return;
    }
    setShowWithdrawModal(false);
    toast.success(`TSh ${amt.toLocaleString()} zimetumwa kwa ufanisi kwenye namba yako ya ${withdrawMethod.toUpperCase()} (${ownerProfile.mPesaNumber})!`);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* ---------------- OWNER PROFILE HEADER & REGISTRATION ---------------- */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <Building2 className="w-7 h-7" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {ownerProfile.fullName}
                </h2>
                {ownerProfile.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    LATRA Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 flex items-center gap-2 mt-0.5">
                <span>{ownerProfile.organizationName}</span>
                <span>•</span>
                <span>Eneo: {ownerProfile.zone}</span>
              </p>
              <p className="text-[11px] text-amber-300/90 font-mono mt-0.5">
                M-Pesa ya Nauli: {ownerProfile.mPesaNumber}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons for Owner */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setOwnerFormName(ownerProfile.fullName);
                setOwnerFormPhone(ownerProfile.phone);
                setOwnerFormEmail(ownerProfile.email);
                setOwnerFormNida(ownerProfile.nidaNumber);
                setOwnerFormOrg(ownerProfile.organizationName || '');
                setOwnerFormZone(ownerProfile.zone);
                setOwnerFormMpesa(ownerProfile.mPesaNumber);
                setShowOwnerRegisterModal(true);
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Hariri Taarifa</span>
            </button>

            <button
              onClick={() => setShowRegisterVehicleModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sajili Daladala Mpya</span>
            </button>

            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95"
            >
              <Banknote className="w-4 h-4" />
              <span>Toa Pesa (Withdraw)</span>
            </button>
          </div>
        </div>

        {/* Quick Fleet & Crew Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">Magari Yangu</span>
            <span className="text-base font-black text-white">{fleetRecords.length} Daladala</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">Madereva & Makonda</span>
            <span className="text-base font-black text-white">{crewMembers.length} Wafanyakazi</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">Ruti Zinazofanya Kazi</span>
            <span className="text-base font-black text-white">{routes.length} Njia Rasmi</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5">
            <span className="text-[10px] text-neutral-400 uppercase font-bold block">Baki ya Tajiri Leo</span>
            <span className="text-base font-black text-emerald-400">TSh {totalNetProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ---------------- NAVIGATION TABS ---------------- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-neutral-200 dark:border-neutral-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab('revenue')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'revenue'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Hesabu ya Tajiri (Mapato)</span>
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'vehicles'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          <span>Magari Yangu ({fleetRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('crew')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'crew'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Madereva & Makonda ({crewMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'routes'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <RouteIcon className="w-3.5 h-3.5" />
          <span>Njia & Vituo ({routes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'maintenance'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Service & Bima</span>
        </button>

        <button
          onClick={() => setActiveTab('terminals')}
          className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'terminals'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Foleni za Stendi</span>
        </button>
      </div>

      {/* ---------------- TAB 1: REVENUE & HESABU YA TAJIRI ---------------- */}
      {activeTab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Jumla ya Mapato Leo
              </span>
              <span className="text-lg font-black text-blue-900 dark:text-blue-100 block mt-0.5">
                TSh {totalRevenue.toLocaleString()}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                Lengo la Siku: TSh {totalTarget.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Faida ya Tajiri (Net)
              </span>
              <span className="text-lg font-black text-emerald-900 dark:text-emerald-100 block mt-0.5">
                TSh {totalNetProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Baada ya mafuta & ushuru</span>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                Malipo ya Kidijitali (QR)
              </span>
              <span className="text-lg font-black text-indigo-900 dark:text-indigo-100 block mt-0.5">
                TSh {digitalCollections.toLocaleString()}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Moja kwa moja benki/M-Pesa</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                Mafuta & Ushuru wa Stendi
              </span>
              <span className="text-lg font-black text-amber-900 dark:text-amber-100 block mt-0.5">
                TSh {(totalFuel + totalTerminalFee).toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Gharama za uendeshaji</span>
            </div>
          </div>

          {/* Breakdown table */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/80 px-4 py-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800 grid grid-cols-12">
              <span className="col-span-3">Namba ya Gari</span>
              <span className="col-span-3">Dereva / Konda</span>
              <span className="col-span-2 text-right">Mapato ya Leo</span>
              <span className="col-span-2 text-right">Mafuta / Ushuru</span>
              <span className="col-span-2 text-right">Baki ya Tajiri</span>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {fleetRecords.map((f) => {
                const baki = f.todayRevenueTzs - f.fuelExpenseTzs - f.terminalFeeTzs;
                const progressPct = f.dailyTargetTzs > 0 ? Math.min(100, Math.round((f.todayRevenueTzs / f.dailyTargetTzs) * 100)) : 0;

                return (
                  <div key={f.id} className="px-4 py-3 grid grid-cols-12 items-center hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <div className="col-span-3">
                      <strong className="text-neutral-900 dark:text-white block">{f.plateNumber}</strong>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">"{f.nickname}" ({f.routeCode})</span>
                    </div>

                    <div className="col-span-3 text-neutral-600 dark:text-neutral-300 text-[11px]">
                      <p>Dereva: {f.driverName}</p>
                      <p className="text-[10px] text-neutral-400">Konda: {f.conductorName}</p>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="font-extrabold text-neutral-900 dark:text-neutral-100">
                        TSh {f.todayRevenueTzs.toLocaleString()}
                      </span>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-[9px] text-neutral-400 font-bold">{progressPct}% ya lengo</span>
                    </div>

                    <div className="col-span-2 text-right text-neutral-500 text-[11px]">
                      <span>TSh {(f.fuelExpenseTzs + f.terminalFeeTzs).toLocaleString()}</span>
                    </div>

                    <div className="col-span-2 text-right">
                      <strong className="font-black text-emerald-600 dark:text-emerald-400">
                        TSh {baki.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: MAGARI YANGU (FLEET MANAGEMENT & REGISTRATION) ---------------- */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-neutral-900 dark:text-white">Orodha ya Daladala Zangu</h4>
              <p className="text-xs text-neutral-500">Magari yanayofanya kazi chini ya usimamizi wako.</p>
            </div>

            <button
              onClick={() => setShowRegisterVehicleModal(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sajili Daladala Mpya</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {fleetRecords.map((f) => {
              const liveVehicle = vehicles.find((v) => v.plateNumber === f.plateNumber);
              return (
                <div
                  key={`vehicle_card_${f.id}`}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3 relative hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-neutral-900 dark:text-white">{f.plateNumber}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {f.routeCode}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold italic">"{f.nickname}"</p>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Kazini
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Dereva:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">{f.driverName}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Kondakta:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">{f.conductorName}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Lengo la Siku:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">TSh {f.dailyTargetTzs.toLocaleString()}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Mapato ya Leo:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">TSh {f.todayRevenueTzs.toLocaleString()}</strong>
                    </div>

                    {liveVehicle && (
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                        <span className="text-neutral-500">GPS Eneo:</span>
                        <span className="text-blue-600 font-bold truncate max-w-[150px]">
                          Kuelekea {liveVehicle.nextStopName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        toast.info(`Ufuatiliaji wa gari ${f.plateNumber} kwenye ramani ya GPS umeanza.`);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1 hover:bg-blue-100 transition"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Fuatilia GPS</span>
                    </button>

                    <button
                      onClick={() => {
                        toast.success(`Ripoti kamili ya safari za ${f.plateNumber} imepakuliwa.`);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1 hover:bg-neutral-200 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ripoti</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: MADEREVA & MAKONDA (CREW MANAGEMENT & ASSIGNMENT) ---------------- */}
      {activeTab === 'crew' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-sm text-neutral-900 dark:text-white">Madereva & Makonda Wangu</h4>
              <p className="text-xs text-neutral-500">Sajili na panga wafanyakazi kwenye daladala zako.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewCrewRole('driver');
                  setShowRegisterCrewModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Dereva Mpya</span>
              </button>

              <button
                onClick={() => {
                  setNewCrewRole('conductor');
                  setShowRegisterCrewModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>+ Konda Mpya</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {crewMembers.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white ${
                      c.role === 'driver' ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}>
                      {c.role === 'driver' ? 'DRV' : 'KND'}
                    </div>
                    <div>
                      <h5 className="font-black text-xs text-neutral-900 dark:text-white">{c.name}</h5>
                      <span className={`text-[10px] font-bold uppercase ${
                        c.role === 'driver' ? 'text-blue-600' : 'text-emerald-600'
                      }`}>
                        {c.role === 'driver' ? 'Dereva Mkuu' : 'Kondakta (Konda)'}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    Kazini
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Simu:</span>
                    <strong className="text-neutral-800 dark:text-neutral-200">{c.phone}</strong>
                  </div>

                  {c.licenseNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Leseni:</span>
                      <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{c.licenseNumber}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Gari Alilopangiwa:</span>
                    <span className="font-black px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white text-[11px]">
                      {c.assignedVehiclePlate || 'Hajapangiwa'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Tathmini ya Abiria:</span>
                    <span className="font-bold text-amber-600">⭐ {c.rating} ({c.tripsCount} safari)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`tel:${c.phone}`}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Piga Simu</span>
                  </a>

                  <button
                    onClick={() => {
                      const newPlate = prompt('Ingiza namba ya gari jipya la kumpangia huyu mfanyakazi (mfano: T 541 CXY):', c.assignedVehiclePlate || '');
                      if (newPlate) {
                        setCrewMembers((prev) =>
                          prev.map((item) => (item.id === c.id ? { ...item, assignedVehiclePlate: newPlate.toUpperCase().trim() } : item))
                        );
                        toast.success(`${c.name} amepangiwa chombo ${newPlate.toUpperCase()}!`);
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold transition"
                  >
                    Panga Gari
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: NJIA & VITUO (ROUTES & STOPS CUSTOMIZATION) ---------------- */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-sm text-neutral-900 dark:text-white">Usimamizi wa Njia & Vituo (Routes & Stops)</h4>
              <p className="text-xs text-neutral-500">Angalia na tengeneza ruti za daladala zako pamoja na vituo vyote vya njiani.</p>
            </div>

            <button
              onClick={() => setShowRegisterRouteModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sajili Ruti & Vituo Vipya</span>
            </button>
          </div>

          <div className="space-y-3">
            {routes.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-1 rounded text-white text-xs font-black"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.routeCode}
                    </span>
                    <div>
                      <h5 className="font-black text-sm text-neutral-900 dark:text-white">{r.name}</h5>
                      <p className="text-xs text-neutral-500">Kupitia: {r.via}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">
                      Nauli: <strong className="text-emerald-600">TSh {r.baseFareTzs}</strong> (Wanafunzi: TSh {r.studentFareTzs})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-[11px]">
                      {r.stops.length} Vituo
                    </span>
                  </div>
                </div>

                {/* Horizontal stops visualizer */}
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                    Vituo vya Njia Hii:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                    {r.stops.map((stop, sIdx) => (
                      <div
                        key={stop.id}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border ${
                          stop.isTerminal
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200 font-black'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-neutral-400">{sIdx + 1}.</span>
                        <span>{stop.name}</span>
                        {stop.isTerminal && (
                          <span className="text-[9px] px-1 rounded bg-amber-200 text-amber-900 font-extrabold ml-0.5">
                            Stendi
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: MAINTENANCE & COMPLIANCE ---------------- */}
      {activeTab === 'maintenance' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fleetRecords.map((f) => (
            <div key={`maint_${f.id}`} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-800/20">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span className="font-black text-xs text-neutral-900 dark:text-white">{f.plateNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  Kazini
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Service ya Oili:
                  </span>
                  <span className={`font-bold ${f.oilServiceKmRemaining < 500 ? 'text-red-600 animate-pulse' : 'text-neutral-800 dark:text-neutral-200'}`}>
                    KM {f.oilServiceKmRemaining} zimebaki
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Leseni ya LATRA:
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {f.latraExpiryDate}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Bima ya Gari:
                  </span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    {f.insuranceExpiryDate}
                  </span>
                </div>
              </div>

              <button
                onClick={() => toast.success(`Ombi la service ya gari ${f.plateNumber} limerekodiwa.`)}
                className="w-full py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs hover:opacity-90 transition"
              >
                Ratiba Service / Matengenezo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- TAB 6: TERMINALS ---------------- */}
      {activeTab === 'terminals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {terminals.map((t) => (
              <div key={t.terminalId} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/40 dark:bg-neutral-800/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-xs text-neutral-900 dark:text-neutral-100">{t.terminalName}</h4>
                    <p className="text-[10px] text-neutral-500">Ruti: {t.routes.join(', ')}</p>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Foleni ya Magari Stendi
                  </span>
                  {t.queuedVehicles.map((q) => (
                    <div
                      key={q.plateNumber}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        q.status === 'boarding'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black">{q.queuePosition}. {q.plateNumber}</span>
                          <span className="text-[9px] font-bold px-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                            {q.routeCode}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">Kuelekea: {q.destination}</p>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-[11px] block">
                          {q.status === 'boarding' ? `Inajaza (Viti ${q.seatsRemaining})` : `Inafuata (Dk ${q.departureEtaMinutes})`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SAJILI DALADALA MPYA (REGISTER VEHICLE)                          */}
      {/* ========================================================================= */}
      {showRegisterVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-900 dark:text-white">Sajili Daladala Mpya</h3>
                  <p className="text-[11px] text-neutral-500">Weka chombo chako hewani na ukipangie wafanyakazi.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterVehicleModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterVehicle} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya Usajili (Plate No.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="k.m. T 842 EEB"
                    value={newVehiclePlate}
                    onChange={(e) => setNewVehiclePlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono uppercase font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Jina la Utani (Nickname) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder='k.m. "Mwendo Kasi" au "Simba"'
                    value={newVehicleNickname}
                    onChange={(e) => setNewVehicleNickname(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Aina ya Gari (Model)
                  </label>
                  <select
                    value={newVehicleModel}
                    onChange={(e) => setNewVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Toyota Coaster (30 Seater)">Toyota Coaster (30 Seater)</option>
                    <option value="Isuzu Journey (26 Seater)">Isuzu Journey (26 Seater)</option>
                    <option value="Mitsubishi Rosa (28 Seater)">Mitsubishi Rosa (28 Seater)</option>
                    <option value="Toyota Hiace / Commuter (16 Seater)">Toyota Hiace (16 Seater)</option>
                    <option value="Scania Minibus (35 Seater)">Scania Minibus (35 Seater)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Idadi ya Viti vya Kukaa
                  </label>
                  <input
                    type="number"
                    min="14"
                    max="65"
                    value={newVehicleCapacity}
                    onChange={(e) => setNewVehicleCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Ruti Ambayo Gari Litafanya Kazi *
                </label>
                <select
                  value={newVehicleRouteId}
                  onChange={(e) => setNewVehicleRouteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.routeCode}] {r.name} ({r.via})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Panga Dereva
                  </label>
                  <select
                    value={newVehicleDriverId}
                    onChange={(e) => setNewVehicleDriverId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chagua Dereva --</option>
                    {crewMembers.filter((c) => c.role === 'driver').map((drv) => (
                      <option key={drv.id} value={drv.id}>
                        {drv.name} ({drv.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Panga Kondakta (Konda)
                  </label>
                  <select
                    value={newVehicleConductorId}
                    onChange={(e) => setNewVehicleConductorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chagua Konda --</option>
                    {crewMembers.filter((c) => c.role === 'conductor').map((knd) => (
                      <option key={knd.id} value={knd.id}>
                        {knd.name} ({knd.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Lengo la Hesabu kwa Siku (TSh)
                  </label>
                  <input
                    type="number"
                    step="5000"
                    value={newVehicleTargetTzs}
                    onChange={(e) => setNewVehicleTargetTzs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Rangi ya Alama ya Gari
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newVehicleColor}
                      onChange={(e) => setNewVehicleColor(e.target.value)}
                      className="w-10 h-9 p-0.5 rounded-lg border border-neutral-300 cursor-pointer"
                    />
                    <span className="text-xs font-mono">{newVehicleColor}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterVehicleModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md transition"
                >
                  Hifadhi & Weka Kazini
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SAJILI DEREVA AU KONDA (REGISTER CREW)                           */}
      {/* ========================================================================= */}
      {showRegisterCrewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-900 dark:text-white">
                    Sajili {newCrewRole === 'driver' ? 'Dereva Mpya' : 'Kondakta Mpya'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">Mpe access ya kusimamia chombo chako.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterCrewModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterCrew} className="space-y-3 text-xs">
              <div className="flex items-center gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewCrewRole('driver')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    newCrewRole === 'driver' ? 'bg-blue-600 text-white shadow' : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  Dereva (Driver)
                </button>
                <button
                  type="button"
                  onClick={() => setNewCrewRole('conductor')}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-center transition ${
                    newCrewRole === 'conductor' ? 'bg-emerald-600 text-white shadow' : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  Kondakta (Konda)
                </button>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Jina Kamili *
                </label>
                <input
                  type="text"
                  required
                  placeholder="k.m. Hassan Ramadhani Kingu"
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Namba ya Simu (M-Pesa / Tigo Pesa) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="k.m. 0754 123 456"
                  value={newCrewPhone}
                  onChange={(e) => setNewCrewPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newCrewRole === 'driver' ? (
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya Leseni ya Udereva (Class C)
                  </label>
                  <input
                    type="text"
                    placeholder="k.m. LATRA-DRV-9021-TZ"
                    value={newCrewLicense}
                    onChange={(e) => setNewCrewLicense(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya Kitambulisho cha Taifa (NIDA)
                  </label>
                  <input
                    type="text"
                    placeholder="k.m. 19920518-21104-00003-14"
                    value={newCrewNida}
                    onChange={(e) => setNewCrewNida(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Mpangie Daladala (Hiari)
                </label>
                <select
                  value={newCrewPlate}
                  onChange={(e) => setNewCrewPlate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Acha bila gari kwa sasa --</option>
                  {fleetRecords.map((f) => (
                    <option key={f.id} value={f.plateNumber}>
                      {f.plateNumber} ("{f.nickname}")
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterCrewModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition"
                >
                  Hifadhi Mfanyakazi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SAJILI RUTI & VITUO VIPYA (REGISTER ROUTE & STOPS)              */}
      {/* ========================================================================= */}
      {showRegisterRouteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <RouteIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-900 dark:text-white">Sajili Ruti & Vituo Vipya</h3>
                  <p className="text-[11px] text-neutral-500">Weka njia rasmi na orodha ya vituo vinavyosimama.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterRouteModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterRoute} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Kodi ya Ruti *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="k.m. DL-07"
                    value={newRouteCode}
                    onChange={(e) => setNewRouteCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono uppercase font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Jina Kamili la Ruti *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="k.m. Mbagala Rangi Tatu ⇄ Kivukoni"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Kituo cha Kuanzia (Origin) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="k.m. Mbagala Rangi Tatu Stand"
                    value={newRouteOrigin}
                    onChange={(e) => setNewRouteOrigin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Kituo cha Mwisho (Destination) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="k.m. Kivukoni Ferry Terminal"
                    value={newRouteDestination}
                    onChange={(e) => setNewRouteDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Inapopita (Via / Barabara Kuu)
                </label>
                <input
                  type="text"
                  placeholder="k.m. Barabara ya Kilwa (Kilwa Rd) kupitia Chang'ombe"
                  value={newRouteVia}
                  onChange={(e) => setNewRouteVia(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Nauli ya Kawaida (TSh)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={newRouteBaseFare}
                    onChange={(e) => setNewRouteBaseFare(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Nauli ya Wanafunzi (TSh)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={newRouteStudentFare}
                    onChange={(e) => setNewRouteStudentFare(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Vituo vya Njiani Sub-builder */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <span className="font-bold text-neutral-800 dark:text-neutral-200 block">
                  Vituo Vinavyosimama Njiani ({stopsList.length})
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Andika jina la kituo (k.m. Tandika Magengeni)"
                    value={currentStopInput}
                    onChange={(e) => setCurrentStopInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddStopToRoute();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddStopToRoute}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition"
                  >
                    + Weka
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                  {stopsList.map((stopName, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 text-[11px]"
                    >
                      <span className="font-bold text-purple-600">{idx + 1}.</span>
                      <span>{stopName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStopFromRoute(idx)}
                        className="text-neutral-400 hover:text-red-500 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterRouteModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-md transition"
                >
                  Hifadhi Ruti & Vituo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: HARIRI / JISAJILI KAMA MMILIKI (OWNER REGISTRATION / PROFILE)     */}
      {/* ========================================================================= */}
      {showOwnerRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-900 dark:text-white">Usajili wa Mmiliki wa Daladala</h3>
                  <p className="text-[11px] text-neutral-500">Taarifa zako za umiliki na malipo ya M-Pesa.</p>
                </div>
              </div>
              <button
                onClick={() => setShowOwnerRegisterModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOwnerProfile} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Jina Kamili la Mmiliki *
                </label>
                <input
                  type="text"
                  required
                  value={ownerFormName}
                  onChange={(e) => setOwnerFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya Simu *
                  </label>
                  <input
                    type="tel"
                    required
                    value={ownerFormPhone}
                    onChange={(e) => setOwnerFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya M-Pesa ya Nauli *
                  </label>
                  <input
                    type="tel"
                    required
                    value={ownerFormMpesa}
                    onChange={(e) => setOwnerFormMpesa(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Jina la Kampuni au Chama (mfano UWADAR)
                </label>
                <input
                  type="text"
                  value={ownerFormOrg}
                  onChange={(e) => setOwnerFormOrg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Namba ya NIDA
                  </label>
                  <input
                    type="text"
                    value={ownerFormNida}
                    onChange={(e) => setOwnerFormNida(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                    Wilaya / Eneo
                  </label>
                  <select
                    value={ownerFormZone}
                    onChange={(e) => setOwnerFormZone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Ilala">Ilala</option>
                    <option value="Kinondoni">Kinondoni</option>
                    <option value="Temeke">Temeke</option>
                    <option value="Ubungo">Ubungo</option>
                    <option value="Kigamboni">Kigamboni</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowOwnerRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md transition"
                >
                  Hifadhi Wasifu wa Mmiliki
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TOA PESA KWENDA M-PESA (WITHDRAW REVENUE)                        */}
      {/* ========================================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-neutral-900 dark:text-white">Toa Pesa za Nauli</h3>
                  <p className="text-[11px] text-neutral-500">Inatumwa moja kwa moja kwenye simu yako.</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmWithdraw} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                  Kiasi Kilichopo Kwenye Akaunti
                </span>
                <span className="text-xl font-black text-emerald-900 dark:text-emerald-100 block mt-0.5">
                  TSh {totalNetProfit.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Kiasi Unachotoa (TSh) *
                </label>
                <input
                  type="number"
                  step="1000"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-black text-base focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Njia ya Kupokea
                </label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="mpesa">Vodacom M-Pesa ({ownerProfile.mPesaNumber})</option>
                  <option value="tigopesa">Tigo Pesa ({ownerProfile.phone})</option>
                  <option value="airtel">Airtel Money ({ownerProfile.phone})</option>
                  <option value="crdb">CRDB Bank (Akaunti ya Benki)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition"
                >
                  Thibitisha & Tuma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
