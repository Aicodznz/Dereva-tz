import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  PieChart, 
  PackageCheck, 
  Flame, 
  AlertTriangle, 
  Lightbulb, 
  Clock, 
  X, 
  Send, 
  Loader2, 
  RefreshCw, 
  Coins, 
  Store, 
  ChefHat,
  Bus,
  Hotel,
  Pill,
  Scissors,
  ShoppingCart,
  Key,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorProfile, Product, Order, AiSalesInsightReport } from '../types';

interface AiSalesInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorProfile;
  products: Product[];
  orders: Order[];
  expenses: any[];
}

export const AiSalesInsightsModal: React.FC<AiSalesInsightsModalProps> = ({
  isOpen,
  onClose,
  vendor,
  products,
  orders,
  expenses
}) => {
  const [report, setReport] = useState<AiSalesInsightReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'cogs' | 'ask'>('overview');
  const [customQuestion, setCustomQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  // Smart Service Type Detection
  const rawCat = (vendor?.category || '').toLowerCase();
  const rawName = (vendor?.businessName || '').toLowerCase();
  const isBus = rawCat === 'bus_ticket' || rawCat.includes('bus') || rawName.includes('bus') || rawName.includes('coach') || rawName.includes('safari') || rawName.includes('trans');
  const isHotel = rawCat === 'hotel' || rawCat.includes('stay') || rawCat.includes('lodge') || rawName.includes('hotel') || rawName.includes('lodge');
  const isPharmacy = rawCat === 'pharmacy' || rawCat.includes('pharma') || rawCat.includes('dawa') || rawName.includes('pharmacy') || rawName.includes('dawa');
  const isSalon = rawCat === 'salon' || rawCat.includes('style') || rawName.includes('salon') || rawName.includes('kinyozi');
  const isCarRental = rawCat === 'car_rental' || rawName.includes('rental') || rawName.includes('rent a car');
  const isGrocery = rawCat === 'grocery' || rawCat.includes('mart') || rawCat.includes('soko') || rawName.includes('mart');
  const isRestaurant = !isBus && !isHotel && !isPharmacy && !isSalon && !isCarRental && !isGrocery;

  // Dynamic Service-Specific Labels & Icon
  const serviceMeta = (() => {
    if (isBus) {
      return {
        icon: Bus,
        title: "AI PapoBus Transit & Route Intelligence",
        badge: "PapoBus Fleet AI",
        subtitle: `${vendor?.businessName} • Uchambuzi wa Njia, Viti Vilivyolipiwa (Load Factor), na Faida ya Safari`,
        loadingText: `Gemini AI inachambua njia za mabasi na ukataji wa tiketi za ${vendor?.businessName || 'PapoBus'}...`,
        loadingSub: "Inapiga mahesabu ya njia zinazoongoza kwa abiria, faida ya safari, na mahitaji ya mabasi wikendi hii.",
        tab2Label: "Utabiri wa Viti & Njia",
        tab3Label: "Faida ya Safari & Mafuta",
        tab4Label: "Uliza AI Kuhusu Mabasi",
        topHeader: "Njia Zinazoongoza kwa Abiria (Top Routes)",
        topBadge: "High Occupancy",
        slowHeader: "Njia Zenye Abiria Wachache (Low Load Factor)",
        tab2BannerTitle: "🚌 Utabiri wa Viti vya Mabasi & Mahitaji ya Abiria",
        tab2BannerSub: "Gemini AI inakadiria njia zenye msongamano wa abiria ili kuongeza basi au kurekebisha ratiba za asubuhi na sikukuu.",
        tab3CogsTitle: "Gharama za Safari (Fuel & Transit OpEx)",
        tab3ProfitAdviceTitle: "Mbinu za Kudhibiti Mafuta & Kuongeza Faida ya Mabasi",
        askTitle: "💬 Uliza Chochote Kuhusu Ratiba & Mabasi Yako",
        askSub: "Unaweza kuuliza: 'Je, niongeze basi la ziada njia ya Dar - Mwanza Ijumaa hii?' au 'Je, niongeze nauli ya VIP kwa safari za asubuhi?'",
        askBtn: "Tuma Swali kwa AI PapoBus"
      };
    }
    if (isHotel) {
      return {
        icon: Hotel,
        title: "AI PapoStay Hospitality Intelligence",
        badge: "PapoStay Hotel AI",
        subtitle: `${vendor?.businessName} • Uchambuzi wa Uhifadhi wa Vyumba, Occupancy Rate, na Mapato ya Wageni`,
        loadingText: `Gemini AI inachambua vyumba na uhifadhi wa ${vendor?.businessName || 'Hoteli'}...`,
        loadingSub: "Inapiga mahesabu ya vyumba vinavyopangishwa zaidi, bei bora za misimu, na maandalizi ya wageni.",
        tab2Label: "Utabiri wa Vyumba & Wageni",
        tab3Label: "Faida ya Vyumba & RevPAR",
        tab4Label: "Uliza AI Kuhusu Hoteli",
        topHeader: "Vyumba Vinavyopendwa Zaidi (Top Booked Rooms)",
        topBadge: "High Demand",
        slowHeader: "Vyumba Vilivyokosa Wageni (Low Occupancy)",
        tab2BannerTitle: "🏨 Utabiri wa Vyumba & Maandalizi ya Wageni",
        tab2BannerSub: "Gemini AI inakadiria mahitaji ya vyumba kwa wikendi na mikutano ili wafanyakazi waandae vyumba mapema.",
        tab3CogsTitle: "Gharama za Uendeshaji wa Hoteli",
        tab3ProfitAdviceTitle: "Mbinu za Kupunguza Gharama za Vyumba & Kuongeza Faida",
        askTitle: "💬 Uliza Chochote Kuhusu Hoteli Yako",
        askSub: "Unaweza kuuliza: 'Je, niweke punguzo kwa wageni wanaokaa zaidi ya siku 3?' au 'Msimu wa mikutano unakuja, nirekebishe vipi bei za VIP suites?'",
        askBtn: "Tuma Swali kwa AI PapoStay"
      };
    }
    if (isPharmacy) {
      return {
        icon: Pill,
        title: "AI PapoPharmacy Clinical Intelligence",
        badge: "PapoPharmacy Clinical AI",
        subtitle: `${vendor?.businessName} • Uchambuzi wa Dawa, Maagizo ya Wagonjwa (Rx), na Tarehe za Kuisha`,
        loadingText: `Gemini AI inachambua dawa na maagizo ya ${vendor?.businessName || 'Pharmacy'}...`,
        loadingSub: "Inapiga mahesabu ya dawa zinazotakiwa kuagizwa haraka na kuzuia upotevu wa dawa kuisha muda wake.",
        tab2Label: "Utabiri wa Dawa & Stoo",
        tab3Label: "Faida ya Dawa & Jumla",
        tab4Label: "Uliza AI Kuhusu Dawa",
        topHeader: "Dawa Zinazoagizwa Zaidi (Top Dispensed)",
        topBadge: "High Dispense",
        slowHeader: "Dawa Zinazotembea Taratibu (Slow Moving Drugs)",
        tab2BannerTitle: "💊 Utabiri wa Dawa Zinazohitajika Stoo",
        tab2BannerSub: "Gemini AI inakadiria dawa muhimu zinazoelekea kuisha ili kuziagiza kabla hazijakosekana kwa wagonjwa.",
        tab3CogsTitle: "Gharama za Ununuzi wa Dawa (Wholesale)",
        tab3ProfitAdviceTitle: "Mbinu za Kudhibiti Stoo ya Dawa & Bei za Jumla",
        askTitle: "💬 Uliza Chochote Kuhusu Duka Lako la Dawa",
        askSub: "Unaweza kuuliza: 'Je, niweke ofa ya dawa za watoto msimu huu wa mvua?' au 'Ni dawa gani ninunue kwa wingi ili nipate punguzo?'",
        askBtn: "Tuma Swali kwa AI PapoPharmacy"
      };
    }
    if (isSalon) {
      return {
        icon: Scissors,
        title: "AI PapoStyle Beauty Intelligence",
        badge: "PapoStyle Salon AI",
        subtitle: `${vendor?.businessName} • Uchambuzi wa Mitindo, Ratiba za Wateja, na Mapato ya Saluni`,
        loadingText: `Gemini AI inachambua huduma na ratiba za ${vendor?.businessName || 'Saluni'}...`,
        loadingSub: "Inapiga mahesabu ya mitindo inayopendwa na maandalizi ya wateja wa wikendi.",
        tab2Label: "Utabiri wa Nafasi & Wateja",
        tab3Label: "Faida ya Huduma za Saluni",
        tab4Label: "Uliza AI Kuhusu Saluni",
        topHeader: "Huduma Zinazoongoza (Top Treatments)",
        topBadge: "Popular",
        slowHeader: "Huduma Zinazopata Wateja Wachache",
        tab2BannerTitle: "✂️ Utabiri wa Wateja wa Wikendi",
        tab2BannerSub: "Gemini AI inakadiria saa zenye wateja wengi ili kupanga mafundi na bidhaa mapema.",
        tab3CogsTitle: "Gharama za Vifaa & Bidhaa za Urembo",
        tab3ProfitAdviceTitle: "Mbinu za Kuongeza Wateja wa Kujirudia (Client Retention)",
        askTitle: "💬 Uliza Chochote Kuhusu Saluni Yako",
        askSub: "Unaweza kuuliza: 'Je, nianzishe kifurushi cha Harusi?' au 'Wateja wanakuja wengi siku gani zaidi?'",
        askBtn: "Tuma Swali kwa AI PapoStyle"
      };
    }
    if (isGrocery) {
      return {
        icon: ShoppingCart,
        title: "AI PapoMart Retail & Soko Intelligence",
        badge: "PapoMart Retail AI",
        subtitle: `${vendor?.businessName} • Uchambuzi wa Mauzo ya Sokoni, Vyakula Vibichi, na Rafu za Bidhaa`,
        loadingText: `Gemini AI inachambua bidhaa na mauzo ya ${vendor?.businessName || 'Duka la Sokoni'}...`,
        loadingSub: "Inapiga mahesabu ya bidhaa zinazotembea haraka na kuzuia hasara ya vyakula vibichi.",
        tab2Label: "Utabiri wa Stoo & Bidhaa",
        tab3Label: "Faida & COGS ya Rejareja",
        tab4Label: "Uliza AI Kuhusu Soko Lako",
        topHeader: "Bidhaa Zinazouza Zaidi (Fast-Moving Items)",
        topBadge: "Fast Mover",
        slowHeader: "Bidhaa Zinazokaa Sana Kwenye Rafu",
        tab2BannerTitle: "🛒 Utabiri wa Bidhaa za Kuagiza Sokoni",
        tab2BannerSub: "Gemini AI inakadiria bidhaa zinazohitajika wikendi hii ili rafu zako zisiwe tupu.",
        tab3CogsTitle: "Gharama za Ununuzi wa Bidhaa (Wholesale)",
        tab3ProfitAdviceTitle: "Mbinu za Kupunguza Upotevu & Kuongeza Faida",
        askTitle: "💬 Uliza Chochote Kuhusu Soko Lako",
        askSub: "Unaweza kuuliza: 'Je, nipunguze bei ya bidhaa zinazokaribia kuisha muda?' au 'Ni bidhaa gani zinauza zaidi wiki hii?'",
        askBtn: "Tuma Swali kwa AI PapoMart"
      };
    }
    // Default: Restaurant / PapoFood
    return {
      icon: ChefHat,
      title: "AI PapoFood Chef & Menu Intelligence",
      badge: "PapoFood Chef AI",
      subtitle: `${vendor?.businessName} • Uchambuzi wa Faida, Gharama (COGS), na Utabiri wa Stoo ya Jikoni`,
      loadingText: `Gemini AI inachambua takwimu za ${vendor?.businessName || 'Mgahawa'}...`,
      loadingSub: "Inapiga mahesabu ya vyakula vinavyonunuliwa zaidi, faida halisi (Gross Margins), na viungo vinavyohitajika wikendi hii.",
      tab2Label: "Utabiri wa Stoo & Viungo",
      tab3Label: "Faida & COGS Margin",
      tab4Label: "Uliza AI Kuhusu Jiko Lako",
      topHeader: "Vyakula Vinavyoongoza (Top Sellers)",
      topBadge: "High Demand",
      slowHeader: "Vyakula Vinavyosua-sua (Slow Movers)",
      tab2BannerTitle: "📦 Utabiri wa Stoo & Maandalizi (Smart Prep Forecast)",
      tab2BannerSub: "Gemini AI inakadiria viungo unavyotakiwa kuagiza sokoni kulingana na kasi ya maagizo ya siku za nyuma ili chakula kisikate ghafla au kisiwe na hasara ya kuharibika.",
      tab3CogsTitle: "Gharama ya Viungo (Food Cost / COGS)",
      tab3ProfitAdviceTitle: "Mbinu za Kupunguza Gharama & Kuongeza Faida ya Jikoni",
      askTitle: "💬 Uliza Chochote Kuhusu Mgahawa Wako",
      askSub: "Unaweza kuuliza: 'Je, nipunguze bei ya mishkaki au niongeze ofa ya soda?' au 'Msimu wa sikukuu unakuja, niongeze vyakula gani vipya?'",
      askBtn: "Tuma Swali kwa AI PapoFood Chef"
    };
  })();

  const ServiceIcon = serviceMeta.icon;

  const fetchInsights = async (question?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/sales-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: vendor?.businessName,
          category: isBus ? 'bus_ticket' : isHotel ? 'hotel' : isPharmacy ? 'pharmacy' : isSalon ? 'salon' : isGrocery ? 'grocery' : (vendor?.category || 'restaurant'),
          products: products.map(p => ({
            name: p.name,
            price: p.price,
            costPrice: p.costPrice || (p as any).cost || Math.round(p.price * 0.45),
            category: p.category,
            stock: p.stock,
            departureTime: (p as any).departureTime,
            origin: (p as any).origin,
            destination: (p as any).destination
          })),
          orders: orders.map(o => ({
            totalAmount: o.totalAmount,
            items: o.items,
            status: o.status,
            createdAt: o.createdAt,
            selectedSeats: (o as any).selectedSeats,
            busRoute: (o as any).busRoute
          })),
          expenses: expenses,
          customQuestion: question || undefined
        })
      });

      const data = await res.json();
      if (data.report) {
        setReport(data.report);
      } else {
        toast.error(data.error || 'Imeshindwa kupata taarifa za AI.');
      }
    } catch (err: any) {
      console.error('AI Insights fetch error:', err);
      toast.error('Hitilafu ya mtandao wakati wa kuwasiliana na Gemini AI.');
    } finally {
      setIsLoading(false);
      setIsAsking(false);
    }
  };

  useEffect(() => {
    if (isOpen && !report && !isLoading) {
      fetchInsights();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    setIsAsking(true);
    fetchInsights(customQuestion.trim());
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-neutral-950 border border-amber-500/40 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative text-white max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-black font-black shadow-lg shadow-orange-950/40">
              <ServiceIcon className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  {serviceMeta.title}
                </h3>
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-[9px] uppercase px-2">
                  {serviceMeta.badge}
                </Badge>
              </div>
              <p className="text-xs text-neutral-400 font-medium">
                {serviceMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchInsights()}
              disabled={isLoading}
              className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Refresh Insights"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex bg-neutral-900/90 p-1.5 rounded-2xl border border-neutral-800 my-3 gap-1 shrink-0 overflow-x-auto no-scrollbar relative z-10">
          {[
            { id: 'overview', label: 'Muhtasari wa Mauzo', icon: TrendingUp },
            { id: 'inventory', label: serviceMeta.tab2Label, icon: PackageCheck },
            { id: 'cogs', label: serviceMeta.tab3Label, icon: Coins },
            { id: 'ask', label: serviceMeta.tab4Label, icon: Sparkles },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar relative z-10">
          {isLoading && !report ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-sm font-black uppercase text-amber-300">
                {serviceMeta.loadingText}
              </p>
              <p className="text-xs text-neutral-400 max-w-sm">
                {serviceMeta.loadingSub}
              </p>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Executive Summary Card */}
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/40 via-neutral-900 to-neutral-950 border border-amber-500/40 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Ripoti ya AI Executive
                      </span>
                      <div className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 text-amber-300 text-xs font-black">
                        <span>Afya ya Biashara:</span>
                        <strong className="text-white">{report.salesHealthScore || 88}/100</strong>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-medium">
                      "{report.executiveSummary}"
                    </p>
                  </div>

                  {/* Top Performers & Slow Movers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Top offerings */}
                    <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> {serviceMeta.topHeader}
                        </span>
                        <Badge className="bg-emerald-500 text-black font-black text-[9px]">{serviceMeta.topBadge}</Badge>
                      </div>

                      {report.topPerformers?.length > 0 ? (
                        <div className="space-y-2">
                          {report.topPerformers.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20 text-xs">
                              <div className="flex justify-between font-bold text-white">
                                <span>{item.name}</span>
                                <span className="text-emerald-400">{item.salesCount ? `${item.salesCount} ${isBus ? 'Tiketi' : 'Oda'}` : 'Top Choice'}</span>
                              </div>
                              <p className="text-[10px] text-neutral-400 mt-0.5">{item.insight}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">Takwimu zinaendelea kukusanywa...</p>
                      )}
                    </div>

                    {/* Slow Movers */}
                    <div className="p-4 rounded-2xl bg-neutral-900/80 border border-rose-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> {serviceMeta.slowHeader}
                        </span>
                        <Badge className="bg-rose-500 text-white font-black text-[9px]">Needs Promo</Badge>
                      </div>

                      {report.slowMovers?.length > 0 ? (
                        <div className="space-y-2">
                          {report.slowMovers.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-rose-500/20 text-xs">
                              <p className="font-bold text-white">{item.name}</p>
                              <p className="text-[10px] text-rose-200 mt-0.5">💡 Ushauri: {item.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">Hakuna sehemu iliyokwama kwa sasa.</p>
                      )}
                    </div>
                  </div>

                  {/* Actionable Tips */}
                  {report.marketingActionTips?.length > 0 && (
                    <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> Mbinu 3 za Kuongeza Mapato Leo:
                      </span>
                      <div className="space-y-1.5">
                        {report.marketingActionTips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INVENTORY & STOCK FORECAST */}
              {activeTab === 'inventory' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-neutral-900 to-neutral-950 border border-blue-500/40">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
                      {serviceMeta.tab2BannerTitle}
                    </span>
                    <p className="text-xs text-neutral-300">
                      {serviceMeta.tab2BannerSub}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.inventoryForecast?.map((item, idx) => {
                      const isIncrease = item.action === 'increase_stock';
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-2xl border flex flex-col justify-between gap-2.5 ${
                            isIncrease 
                              ? 'bg-amber-950/30 border-amber-500/40' 
                              : 'bg-neutral-900/60 border-neutral-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase text-white">{item.ingredientOrItem}</span>
                              <Badge className={isIncrease ? 'bg-amber-500 text-black font-black text-[9px]' : 'bg-neutral-700 text-white text-[9px]'}>
                                {isIncrease ? `📈 Ongeza ${isBus ? 'Viti / Basi' : 'Stoo'}` : 'Tulia / Dumisha'}
                              </Badge>
                            </div>
                            <p className="text-xs font-bold text-amber-300 mt-1">
                              👉 {item.quantityRecommendation}
                            </p>
                          </div>
                          <p className="text-[10px] text-neutral-400 bg-black/40 p-2 rounded-xl border border-white/5">
                            {item.reasoning}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {report.peakHoursAdvice && (
                    <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                          Ushauri wa Masaa ya Msongamano Mkubwa (Peak Hours & Schedule):
                        </span>
                        <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                          {report.peakHoursAdvice}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: COGS & GROSS PROFIT MARGIN */}
              {activeTab === 'cogs' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                      <span className="text-[10px] font-black uppercase text-neutral-400 block">Jumla ya Mapato</span>
                      <p className="text-base font-black text-white mt-1">
                        TZS {report.cogsAndProfitAnalysis?.estimatedRevenue?.toLocaleString() || '0'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center">
                      <span className="text-[10px] font-black uppercase text-neutral-400 block">{serviceMeta.tab3CogsTitle}</span>
                      <p className="text-base font-black text-rose-400 mt-1">
                        TZS {report.cogsAndProfitAnalysis?.estimatedCogs?.toLocaleString() || '0'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-neutral-900 border border-emerald-500/50 text-center">
                      <span className="text-[10px] font-black uppercase text-emerald-300 block">Faida Halisi (Gross Margin)</span>
                      <p className="text-lg font-black text-emerald-400 mt-1">
                        {report.cogsAndProfitAnalysis?.grossProfitMarginPercent || 58}%
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-neutral-900/90 border border-emerald-500/40 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Coins className="w-4 h-4" /> {serviceMeta.tab3ProfitAdviceTitle}
                    </span>
                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                      "{report.cogsAndProfitAnalysis?.profitAdvice || 'Weka mpango mzuri wa uendeshaji ili kupunguza gharama zisizo za lazima na kuongeza faida.'}"
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: ASK AI QUESTION */}
              {activeTab === 'ask' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-neutral-900 to-neutral-950 border border-purple-500/40">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block mb-1">
                      {serviceMeta.askTitle}
                    </span>
                    <p className="text-xs text-neutral-300">
                      {serviceMeta.askSub}
                    </p>
                  </div>

                  <form onSubmit={handleAskQuestion} className="space-y-3">
                    <textarea
                      rows={3}
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="Andika swali lako hapa kwa Kiswahili au Kiingereza..."
                      className="w-full bg-black/60 border border-neutral-800 focus:border-amber-500 p-3.5 rounded-2xl text-white text-xs placeholder:text-neutral-600 focus:outline-none resize-none transition-all"
                    />

                    <Button
                      type="submit"
                      disabled={isAsking || !customQuestion.trim()}
                      className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-black font-black uppercase text-xs rounded-2xl shadow-xl shadow-orange-950/40 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isAsking ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          Gemini AI inafikiria jibu...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black" />
                          {serviceMeta.askBtn}
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};
