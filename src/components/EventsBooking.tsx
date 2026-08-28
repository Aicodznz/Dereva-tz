import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ticket, Calendar, MapPin, Clock, Users, Search, 
  Sparkles, ChevronRight, ArrowLeft, CheckCircle2, 
  Share2, Download, QrCode, CreditCard, ShieldCheck, 
  Flame, Music, Trophy, Briefcase, Smile, Heart, Star,
  Smartphone, Filter, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';

interface EventTicketTier {
  id: string;
  name: string;
  price: number;
  perks: string[];
  remaining: number;
  badge?: string;
}

interface PapoEvent {
  id: string;
  title: string;
  category: 'music' | 'sports' | 'business' | 'comedy' | 'party';
  categoryLabel: string;
  banner: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  organizer: string;
  lineup?: string[];
  description: string;
  isFeatured?: boolean;
  tiers: EventTicketTier[];
}

const DEMO_EVENTS: PapoEvent[] = [
  {
    id: 'simba-vs-yanga-2026',
    title: 'Kariakoo Derby: Simba SC vs Yanga SC',
    category: 'sports',
    categoryLabel: 'Michezo (NBC Premier League)',
    banner: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1000&auto=format&fit=crop',
    date: 'Jumamosi, 14 Machi 2026',
    time: 'Saa 11:00 Jioni (17:00 EAT)',
    venue: 'Uwanja wa Benjamin Mkapa',
    city: 'Dar es Salaam',
    organizer: 'TFF & NBC Premier League',
    lineup: ['Simba SC', 'Young Africans SC'],
    description: 'Pambano kubwa zaidi la soka Afrika Mashariki na Kati! Shuhudia upinzani wa jadi LIVE uwanjani.',
    isFeatured: true,
    tiers: [
      { id: 'mzunguko', name: 'Mzunguko (Regular)', price: 10000, remaining: 1420, perks: ['Kuingia uwanjani lango kuu', 'Kiti cha kawaida'] },
      { id: 'vip-b', name: 'VIP B & C', price: 30000, remaining: 240, perks: ['Muingilio wa VIP', 'Mtazamo mzuri wa uwanja', 'Maji ya kunywa'], badge: 'POPULAR' },
      { id: 'vip-a', name: 'VIP A & Lounge', price: 100000, remaining: 35, perks: ['Viti vya kisasa vya Lounge', 'Chakula & Vinywaji', 'Parking ya VIP', 'Ulinzi wa uhakika'] }
    ]
  },
  {
    id: 'bongo-flava-mega-fest-2026',
    title: 'Dar Mega Bongo Flava Live Concert',
    category: 'music',
    categoryLabel: 'Muziki & Matamasha',
    banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1000&auto=format&fit=crop',
    date: 'Ijumaa, 20 Machi 2026',
    time: 'Saa 02:00 Usiku Mpaka Asubuhi',
    venue: 'Mlimani City Conference & Arena',
    city: 'Dar es Salaam',
    organizer: 'Papo Events & SoundWave',
    lineup: ['Diamond Platnumz', 'Harmonize', 'Ali Kiba', 'Nandy', 'Zuchu', 'Marioo'],
    description: 'Tamasha kubwa zaidi la muziki lililowakusanya mastaa wote wakubwa wa Bongo Flava kwenye jukwaa moja!',
    isFeatured: true,
    tiers: [
      { id: 'regular', name: 'Regular Pass', price: 20000, remaining: 650, perks: ['Kuingia ukumbini', 'Sehemu ya mbele ya jukwaa'] },
      { id: 'vip', name: 'VIP Ticket', price: 60000, remaining: 80, perks: ['Welcome Drink', 'Sehemu ya kukaa VIP', 'Huduma maalum ya vinywaji'], badge: 'HOT' },
      { id: 'table', name: 'Meza ya Watu 6 (VVIP Table)', price: 600000, remaining: 8, perks: ['Meza ya watu 6', 'Chupa 2 za Premium Spirit', 'Platter ya chakula', 'Waiter binafsi'] }
    ]
  },
  {
    id: 'swahili-comedy-night',
    title: 'Usiku wa Vichekesho (Swahili Standup Laugh Fest)',
    category: 'comedy',
    categoryLabel: 'Comedy & Vichekesho',
    banner: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=1000&auto=format&fit=crop',
    date: 'Jumapili, 29 Machi 2026',
    time: 'Saa 01:00 Usiku',
    venue: 'Julius Nyerere International Convention Centre (JNICC)',
    city: 'Dar es Salaam',
    organizer: 'Laughter Unlimited TZ',
    description: 'Mavazi rasmi, mbavu za kucheka na wachekeshaji nguli wa Afrika Mashariki!',
    tiers: [
      { id: 'com-reg', name: 'Kiti cha Kawaida', price: 25000, remaining: 320, perks: ['Kiti kikuu'] },
      { id: 'com-vip', name: 'VIP Front Row', price: 75000, remaining: 45, perks: ['Mstari wa mbele', 'Picha na wachekeshaji', 'Cocktail'] }
    ]
  },
  {
    id: 'africa-tech-summit-dsm',
    title: 'Tanzania AI & FinTech Tech Summit 2026',
    category: 'business',
    categoryLabel: 'Semina & Biashara',
    banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop',
    date: '5 - 6 Aprili 2026',
    time: 'Saa 03:00 Asubuhi - Saa 11:00 Jioni',
    venue: 'Hyatt Regency Kilimanjaro Hotel',
    city: 'Dar es Salaam',
    organizer: 'TechTanzania Hub & ICT Commission',
    description: 'Mkutano wa kimataifa wa uvumbuzi wa kiteknolojia, Akili Bandia (AI), uwekezaji na mitaji ya kibiashara.',
    tiers: [
      { id: 'delegate', name: 'Standard Delegate', price: 150000, remaining: 90, perks: ['Siku zote 2', 'Buffet Lunch & Coffee breaks', 'Access to pitch sessions'] },
      { id: 'investor', name: 'Executive / Investor Pass', price: 400000, remaining: 20, perks: ['VIP Networking Dinner', 'Private Deal Room access', 'Executive summary booklet'] }
    ]
  }
];

