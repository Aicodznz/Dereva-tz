import React, { useState } from 'react';
import { 
  Stethoscope, ShoppingBag, Plane, Fuel, Zap, Sparkles, Shirt, 
  Wrench, Bug, Car, ParkingSquare, Coins, Receipt, Wallet, 
  Briefcase, Calendar, Ticket, Film, Search, ChevronRight, 
  ArrowLeft, CheckCircle2, Clock, MapPin, Star, ShieldCheck, 
  Phone, Send, Filter, AlertCircle, Copy, QrCode
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export type ServiceHubCategory = 
  | 'all'
  | 'health'
  | 'home_services'
  | 'mobility_transport'
  | 'marketplace_jobs'
  | 'fintech_loans'
  | 'entertainment_tickets';

export default function SuperServicesHub() {
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId?: string }>();
  
  const [selectedCategory, setSelectedCategory] = useState<ServiceHubCategory>('all');
  const [activeModalService, setActiveModalService] = useState<string | null>(serviceId || null);
  const [searchQuery, setSearchQuery] = useState('');

  // Service Hub Data Definitions
  const servicesList = [
    {
      id: 'doctor_appointment',
      category: 'health',
      title: 'Doctor Appointment',
      swTitle: 'Miadi ya Daktari & Kliniki',
      desc: 'Tafuta daktari bingwa, angalia nafasi za kliniki na upokee namba ya foleni ya kidijitali.',
      icon: Stethoscope,
      badge: 'AFYA',
      color: 'from-blue-500 to-indigo-600',
      features: ['Uchaguzi wa madaktari bingwa', 'Uthibitisho wa kliniki papo hapo', 'Namba ya foleni na vikumbusho']
    },
    {
      id: 'service_booking',
      category: 'home_services',
      title: 'Service Booking',
      swTitle: 'Huduma za Nyumbani & Wataalamu',
      desc: 'Agiza wataalamu wa nyumbani: Usafi, Dobi, Ufundi Bomba/Umeme, Fumigation na Service ya Magari.',
      icon: Sparkles,
      badge: 'TOP CHOICE',
      color: 'from-emerald-500 to-teal-700',
      features: ['Laundry & Usafi wa nguo', 'Home Cleaning & Degreasing', 'Home Maintenance (Umeme/AC)', 'Pest Control na Warranty', 'Vehicle Service & Diagnostic']
    },
    {
      id: 'flight_booking',
      category: 'mobility_transport',
      title: 'Flight Booking',
      swTitle: 'Tiketi za Ndege (Flights)',
      desc: 'Tafuta ndege za ndani na za kimataifa, chagua viti kwenye ramani na pakua tiketi ya kielektroniki.',
      icon: Plane,
      badge: 'SAFARI',
      color: 'from-sky-500 to-blue-700',
      features: ['Dar, Zanzibar, Kilimanjaro, Mwanza, Dubai', 'Uchaguzi wa siti', 'Taarifa za bei za bei nafuu']
    },
    {
      id: 'parking_reservation',
      category: 'mobility_transport',
      title: 'Parking Reservation',
      swTitle: 'Kuhifadhi Nafasi ya Maegesho',
      desc: 'Tafuta na uweke nafasi ya maegesho ya gari mjini, viwanja vya ndege au maduka makubwa kwa geti la QR.',
      icon: ParkingSquare,
      badge: 'PARKING',
      color: 'from-violet-500 to-purple-700',
      features: ['Mlimani City, Kariakoo, JNIA Airport', 'Malipo kwa njia ya simu', 'QR Barrier Entry']
    },
    {
      id: 'fuel_delivery',
      category: 'mobility_transport',
      title: 'Fuel Delivery & Breakdown',
      swTitle: 'Mafuta ya Dharura & Msaada Barabarani',
      desc: 'Leta mafuta (Petroli, Dizeli) kwenye gari lililokwama au jenereta, pamoja na huduma ya towing.',
      icon: Fuel,
      badge: 'DHURURA',
      color: 'from-amber-500 to-orange-600',
      features: ['Utoaji wa lita 5 hadi 1,000', 'Msaada wa betri na tairi', 'Ufuatiliaji wa gari la mafuta moja kwa moja']
    },
    {
      id: 'ev_charging_gas',
      category: 'mobility_transport',
      title: 'EV Charging & Gas & Oil',
      swTitle: 'Chaja za Magari ya Umeme, Gesi & Oili',
      desc: 'Tafuta vituo vya kuchaji magari ya umeme, badilisha mtungi wa gesi (Oryx/Taifa Gas) na oili safi.',
      icon: Zap,
      badge: 'ENERGY',
      color: 'from-cyan-500 to-blue-600',
      features: ['Fast Charging reservation', 'Mtungi wa gesi 6kg / 15kg mlangoni', 'Engine oil delivery']
    },
    {
      id: 'recharge_bills',
      category: 'fintech_loans',
      title: 'Recharge & Bill Payment',
      swTitle: 'Vocha, LUKU & Bili Zote',
      desc: 'Nunua vocha za simu zote, tokeni ya LUKU, bili za maji DAWASCO, DSTV, Azam na intaneti kwa sekunde.',
      icon: Receipt,
      badge: 'BILI',
      color: 'from-rose-500 to-red-600',
      features: ['LUKU token papo hapo', 'Maji DAWASCO', 'Vocha za mitandao yote 🇹🇿']
    },
    {
      id: 'loan_marketplace',
      category: 'fintech_loans',
      title: 'Loan Marketplace & BNPL',
      swTitle: 'Mikopo ya Wafanyabiashara & Lipa Kidogo',
      desc: 'Mkopo wa fedha za mauzo kwa maduka (Merchant Advance) na nunua sasa lipa baadaye (BNPL).',
      icon: Wallet,
      badge: 'FINTECH',
      color: 'from-emerald-600 to-green-700',
      features: ['BNPL - Lipa kwa awamu bila riba', 'Mtaji wa haraka kwa wauzaji', 'Uhakiki wa papo hapo']
    },
    {
      id: 'classified_marketplace',
      category: 'marketplace_jobs',
      title: 'Classified Marketplace',
      swTitle: 'Soko Huria (P2P Buy & Sell)',
      desc: 'Uza au nunua vitu vilivyotumika na vipya moja kwa moja: Magari, Simu, Samani na Nyumba.',
      icon: ShoppingBag,
      badge: 'SOKO',
      color: 'from-orange-500 to-amber-600',
      features: ['Matangazo ya bure', 'Kutuma meseji ndani ya app', 'Uchujaji wa eneo la karibu']
    },
    {
      id: 'job_portal',
      category: 'marketplace_jobs',
      title: 'Job Portal',
      swTitle: 'Nafasi za Kazi & Ajira',
      desc: 'Bodi ya nafasi za kazi kwa maduka, madereva, migahawa na mafundi; tuma CV na wasifu wako.',
      icon: Briefcase,
      badge: 'AJIRA',
      color: 'from-blue-600 to-sky-700',
      features: ['Kazi za madereva & bodaboda', 'Wafanyakazi wa hoteli & ofisi', 'Tuma maombi kwa mbofyo mmoja']
    },
    {
      id: 'appointment_booking',
      category: 'marketplace_jobs',
      title: 'Appointment Booking',
      swTitle: 'Miadi ya Ushauri & Wataalamu',
      desc: 'Panga miadi ya mawakili, wahasibu, washauri wa kodi na biashara na mikutano ya video/ofisini.',
      icon: Calendar,
      badge: 'MIADI',
      color: 'from-purple-600 to-indigo-700',
      features: ['Uteuzi wa siku na saa', 'Mikutano ya mtandaoni au ofisini', 'Vikumbusho vya SMS']
    },
    {
      id: 'event_booking',
      category: 'entertainment_tickets',
      title: 'Event Booking',
      swTitle: 'Tiketi za Matamasha & Mechi',
      desc: 'Tiketi za mechi za mpira (Simba & Yanga), mikutano mikubwa, matamasha na scanner ya QR mlangoni.',
      icon: Ticket,
      badge: 'MATUKIO',
      color: 'from-pink-500 to-rose-600',
      features: ['Tiketi za VIP & Regular', 'Uthibitisho wa QR wa kielektroniki', 'Kuingia bila foleni']
    },
    {
      id: 'ticket_booking',
      category: 'entertainment_tickets',
      title: 'Attraction & Cinema Tickets',
      swTitle: 'Tiketi za Sinema & Viwanja vya Michezo',
      desc: 'Kukata tiketi za sinema (Century Cinemax), makumbusho, mbuga za wanyama na waterparks kwa punguzo.',
      icon: Film,
      badge: 'BURUDANI',
      color: 'from-red-600 to-amber-700',
      features: ['Sinema mpya zilizotoka', 'Water parks & Museum passes', 'Punguzo la makundi na familia']
    },
    {
      id: 'nft_marketplace',
      category: 'entertainment_tickets',
      title: 'NFT & Digital Collectibles',
      swTitle: 'Soko la Kidijitali & Web3 Rewards',
      desc: 'Mkusanyiko wa kazi za sanaa za kidijitali za Wasanii wa Kitanzania, zawadi za wateja na vitambulisho.',
      icon: Coins,
      badge: 'WEB3',
      color: 'from-violet-600 to-purple-800',
      features: ['Mkusanyiko wa sanaa asilia', 'Pointi na Tokeni za uaminifu', 'Pochi ya kidijitali']
    }
  ];

  const categories = [
    { id: 'all', label: 'Zote (All Services)' },
    { id: 'health', label: 'Afya & Daktari' },
    { id: 'home_services', label: 'Huduma za Nyumbani' },
    { id: 'mobility_transport', label: 'Usafiri, Ndege & Mafuta' },
    { id: 'marketplace_jobs', label: 'Biashara, Kazi & Miadi' },
    { id: 'fintech_loans', label: 'Bili, Vocha & Mikopo' },
    { id: 'entertainment_tickets', label: 'Tiketi, Sinema & Matukio' }
  ];

  const filteredServices = servicesList.filter(s => {
    const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchSearch = searchQuery === '' || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.swTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 pb-24">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white pt-6 pb-10 px-4 sm:px-6 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Nyumbani
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full font-black tracking-widest uppercase">
                Papo SuperApp Hub 🇹🇿
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight uppercase italic font-display">
            Huduma Zote za Papo Hapo
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl font-medium">
            Kituo kikuu cha huduma zote za kidijitali: Afya, Ndege, Mafuta, Bili, Mikopo, Maegesho, Ajira na Mafundi walioidhinishwa.
          </p>

          {/* Search Box */}
          <div className="mt-6 relative max-w-2xl">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tafuta huduma mfano: Daktari, Ndege, LUKU, Mafuta, Dobi, Ajira..."
              className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white pl-12 pr-4 py-3.5 rounded-2xl shadow-lg border-2 border-transparent focus:border-amber-400 focus:outline-none text-sm font-semibold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                Futa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-5">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar bg-white dark:bg-neutral-900 p-2 rounded-2xl shadow-md border border-neutral-200/80 dark:border-neutral-800">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as ServiceHubCategory)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-neutral-800 dark:text-neutral-200">
            {categories.find(c => c.id === selectedCategory)?.label} ({filteredServices.length})
          </h2>
          <span className="text-xs text-neutral-500 font-semibold">Gusa huduma kuanza</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredServices.map((service, idx) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * idx }}
                onClick={() => setActiveModalService(service.id)}
                className="group bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between hover:border-orange-500/50 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform shrink-0`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    {service.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors">
                    {service.swTitle}
                  </h3>
                  <span className="text-[11px] font-bold text-neutral-400 block mb-2">{service.title}</span>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {service.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-bold text-orange-600 dark:text-orange-400 group-hover:translate-x-1 transition-transform">
                  <span>Fungua Huduma</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Interactive Service Modals */}
      <AnimatePresence>
        {activeModalService && (
          <InteractiveServiceModal 
            serviceId={activeModalService} 
            onClose={() => setActiveModalService(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent: Dedicated Interactive Workflows for Each Service
function InteractiveServiceModal({ serviceId, onClose }: { serviceId: string; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmedData, setConfirmedData] = useState<any>(null);

  // Form states
  const [doctorSpecialty, setDoctorSpecialty] = useState('Daktari wa Jumla (General Practitioner)');
  const [doctorDate, setDoctorDate] = useState('Leo, Saa 10:00 Jioni');
  const [patientName, setPatientName] = useState('');
  
  // Flight states
  const [flightFrom, setFlightFrom] = useState('Dar es Salaam (DAR)');
  const [flightTo, setFlightTo] = useState('Zanzibar (ZNZ)');
  const [flightDate, setFlightDate] = useState('Kesho');
  const [flightSeat, setFlightSeat] = useState('Dirishani (Window 4A)');

  // Fuel states
  const [fuelType, setFuelType] = useState('Petroli (Super)');
  const [fuelLiters, setFuelLiters] = useState('20');
  const [fuelAddress, setFuelAddress] = useState('Mlimani City, Ubungo');

  // Recharge states
  const [meterOrPhone, setMeterOrPhone] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('10,000');
  const [billType, setBillType] = useState('LUKU (Umeme)');

  // Service Booking states
  const [selectedSubService, setSelectedSubService] = useState('laundry');

  const handleBook = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setConfirmedData({
        ref: 'PAPO-' + Math.floor(100000 + Math.random() * 900000),
        time: new Date().toLocaleTimeString()
      });
      setStep(2);
      toast.success('Ombi limepokelewa na linashughulikiwa!');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 my-auto"
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight">
              {serviceId === 'doctor_appointment' && '🩺 Miadi ya Daktari & Kliniki'}
              {serviceId === 'service_booking' && '🛠️ Huduma za Nyumbani & Wataalamu'}
              {serviceId === 'flight_booking' && '✈️ Tiketi za Ndege (Flights)'}
              {serviceId === 'fuel_delivery' && '⛽ Mafuta & Breakdown ya Dharura'}
              {serviceId === 'ev_charging_gas' && '⚡ EV Charging, Gesi & Oili'}
              {serviceId === 'parking_reservation' && '🅿️ Nafasi ya Maegesho (Parking)'}
              {serviceId === 'recharge_bills' && '📱 Vocha, LUKU & Bili Zote'}
              {serviceId === 'loan_marketplace' && '💳 Mikopo & Lipa Kidogo (BNPL)'}
              {serviceId === 'classified_marketplace' && '🛍️ Soko Huria (P2P Marketplace)'}
              {serviceId === 'job_portal' && '💼 Nafasi za Kazi & Ajira'}
              {serviceId === 'appointment_booking' && '📅 Miadi ya Ushauri & Wataalamu'}
              {serviceId === 'event_booking' && '🎟️ Tiketi za Matamasha & Mechi'}
              {serviceId === 'ticket_booking' && '🎬 Sinema & Vivutio vya Utalii'}
              {serviceId === 'nft_marketplace' && '🪙 Sanaa ya Kidijitali & Web3'}
            </h3>
            <span className="text-xs text-orange-100 font-medium">Uthibitisho wa papo hapo</span>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {step === 1 ? (
            <>
              {/* Doctor Appointment */}
              {serviceId === 'doctor_appointment' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Chagua Ubingwa wa Daktari</label>
                    <select 
                      value={doctorSpecialty} 
                      onChange={(e) => setDoctorSpecialty(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold"
                    >
                      <option>Daktari wa Jumla (General Practitioner)</option>
                      <option>Daktari wa Watoto (Pediatrician)</option>
                      <option>Daktari wa Moyo (Cardiologist)</option>
                      <option>Daktari wa Meno (Dentist)</option>
                      <option>Daktari wa Macho (Ophthalmologist)</option>
                      <option>Daktari wa Wanawake (Gynecologist)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Kituo cha Afya / Hospitali</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {['Aga Khan Hospital', 'Kairuki Hospital', 'Muhimbili National', 'TMJ Mikocheni'].map(h => (
                        <div key={h} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-bold">
                          🏥 {h}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Muda Unaopendelea</label>
                    <input 
                      type="text" 
                      value={doctorDate} 
                      onChange={(e) => setDoctorDate(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Service Booking Hub (Laundry, Cleaning, Maintenance, Pest Control, Vehicle) */}
              {serviceId === 'service_booking' && (
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase text-neutral-500">Chagua Aina ya Huduma</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'laundry', label: '🧺 Laundry & Dobi', desc: 'Wash, Iron, Express 6hr' },
                      { id: 'cleaning', label: '🧹 Home Cleaning', desc: 'Deep cleaning & sofa wash' },
                      { id: 'maintenance', label: '⚡ Maintenance', desc: 'Electrician, Plumber, AC' },
                      { id: 'pest_control', label: '🐜 Pest Control', desc: 'Fumigation & Warranty' },
                      { id: 'vehicle', label: '🚗 Vehicle Service', desc: 'Oil change, brakes & scan' }
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSubService(s.id)}
                        className={`p-3 rounded-2xl text-left border transition-all ${
                          selectedSubService === s.id
                            ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20 shadow-sm'
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                        }`}
                      >
                        <span className="font-bold text-xs block">{s.label}</span>
                        <span className="text-[10px] text-neutral-500 block mt-0.5">{s.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-orange-600">✓ Gharama ya Uhakiki & Bei wazi</span>
                    <p className="text-neutral-500">Fundi au timu itafika eneo lako ndani ya dakika 30-45 ikiwa na vifaa kamili.</p>
                  </div>
                </div>
              )}

              {/* Flight Booking */}
              {serviceId === 'flight_booking' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-500">Kutoka</label>
                      <input 
                        type="text" 
                        value={flightFrom} 
                        onChange={(e) => setFlightFrom(e.target.value)}
                        className="w-full mt-1 p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold border border-neutral-300 dark:border-neutral-700" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-neutral-500">Kuelekea</label>
                      <input 
                        type="text" 
                        value={flightTo} 
                        onChange={(e) => setFlightTo(e.target.value)}
                        className="w-full mt-1 p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold border border-neutral-300 dark:border-neutral-700" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-500">Shirika la Ndege</label>
                    <div className="flex gap-2 mt-1">
                      {['Air Tanzania', 'Precision Air', 'Fly540'].map(a => (
                        <span key={a} className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold border border-neutral-200 dark:border-neutral-700">
                          ✈️ {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fuel Delivery */}
              {serviceId === 'fuel_delivery' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Aina ya Mafuta</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {['Petroli (Super)', 'Dizeli (Diesel)', 'Mafuta ya Jenereta', 'Breakdown Support'].map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFuelType(f)}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                            fuelType === f ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Kiasi cha Lita</label>
                    <input 
                      type="number" 
                      value={fuelLiters} 
                      onChange={(e) => setFuelLiters(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Recharge & Bills */}
              {serviceId === 'recharge_bills' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Aina ya Bili</label>
                    <select 
                      value={billType} 
                      onChange={(e) => setBillType(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold"
                    >
                      <option>LUKU (Umeme wa TANESCO)</option>
                      <option>DAWASCO (Bili ya Maji)</option>
                      <option>Vocha ya Vodacom (M-Pesa)</option>
                      <option>Vocha ya Tigo (Tigo Pesa)</option>
                      <option>Vocha ya Airtel (Airtel Money)</option>
                      <option>DSTV / Azam TV</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Namba ya Mita / Simu</label>
                    <input 
                      type="text" 
                      placeholder="Mfano: 04123456789 au 0712345678"
                      value={meterOrPhone}
                      onChange={(e) => setMeterOrPhone(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* General Fallback Inputs for other services */}
              {!['doctor_appointment', 'service_booking', 'flight_booking', 'fuel_delivery', 'recharge_bills'].includes(serviceId) && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-xs space-y-1">
                    <span className="font-bold text-orange-600 block">Huduma ya Papo Hapo Ipo Tayari</span>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Weka taarifa zako hapa chini na mfumo utakuunganisha mara moja na mtoa huduma au kukupa tiketi/namba yako ya kielektroniki.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-neutral-500">Jina au Maelezo ya Ombi</label>
                    <input 
                      type="text" 
                      placeholder="Andika maelezo mafupi..." 
                      className="w-full mt-1 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold" 
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleBook}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-sm uppercase py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
              >
                {loading ? 'Inathibitisha...' : 'Thibitisha Ombi Papo Hapo'}
              </button>
            </>
          ) : (
            /* Step 2: Digital Confirmation Ticket & QR */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-black text-neutral-900 dark:text-white">Ombi Limethibitishwa!</h4>
                <p className="text-xs text-neutral-500 mt-1">Ujumbe na tiketi yako ya kielektroniki imehifadhiwa.</p>
              </div>

              {/* Digital Card Pass */}
              <div className="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">Namba ya Kumbukumbu:</span>
                  <span className="font-mono font-black text-orange-600">{confirmedData?.ref}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">Muda wa Kupokelewa:</span>
                  <span className="font-semibold">{confirmedData?.time}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">Hali ya Ombi:</span>
                  <span className="font-black text-emerald-600">INASHUGHULIKIWA (ACTIVE)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-black text-xs uppercase py-3.5 rounded-xl transition-all"
              >
                Imekamilika (Funga)
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
