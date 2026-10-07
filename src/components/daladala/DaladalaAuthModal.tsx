import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  User, 
  Bus, 
  Radio, 
  Building2, 
  Phone, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { DaladalaSessionUser, DaladalaUserRole, DaladalaVehicle } from '../../types/daladala.types';

interface DaladalaAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: DaladalaSessionUser) => void;
  initialRole?: DaladalaUserRole;
  vehicles: DaladalaVehicle[];
}

export default function DaladalaAuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  initialRole = 'owner',
  vehicles,
}: DaladalaAuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<DaladalaUserRole>(
    initialRole === 'guest' ? 'owner' : initialRole
  );

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // Register form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [mPesaNumber, setMPesaNumber] = useState('');
  const [assignedPlate, setAssignedPlate] = useState(vehicles[0]?.plateNumber || 'T 392 DKR');

  if (!isOpen) return null;

  // Handle standard Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginPhone.trim()) {
      toast.error('Tafadhali weka namba yako ya simu');
      return;
    }

    // Check if there is a custom registered user stored in localStorage
    try {
      const storedUsersRaw = localStorage.getItem('papo_daladala_registered_users');
      if (storedUsersRaw) {
        const storedUsers: DaladalaSessionUser[] = JSON.parse(storedUsersRaw);
        const match = storedUsers.find((u) => u.phone.includes(loginPhone.trim()) || loginPhone.includes(u.phone));
        if (match) {
          onLoginSuccess(match);
          toast.success(`Karibu tena, ${match.fullName}! Umeingia kama ${match.role === 'owner' ? 'Mmiliki' : match.role === 'conductor' ? 'Kondakta' : match.role === 'driver' ? 'Dereva' : 'Abiria'}`);
          onClose();
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }

    // Otherwise create session for this phone with selected role
    const sessionUser: DaladalaSessionUser = {
      id: `usr_${Date.now()}`,
      role: selectedRole,
      fullName: selectedRole === 'owner' ? `Mmiliki (${loginPhone})` : selectedRole === 'conductor' ? `Kondakta (${loginPhone})` : `Abiria (${loginPhone})`,
      phone: loginPhone,
      assignedPlate: selectedRole === 'conductor' || selectedRole === 'driver' ? assignedPlate : undefined,
      organizationName: selectedRole === 'owner' ? 'Usafiri wa Daladala Dar' : undefined,
      joinedDate: new Date().toISOString().split('T')[0],
      verified: true,
    };

    onLoginSuccess(sessionUser);
    toast.success(`Umeingia kikamilifu kama ${selectedRole === 'owner' ? 'Mmiliki wa Daladala' : selectedRole === 'conductor' ? 'Kondakta' : 'Abiria'}!`);
    onClose();
  };

  // Handle Demo Quick Logins for instant testing
  const handleQuickDemoLogin = (role: DaladalaUserRole) => {
    let demoUser: DaladalaSessionUser;

    if (role === 'owner') {
      demoUser = {
        id: 'owner_01',
        role: 'owner',
        fullName: 'Mzee Juma Rashidi Mwinyi',
        phone: '0754 892 110',
        email: 'mwinyitransport@gmail.com',
        organizationName: 'Mwinyi Coastal Express (UWADAR #428)',
        mPesaNumber: '0754 892 110',
        nidaNumber: '19750814-11105-00002-19',
        bankAccount: 'CRDB Bank: 015248900234',
        joinedDate: '2023-04-12',
        verified: true,
      };
    } else if (role === 'driver') {
      demoUser = {
        id: 'driver_01',
        role: 'driver',
        fullName: 'Athumani Juma (Dereva Bingwa)',
        phone: '0714 552 901',
        assignedPlate: 'T 392 DKR',
        joinedDate: '2023-09-10',
        verified: true,
      };
    } else if (role === 'conductor') {
      demoUser = {
        id: 'konda_01',
        role: 'conductor',
        fullName: 'Bakari Mwajuma (Konda Mpole)',
        phone: '0754 819 021',
        assignedPlate: 'T 392 DKR',
        joinedDate: '2024-01-15',
        verified: true,
      };
    } else {
      demoUser = {
        id: 'passenger_01',
        role: 'passenger',
        fullName: 'Salim Kassim (Abiria)',
        phone: '0712 990 882',
        joinedDate: '2024-06-10',
        verified: true,
      };
    }

    onLoginSuccess(demoUser);
    toast.success(`Umeingia kama ${demoUser.fullName} (${demoUser.role === 'owner' ? 'Mmiliki' : demoUser.role === 'driver' ? 'Dereva' : demoUser.role === 'conductor' ? 'Kondakta' : 'Abiria'})`);
    onClose();
  };

  // Handle Registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Tafadhali weka jina lako kamili');
      return;
    }
    if (!phone.trim()) {
      toast.error('Tafadhali weka namba ya simu');
      return;
    }

    const newUser: DaladalaSessionUser = {
      id: `usr_${Date.now()}`,
      role: selectedRole,
      fullName: fullName.trim(),
      phone: phone.trim(),
      organizationName: selectedRole === 'owner' ? (organizationName.trim() || 'Daladala Transport Co.') : undefined,
      mPesaNumber: selectedRole === 'owner' ? (mPesaNumber.trim() || phone.trim()) : undefined,
      assignedPlate: (selectedRole === 'conductor' || selectedRole === 'driver') ? assignedPlate : undefined,
      joinedDate: new Date().toISOString().split('T')[0],
      verified: true,
      isCustomRegistered: true,
    };

    // Save to persistent list of registered users
    try {
      const storedUsersRaw = localStorage.getItem('papo_daladala_registered_users');
      const storedUsers: DaladalaSessionUser[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];
      storedUsers.push(newUser);
      localStorage.setItem('papo_daladala_registered_users', JSON.stringify(storedUsers));
    } catch (err) {
      console.error(err);
    }

    onLoginSuccess(newUser);
    toast.success(`Hongera ${fullName}! Umesajiliwa kikamilifu kama ${selectedRole === 'owner' ? 'Mmiliki' : selectedRole === 'conductor' ? 'Kondakta' : 'Abiria'}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-blue-950 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Uthibitisho wa Wahusika
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                Ingia / Jisajili Kwenye PapoDaladala
              </h2>
              <p className="text-xs text-neutral-300 mt-0.5">
                Kila mhusika (Mmiliki, Konda, Abiria) anaona taarifa zinazomhusu yeye pekee.
              </p>
            </div>
          </div>
        </div>

        {/* Auth Mode Toggle Tabs (Ingia vs Jisajili) */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-xs font-black">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 rounded-xl transition ${
                authMode === 'login'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              1. Ingia (Sign In)
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`py-2 rounded-xl transition ${
                authMode === 'register'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              2. Jisajili Mpya (Register)
            </button>
          </div>

          {/* Role Picker (Mmiliki vs Kondakta vs Abiria) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              Chagua Nafasi Yako (Role):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('owner')}
                className={`p-2.5 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition active:scale-95 ${
                  selectedRole === 'owner'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Building2 className="w-5 h-5 mb-1 text-amber-500" />
                <span className="text-xs font-black">Mmiliki</span>
                <span className="text-[9px] opacity-75">Magari & Hesabu</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('driver')}
                className={`p-2.5 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition active:scale-95 ${
                  selectedRole === 'driver'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Bus className="w-5 h-5 mb-1 text-blue-500" />
                <span className="text-xs font-black">Dereva</span>
                <span className="text-[9px] opacity-75">HUD & Speedometer</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('conductor')}
                className={`p-2.5 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition active:scale-95 ${
                  selectedRole === 'conductor'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Radio className="w-5 h-5 mb-1 text-purple-500" />
                <span className="text-xs font-black">Kondakta</span>
                <span className="text-[9px] opacity-75">Viti & Tiketi</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('passenger')}
                className={`p-2.5 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition active:scale-95 ${
                  selectedRole === 'passenger'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black shadow-sm ring-1 ring-blue-600'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Users className="w-5 h-5 mb-1 text-emerald-500" />
                <span className="text-xs font-black">Abiria</span>
                <span className="text-[9px] opacity-75">Ramani & Safari</span>
              </button>
            </div>
          </div>

          {/* Form: LOGIN */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Namba ya Simu
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="07XX XXX XXX au +255 7..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  PIN au Nenosiri
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    placeholder="Weka tarakimu 4 za PIN..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              {selectedRole === 'conductor' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Gari Unalofanyia Kazi
                  </label>
                  <select
                    value={assignedPlate}
                    onChange={(e) => setAssignedPlate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.plateNumber}>
                        {v.plateNumber} — {v.nickname} ({v.routeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                <span>Ingia Kwenye Akaunti Yangu</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Instant One-Tap Demo Access */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider text-center">
                  Au Jaribu Moja kwa Moja (Akaunti za Mfano):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('owner')}
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 text-left transition"
                  >
                    <span className="block font-black text-xs">👑 Mmiliki</span>
                    <span className="text-[9px] opacity-80">Mzee Mwinyi (3)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('driver')}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 text-left transition"
                  >
                    <span className="block font-black text-xs">🚍 Dereva</span>
                    <span className="text-[9px] opacity-80">Athumani (Speed)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('conductor')}
                    className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 text-left transition"
                  >
                    <span className="block font-black text-xs">🎫 Kondakta</span>
                    <span className="text-[9px] opacity-80">Bakari (Tiketi)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('passenger')}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-left transition"
                  >
                    <span className="block font-black text-xs">👥 Abiria</span>
                    <span className="text-[9px] opacity-80">Ramani ya Dar</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Form: REGISTER */
            <form onSubmit={handleRegister} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Jina Lako Kamili
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="k.m. Ally Salim Mkude"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Namba ya Simu
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {selectedRole === 'owner' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Jina la Kampuni au Chama (Chama cha Daladala / UWADAR)
                    </label>
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="k.m. Mkude Coastal Transport (UWADAR #901)"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Namba ya M-Pesa / Tigo Pesa ya Kupokelea Mapato (Withdraw)
                    </label>
                    <input
                      type="tel"
                      value={mPesaNumber}
                      onChange={(e) => setMPesaNumber(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </>
              )}

              {(selectedRole === 'conductor' || selectedRole === 'driver') && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Gari Utakalosimamia (Plate Number)
                  </label>
                  <select
                    value={assignedPlate}
                    onChange={(e) => setAssignedPlate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.plateNumber}>
                        {v.plateNumber} — {v.nickname} ({v.routeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Weka PIN (Tarakimu 4 za siri)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Mfano: 1234"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                <span>Kamilisha Usajili na Ingia</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Privacy Note */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl text-[11px] text-neutral-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Taarifa za hesabu za mapato na kutoa fedha zinalindwa kwa viwango vya LATRA na zinapatikana kwa Mmiliki aliyethibitishwa pekee.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