export const EventsBooking: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<PapoEvent | null>(null);
  
  // Booking Form State
  const [selectedTier, setSelectedTier] = useState<EventTicketTier | null>(null);
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [attendeeName, setAttendeeName] = useState<string>(user?.displayName || '');
  const [attendeePhone, setAttendeePhone] = useState<string>('0755 000 111');
  
  // User's Purchased Tickets
  const [myTickets, setMyTickets] = useState<any[]>([
    {
      id: 'TIK-984210',
      eventTitle: 'Kariakoo Derby: Simba SC vs Yanga SC',
      tierName: 'VIP B & C',
      count: 2,
      total: 60000,
      venue: 'Uwanja wa Benjamin Mkapa',
      date: 'Jumamosi, 14 Machi 2026',
      time: '17:00 EAT',
      qrCodeData: 'PAPO-TICKET-SIMBA-YANGA-984210-VIP',
      status: 'valid' // 'valid' | 'scanned'
    }
  ]);
  const [activeTab, setActiveTab] = useState<'explore' | 'my-tickets'>('explore');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState<any>(null);

  // Filtered Events
  const filteredEvents = DEMO_EVENTS.filter(evt => {
    const matchesCat = selectedCategory === 'all' || evt.category === selectedCategory;
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          evt.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          evt.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenBooking = (evt: PapoEvent) => {
    setSelectedEvent(evt);
    setSelectedTier(evt.tiers[0]);
    setTicketCount(1);
  };

  const handleBuyTicket = () => {
    if (!selectedEvent || !selectedTier) return;
    if (!attendeeName.trim() || !attendeePhone.trim()) {
      toast.error("Tafadhali jaza jina na namba ya simu ya mpokeaji tiketi.");
      return;
    }

    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      const newTicket = {
        id: `TIK-${Math.floor(100000 + Math.random() * 900000)}`,
        eventTitle: selectedEvent.title,
        tierName: selectedTier.name,
        count: ticketCount,
        total: selectedTier.price * ticketCount,
        venue: selectedEvent.venue,
        date: selectedEvent.date,
        time: selectedEvent.time,
        qrCodeData: `PAPO-TICKET-${selectedEvent.id}-${Date.now()}`,
        status: 'valid'
      };

      setMyTickets(prev => [newTicket, ...prev]);
      setConfirmedTicket(newTicket);
      setSelectedEvent(null);
      toast.success("Tiketi yako ya PapoTicket imetolewa kikamilifu! 🎟️✨");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white pb-32">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5">
                PapoTicket
                <span className="text-[9px] bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Events & Matamasha
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-neutral-500 font-bold">Tiketi za Mechi, Matamasha, Semina & Sherehe</p>
          </div>
        </div>

        {/* Tab Switcher: Explore vs My Tickets */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'explore' 
                ? 'bg-white dark:bg-neutral-700 text-neutral-950 dark:text-white shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Matukio
          </button>
          <button
            onClick={() => setActiveTab('my-tickets')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'my-tickets' 
                ? 'bg-orange-600 text-white shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Tiketi Zangu</span>
            {myTickets.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-neutral-950 font-black text-[9px] flex items-center justify-center">
                {myTickets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {activeTab === 'explore' ? (
          <>
            {/* Search and Category Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tafuta tukio, mechi, msanii au ukumbi..."
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 shadow-sm"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {[
                  { id: 'all', label: 'Zote (All Events)', icon: Sparkles },
                  { id: 'sports', label: 'Michezo & Derby', icon: Trophy },
                  { id: 'music', label: 'Muziki & Concerts', icon: Music },
                  { id: 'comedy', label: 'Comedy & Standup', icon: Smile },
                  { id: 'business', label: 'Semina & Tech', icon: Briefcase }
                ].map((c) => {
                  const CIcon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
                        selectedCategory === c.id
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-md'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <CIcon className="w-3.5 h-3.5" />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Featured Event Hero */}
            {filteredEvents.length > 0 && filteredEvents[0].isFeatured && selectedCategory === 'all' && !searchQuery && (
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl group cursor-pointer" onClick={() => handleOpenBooking(filteredEvents[0])}>
                <div className="h-80 sm:h-96 relative">
                  <img 
                    src={filteredEvents[0].banner} 
                    alt={filteredEvents[0].title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-orange-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-lg">
                      <Flame className="w-3.5 h-3.5 animate-pulse" />
                      <span>HOT EVENT • TUKIO KUU</span>
                    </span>
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">{filteredEvents[0].categoryLabel}</span>
                    <h2 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">
                      {filteredEvents[0].title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-300 pt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-orange-400" /> {filteredEvents[0].date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-orange-400" /> {filteredEvents[0].time}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-orange-400" /> {filteredEvents[0].venue}</span>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-bold">Kuanzia</span>
                        <p className="text-xl font-black text-amber-400">TZS {filteredEvents[0].tiers[0].price.toLocaleString()}</p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBooking(filteredEvents[0]);
                        }}
                        className="px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center gap-2 active:scale-95 transition-all"
                      >
                        <Ticket className="w-4 h-4" />
                        <span>Kununua Tiketi</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Events Grid */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-500">Matukio Yote Yanayokuja</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="h-48 relative overflow-hidden">
                      <img 
                        src={evt.banner} 
                        alt={evt.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white font-black text-[9px] uppercase tracking-wider">
                          {evt.categoryLabel.split(' ')[0]}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{evt.date}</span>
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-black text-neutral-900 dark:text-white line-clamp-1 group-hover:text-orange-500 transition-colors">
                          {evt.title}
                        </h4>
                        <p className="text-[11px] text-neutral-500 font-bold flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{evt.venue}, {evt.city}</span>
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-2 font-medium">
                          {evt.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-neutral-400 block">Bei Kuanzia</span>
                          <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                            TZS {evt.tiers[0].price.toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenBooking(evt)}
                          className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Tiketi</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* My Tickets Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black tracking-tight">Tiketi Zako za Dijitali (Digital QR Passes)</h3>
              <span className="text-xs font-black text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-xl">
                {myTickets.length} Tiketi
              </span>
            </div>

            {myTickets.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 space-y-3">
                <Ticket className="w-12 h-12 text-neutral-300 mx-auto" />
                <h4 className="text-sm font-black">Hujapata Tiketi Yoyote Bado</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Chagua tukio kwenye orodha ya matukio kisha nunua tiketi yako ya kidijitali kwa ajili ya kuingilia uwanjani au ukumbini.
                </p>
                <button
                  onClick={() => setActiveTab('explore')}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-wider mt-2"
                >
                  Gundua Matukio Sasa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTickets.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-md relative overflow-hidden space-y-4"
                  >
                    {/* Ticket Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-md">
                          PASS #{t.id}
                        </span>
                        <h4 className="text-base font-black mt-1.5 leading-snug">{t.eventTitle}</h4>
                        <span className="text-xs font-extrabold text-amber-500">{t.tierName} • {t.count} Pass</span>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {t.status === 'valid' ? 'Inafanya Kazi' : 'Imetumika'}
                      </span>
                    </div>

                    {/* Venue & Date */}
                    <div className="bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-2xl text-xs space-y-1 font-medium">
                      <p className="flex items-center gap-1.5 font-bold"><MapPin className="w-3.5 h-3.5 text-orange-500" /> {t.venue}</p>
                      <p className="flex items-center gap-1.5 text-neutral-500"><Calendar className="w-3.5 h-3.5 text-orange-500" /> {t.date} • {t.time}</p>
                    </div>

                    {/* QR Code Section */}
                    <div className="p-4 bg-neutral-950 text-white rounded-2xl flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">Scan at Entrance</p>
                        <p className="text-xs font-black text-emerald-400">QR CODE TICKET</p>
                        <p className="text-[9px] text-neutral-500 font-mono">ID: {t.qrCodeData}</p>
                      </div>

                      <div className="w-16 h-16 bg-white p-1.5 rounded-xl shadow-md flex items-center justify-center">
                        <QrCode className="w-full h-full text-black" />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(t.qrCodeData);
                          toast.success("Kodi ya tiketi imenakiliwa! 📋");
                        }}
                        className="flex-1 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-black text-xs flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pakua Pass</span>
                      </button>

                      <button
                        onClick={() => {
                          const text = `Hii hapa tiketi yangu ya ${t.eventTitle} (${t.tierName}) kwa ajili ya kuingilia: ${t.qrCodeData}`;
                          const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                          window.open(url, '_blank');
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ticket Purchase Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-0.5 rounded-md">
                  {selectedEvent.categoryLabel}
                </span>
                <h3 className="text-lg font-black mt-1">{selectedEvent.title}</h3>
                <p className="text-xs text-neutral-500 font-bold">{selectedEvent.venue} • {selectedEvent.date}</p>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select Ticket Tier */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">Chagua Aina ya Tiketi (Tier)</label>
              <div className="space-y-2">
                {selectedEvent.tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTier(t)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      selectedTier?.id === t.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black">{t.name}</span>
                        {t.badge && (
                          <span className="text-[8.5px] bg-amber-400 text-neutral-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-neutral-500 font-medium mt-0.5">
                        {t.perks.join(' • ')}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-orange-600 dark:text-orange-400">
                        TZS {t.price.toLocaleString()}
                      </p>
                      <span className="text-[9px] text-neutral-400 font-bold">{t.remaining} zimebaki</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket Counter */}
            <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-2xl">
              <div>
                <p className="text-xs font-black">Idadi ya Tiketi</p>
                <p className="text-[10px] text-neutral-500">Upeo wa tiketi 10 kwa mara moja</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center font-black active:scale-95 shadow-sm"
                >
                  -
                </button>
                <span className="text-sm font-black w-6 text-center">{ticketCount}</span>
                <button
                  type="button"
                  onClick={() => setTicketCount(Math.min(10, ticketCount + 1))}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center font-black active:scale-95 shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Attendee Details */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Jina la Mmiliki wa Tiketi</label>
                <input
                  type="text"
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  placeholder="Mf. Juma Hamisi"
                  className="w-full mt-1 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Namba ya Simu (Kwa ajili ya SMS/WhatsApp Ticket)</label>
                <input
                  type="tel"
                  value={attendeePhone}
                  onChange={(e) => setAttendeePhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full mt-1 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Total & Checkout button */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase">Jumla Kuu</span>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  TZS {((selectedTier?.price || 0) * ticketCount).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBuyTicket}
                disabled={isCheckingOut}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-600/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isCheckingOut ? (
                  <span>Inatayarisha...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Lipa Papo Hapo</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Ticket Success Confirmation Modal */}
      {confirmedTicket && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-6 max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-3xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
                Malipo Yamethibitishwa
              </span>
              <h3 className="text-xl font-black mt-2">Tiketi Yako ya QR Ipo Tayari!</h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                Tumia QR code hii mlangoni kuingia kwenye {confirmedTicket.eventTitle}.
              </p>
            </div>

            <div className="p-4 bg-neutral-950 text-white rounded-2xl flex flex-col items-center space-y-3">
              <div className="w-28 h-28 bg-white p-2 rounded-2xl flex items-center justify-center">
                <QrCode className="w-full h-full text-black" />
              </div>
              <p className="text-[11px] font-mono text-neutral-400 font-bold">PASS: {confirmedTicket.id}</p>
            </div>

            <button
              onClick={() => {
                setConfirmedTicket(null);
                setActiveTab('my-tickets');
              }}
              className="w-full py-3.5 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider"
            >
              Fungua Tiketi Zangu
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EventsBooking;
