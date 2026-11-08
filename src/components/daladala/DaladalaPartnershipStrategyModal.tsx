import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  Download, 
  Copy, 
  Share2, 
  TrendingUp, 
  Users, 
  Bus, 
  DollarSign, 
  Award, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface DaladalaPartnershipStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DaladalaPartnershipStrategyModal({
  isOpen,
  onClose
}: DaladalaPartnershipStrategyModalProps) {
  const [activeTab, setActiveTab] = useState<'strategy' | 'calculator' | 'proposal'>('strategy');

  // Interactive Live Revenue Calculator State
  const [fleetSize, setFleetSize] = useState<number>(50); // e.g. 50 buses
  const [passengersPerBus, setPassengersPerBus] = useState<number>(380);
  const [avgFare, setAvgFare] = useState<number>(600);
  const [chamaCut, setChamaCut] = useState<number>(15); // TZS 15 per ticket to UWADAR
  const [techCut, setTechCut] = useState<number>(25); // TZS 25 to platform

  // Calculations
  const totalDailyPassengers = fleetSize * passengersPerBus;
  const dailyChamaRevenue = totalDailyPassengers * chamaCut;
  const monthlyChamaRevenue = dailyChamaRevenue * 30;

  const dailyPlatformRevenue = totalDailyPassengers * techCut;
  const monthlyPlatformRevenue = dailyPlatformRevenue * 30;

  const dailyOwnerGross = totalDailyPassengers * (avgFare - chamaCut - techCut);
  const monthlyOwnerGross = dailyOwnerGross * 30;

  const copyProposalToClipboard = () => {
    const proposalText = `# MPANGO MKAKATI NA PROPOSAL RASMI YA USHIRIKIANO
KWA: UONGOZI WA UWADAR NA DARCOBOA
KUTOKA KWA: TIMU YA PAPODALADALA TANZANIA
YAH: MAPENDEKEZO YA USHIRIKIANO WA KIDI JITALI KATIKA UKUSANYAJI WA NAULI, TIKETI ZA KIELEKTRONIKI (E-TICKETING), NA ULINZI WA MAPATO YA WAMILIKI WA DALADALA

1. Lengo: Kuondoa upotevu wa mapato ya wamiliki (20%-35%), kukidhi matakwa ya kisheria ya LATRA ya utoaji tiketi za kielektroniki bila ununuzi wa mashine za POS, na kuondoa kero ya chenji.
2. Mgawanyo wa Kila Tiketi (Nauli TZS 600):
   - Mmiliki wa Basi: TZS 560
   - Chama (UWADAR / DARCOBOA): TZS 15
   - Mfumo wa Teknolojia: TZS 25
3. Mpango wa Majaribio wa Siku 30 na Magari 10 ya Kwanza.
Mfumo unapatikana rasmi kwa ajili ya majaribio kupitia: https://ais-pre-ehp7pgjsv6filel5husmda-79810319892.europe-west2.run.app`;

    navigator.clipboard.writeText(proposalText);
    toast.success("📋 Nakala ya Proposal ya UWADAR imenakiliwa kwenye simu yako!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100050] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        className="w-full sm:max-w-2xl bg-white dark:bg-neutral-900 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-600/30">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  Ubia wa UWADAR & DARCOBOA
                </span>
                <span className="text-[10px] font-mono text-neutral-400">LATRA Ready</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tight mt-0.5">
                PapoDaladala – Mkakati wa Kuingia Sokoni
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 pt-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('strategy')}
            className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'strategy'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-neutral-200 dark:border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Mpango wa Hatua 5</span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'calculator'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-neutral-200 dark:border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Kikokotoo cha Mapato</span>
          </button>

          <button
            onClick={() => setActiveTab('proposal')}
            className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'proposal'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-neutral-200 dark:border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Barua ya Proposal</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-neutral-800 dark:text-neutral-200">
          {/* TAB 1: 5-STEP STRATEGY */}
          {activeTab === 'strategy' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-blue-600/10 border border-emerald-500/20 text-xs">
                <p className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Mpango Mkakati wa Kuifanya PapoDaladala Ijulikane na Kutumika
                </p>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                  Mkakati huu unaunganisha vyama vya wamiliki (UWADAR, DARCOBOA), udhibiti wa serikali (LATRA), na kundi la kwanza la wamiliki na abiria.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-white dark:bg-neutral-800/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      1
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 dark:text-white">
                      Kutambulisha Mradi kwa UWADAR & DARCOBOA
                    </h4>
                  </div>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">Wiki ya 1-2</span>
                </div>
                <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 pl-8 leading-relaxed">
                  Peleka <strong>Proposal Rasmi</strong> kwenye ofisi za UWADAR na DARCOBOA (au kwa Wenyeviti wa Ruti stendi). Waonyeshe jinsi chama kinavyopata <strong>TZS 15 kwa kila tiketi</strong> bila haja ya vijana kukimbizana na makonda stendi, na bila wamiliki kununua mashine ghali za POS.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-white dark:bg-neutral-800/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 dark:text-white">
                      Kupata Wamiliki: Magari 10 ya Majaribio (Siku 30)
                    </h4>
                  </div>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Siku 30</span>
                </div>
                <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 pl-8 leading-relaxed">
                  Chagua wamiliki 3 hadi 5 wenye ushawishi. Weka mfumo kwenye <strong>magari yao 10</strong>. Mmiliki anaona live hesabu ya gari lake kwenye simu yake. Akiona mapato ya gari yameongezeka kwa TZS 20,000–30,000 kila siku bila udanganyifu wa konda, yeye mwenyewe atakuwa balozi wa kuwashawishi wengine.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-white dark:bg-neutral-800/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      3
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 dark:text-white">
                      Kupata Abiria: Anza na Njia Moja Mahususi
                    </h4>
                  </div>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">Uzoefu wa Njia</span>
                </div>
                <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 pl-8 leading-relaxed">
                  Anza na ruti moja yenye abiria wengi (mfano: <strong>Makumbusho ➔ Posta</strong> au <strong>Mwenge ➔ Simu 2000</strong>). Bandika stika za QR kwenye milango: <em>"Lipa Hapa kwa Simu – Hakuna Kero ya Chenji"</em>. Abiria wakiona basi lilipo na kulipa kwa urahisi, habari zitaenea kwa kasi ya mdomo (*Word of Mouth*).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-white dark:bg-neutral-800/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      4
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 dark:text-white">
                      Uwasilishaji Serikalini (LATRA)
                    </h4>
                  </div>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">LATRA Compliance</span>
                </div>
                <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 pl-8 leading-relaxed">
                  Mkiwa na viongozi wa UWADAR na matokeo halisi ya siku 30 za magari 10, omba kikao na <strong>LATRA</strong>. Onyesha jinsi mfumo unavyotoa tiketi za kielektroniki, kuzuia nauli holela, kutoa takwimu sahihi za abiria, na kubana bando la simu bila kuitaji serikali kutumia bajeti yoyote.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 bg-white dark:bg-neutral-800/40 transition-all space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      5
                    </span>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-900 dark:text-white">
                      Kupanua Huduma Jiji Zima la Dar es Salaam
                    </h4>
                  </div>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Rollout Kamili</span>
                </div>
                <p className="text-[11.5px] text-neutral-600 dark:text-neutral-400 pl-8 leading-relaxed">
                  Baada ya ridhaa ya LATRA na ushirikiano wa UWADAR, panua mfumo kwenye ruti zote kuu: Gongo la Mboto, Kariakoo, Mbezi, Tegeta, Kigamboni, na Kimara.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE REVENUE CALCULATOR */}
          {activeTab === 'calculator' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300">
                  Simulizi ya Pesa Halisi (Interactive Revenue Simulator)
                </h4>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Sogeza vitelezi kuona jinsi wewe, UWADAR na wamiliki mnavyotengeneza mamilioni ya pesa kila mwezi:
                </p>
              </div>

              {/* Sliders */}
              <div className="space-y-3 bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Idadi ya Magari ya Daladala:</span>
                    <span className="text-emerald-600 font-mono text-sm">{fleetSize} Magari</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={fleetSize}
                    onChange={(e) => setFleetSize(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Wastani wa Abiria kwa Basi 1 (Siku):</span>
                    <span className="text-blue-600 font-mono text-sm">{passengersPerBus} Abiria</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    step="20"
                    value={passengersPerBus}
                    onChange={(e) => setPassengersPerBus(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Mgao wa Chama UWADAR (kwa Kila Tiketi):</span>
                    <span className="text-amber-600 font-mono text-sm">TZS {chamaCut}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    step="5"
                    value={chamaCut}
                    onChange={(e) => setChamaCut(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Revenue Results Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* UWADAR Revenue */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block">
                    Mapato ya UWADAR / DARCOBOA
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                      TZS {dailyChamaRevenue.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-neutral-500">/ siku</span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    TZS {monthlyChamaRevenue.toLocaleString()} kwa mwezi!
                  </p>
                </div>

                {/* Platform (Your) Revenue */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block">
                    Mapato Yako ya Mfumo (Technology Fee)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      TZS {dailyPlatformRevenue.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-neutral-500">/ siku</span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    TZS {monthlyPlatformRevenue.toLocaleString()} kwa mwezi!
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                <span>Jumla ya Tiketi Zilizokatwa:</span>
                <strong className="text-neutral-900 dark:text-white font-mono">
                  {totalDailyPassengers.toLocaleString()} tiketi / siku ({ (totalDailyPassengers * 30).toLocaleString()} / mwezi)
                </strong>
              </div>
            </div>
          )}

          {/* TAB 3: OFFICIAL PROPOSAL TEXT */}
          {activeTab === 'proposal' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Nyaraka Rasmi ya Proposal:
                </span>
                <button
                  onClick={copyProposalToClipboard}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nakili Proposal Yote</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-[11.5px] font-mono leading-relaxed max-h-[50vh] overflow-y-auto space-y-3">
                <p className="font-bold text-neutral-900 dark:text-white">
                  KWA: UONGOZI WA UWADAR NA DARCOBOA<br />
                  DAR ES SALAAM, TANZANIA
                </p>
                <p>
                  <strong>YAH:</strong> MAPENDEKEZO YA USHIRIKIANO WA KIDI JITALI KATIKA UKUSANYAJI WA NAULI, TIKETI ZA KIELEKTRONIKI (E-TICKETING), NA ULINZI WA MAPATO YA WAMILIKI WA DALADALA
                </p>
                <p>
                  <strong>1. Changamoto Inayotatuliwa:</strong><br />
                  - Kuondoa upotevu wa 20% hadi 35% wa hesabu ya wamiliki kutokana na udanganyifu.<br />
                  - Kukidhi matakwa ya kisheria ya LATRA ya utoaji tiketi za kielektroniki bila kulazimika kununua mashine ghali za POS (simu ya konda inatosha).<br />
                  - Kuondoa kero ya chenji kwa abiria.
                </p>
                <p>
                  <strong>2. Mfumo wa Mgawanyo wa Kila Tiketi (Nauli TZS 600):</strong><br />
                  - Mmiliki wa Basi: TZS 560 (Hesabu safi inaingia moja kwa moja kwenye simu/benki yake).<br />
                  - UWADAR / DARCOBOA: TZS 15 (Ada ya chama inakatwa kidijitali bila vijana kupigana stendi).<br />
                  - Mfumo wa PapoDaladala: TZS 25 (Uendeshaji wa mfumo na huduma za teknolojia).
                </p>
                <p>
                  <strong>3. Mpango wa Majaribio wa Siku 30:</strong><br />
                  Tunapendekeza kuanza na magari 10 ya wanachama wenu kwenye njia moja teule (mfano Mwenge ➔ Posta). Mfumo utaonyesha ongezeko la mapato kwa vitendo kabla ya kusajili magari mengine.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 flex items-center justify-between gap-3">
          <button
            onClick={copyProposalToClipboard}
            className="py-2.5 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>Nakili Proposal</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-95"
          >
            Funga & Anza Utekelezaji
          </button>
        </div>
      </motion.div>
    </div>
  );
}
