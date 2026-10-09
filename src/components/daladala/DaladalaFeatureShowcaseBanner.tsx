import React, { useState } from 'react';
import { 
  Gauge, 
  Share2, 
  Volume2, 
  Radio, 
  Building2, 
  Sparkles, 
  ChevronRight, 
  AlertTriangle, 
  Play, 
  CheckCircle2, 
  Car, 
  MapPin, 
  FileText,
  ShieldAlert,
  GraduationCap,
  Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  announceNextStation, 
  announceArrivalAtStation, 
  announceSpeedLimitExceeded, 
  playTransitChime, 
  speakKiswahili 
} from '../../utils/daladalaAudioVoice';

interface DaladalaFeatureShowcaseBannerProps {
  onOpenDriverMode: () => void;
  onOpenDailyReport: () => void;
  onOpenConductorMode: () => void;
  onOpenFleetMode: () => void;
  onOpenSafetyModal?: () => void;
  onOpenStudentFareModal?: () => void;
}

export default function DaladalaFeatureShowcaseBanner({
  onOpenDriverMode,
  onOpenDailyReport,
  onOpenConductorMode,
  onOpenFleetMode,
  onOpenSafetyModal,
  onOpenStudentFareModal,
}: DaladalaFeatureShowcaseBannerProps) {
  const navigate = useNavigate();
  const [activeVoiceStation, setActiveVoiceStation] = useState<string | null>(null);
  const [showVoicePlayer, setShowVoicePlayer] = useState<boolean>(false);

  const sampleVoiceStations = [
    { name: 'Mwenge', alightCount: 6, text: 'Kituo kinachofuata ni Mwenge! Abiria wa Mwenge jiandaeni kushuka.' },
    { name: 'Ubungo Maji', alightCount: 4, text: 'Kituo kinachofuata ni Ubungo Maji! Abiria wa Ubungo jiandaeni kushuka.' },
    { name: 'Morocco', alightCount: 3, text: 'Kituo kinachofuata ni Morocco! Abiria wa Morocco jiandaeni kushuka.' },
    { name: 'Kariakoo Gerezani', alightCount: 14, text: 'Kituo cha mwisho ni Kariakoo Gerezani! Abiria wote mnakumbushwa kuteremka salama.' },
  ];

  const handlePlayVoice = (stationName: string, alightCount: number) => {
    setActiveVoiceStation(stationName);
    announceNextStation(stationName, alightCount);
    toast.success(`🔊 Sauti: "Kituo kinachofuata ni ${stationName}..."`);
    setTimeout(() => {
      setActiveVoiceStation(null);
    }, 4000);
  };

  const handlePlaySpeedAlert = () => {
    announceSpeedLimitExceeded(62, 50);
    toast.error('🚨 Sauti: "Tahadhari! Umezidisha spidi ya LATRA. Punguza mwendo!"');
  };

  const handlePlayChimeOnly = () => {
    playTransitChime();
    toast.info('🔔 Chime ya stendi (Ding-Dong)');
  };

  return (
    <div className="w-full bg-gradient-to-br from-neutral-900 via-neutral-900 to-blue-950 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-neutral-800 space-y-4">
      {/* Header section with quick overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-neutral-950 font-black shadow-md">
            <Sparkles className="w-5 h-5 text-neutral-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                Huduma Mpya Zilizoongezwa Kwenye Mfumo
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase">
                LIVE & TAYARI
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Skrini ya Dereva, Ripoti ya Hesabu ya Tajiri (WhatsApp), na Sauti za Vituo za Kiswahili
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onOpenStudentFareModal && (
            <button
              type="button"
              onClick={onOpenStudentFareModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Wanafunzi &amp; Watoto 🎒 (TSh 200)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/papopay?tab=transit')}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-md"
          >
            <Wallet className="w-4 h-4 text-white" />
            <span>Lipa Nauli PapoPay 💳</span>
          </button>

          {onOpenSafetyModal && (
            <button
              type="button"
              onClick={onOpenSafetyModal}
              className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Kinga ya Watekaji 🛡️</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowVoicePlayer(!showVoicePlayer)}
            className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
          >
            <Volume2 className="w-4 h-4 text-blue-400" />
            <span>{showVoicePlayer ? 'Ficha Kisanduku cha Sauti' : 'Jaribu Sauti 🔊'}</span>
          </button>
        </div>
      </div>

      {/* 4 Feature Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* 1. SKRINI MAALUM YA DEREVA (HUD COCKPIT) */}
        <div 
          onClick={onOpenDriverMode}
          className="group cursor-pointer p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-amber-500/50 transition-all duration-200 shadow-md flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-neutral-950 transition">
                <Gauge className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 font-black text-[9px] uppercase">
                HUD ya Dereva
              </span>
            </div>
            <div>
              <h3 className="font-black text-sm text-white group-hover:text-amber-400 transition flex items-center gap-1">
                Skrini ya Dereva
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 transition" />
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Speedometer kubwa ya LATRA (50 km/h), kituo kinachofuata, abiria wanaoshuka, na kitufe cha dharura.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-700/60 flex items-center justify-between text-xs font-black text-amber-400">
            <span>Fungua Cockpit HUD</span>
            <span className="text-neutral-500 text-[10px]">Mbofyo 1</span>
          </div>
        </div>

        {/* 2. RIPOTI YA HESABU YA TAJIRI (WHATSAPP SUMMARY) */}
        <div 
          onClick={onOpenDailyReport}
          className="group cursor-pointer p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-emerald-500/50 transition-all duration-200 shadow-md flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-neutral-950 transition">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 font-black text-[9px] uppercase">
                WhatsApp PDF
              </span>
            </div>
            <div>
              <h3 className="font-black text-sm text-white group-hover:text-emerald-400 transition flex items-center gap-1">
                Hesabu ya Tajiri
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 transition" />
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Muhtasari wa fedha wa siku: Cash, Simu, mafuta, ushuru na faida halisi. Tuma WhatsApp kwa sekunde 1!
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-700/60 flex items-center justify-between text-xs font-black text-emerald-400">
            <span>Tuma Ripoti WhatsApp</span>
            <span className="text-neutral-500 text-[10px]">TSh Hesabu</span>
          </div>
        </div>

        {/* 3. SAUTI ZA VITUO ZA KISWAHILI */}
        <div 
          onClick={() => setShowVoicePlayer(prev => !prev)}
          className="group cursor-pointer p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-blue-500/50 transition-all duration-200 shadow-md flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition">
                <Volume2 className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-300 border border-blue-400/30 font-black text-[9px] uppercase">
                Voice GPS
              </span>
            </div>
            <div>
              <h3 className="font-black text-sm text-white group-hover:text-blue-400 transition flex items-center gap-1">
                Sauti za Kiswahili
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 transition" />
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Chime ya stendi na matamshi: &ldquo;Kituo kinachofuata ni Mwenge! Abiria wa Mwenge jiandaeni kushuka.&rdquo;
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-700/60 flex items-center justify-between text-xs font-black text-blue-400">
            <span>{showVoicePlayer ? 'Funga Sauti' : 'Jaribu Kusikiliza'}</span>
            <span className="text-neutral-500 text-[10px]">Audio Demo</span>
          </div>
        </div>

        {/* 4. HALI YA KONDAKTA & MMILIKI */}
        <div 
          onClick={onOpenConductorMode}
          className="group cursor-pointer p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 hover:border-purple-500/50 transition-all duration-200 shadow-md flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition">
                <Radio className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-300 border border-purple-400/30 font-black text-[9px] uppercase">
                Konda & Tajiri
              </span>
            </div>
            <div>
              <h3 className="font-black text-sm text-white group-hover:text-purple-400 transition flex items-center gap-1">
                Konda & Meli ya Magari
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 transition" />
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Mpangilio wa viti (30/30), kikokotoo cha chenji, tiketi za M-Pesa, na dasibodi ya mmiliki wa gari.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-neutral-700/60 flex items-center justify-between text-xs font-black text-purple-400">
            <span>Fungua Konda</span>
            <span className="text-neutral-500 text-[10px]">Viti & Tiketi</span>
          </div>
        </div>

      </div>

      {/* Interactive Voice Player Drawer (shown when user wants to hear sample Swahili station announcements) */}
      {showVoicePlayer && (
        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">
                Jaribu Sauti za Kiswahili za Vituo na Tahadhari za Spidi
              </h4>
            </div>
            <button
              onClick={() => setShowVoicePlayer(false)}
              className="text-xs font-bold text-neutral-400 hover:text-white"
            >
              Funga Kisanduku
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {sampleVoiceStations.map((st) => (
              <button
                key={st.name}
                type="button"
                onClick={() => handlePlayVoice(st.name, st.alightCount)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                  activeVoiceStation === st.name
                    ? 'bg-blue-600/30 border-blue-500 text-white shadow-md'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-200'
                }`}
              >
                <div>
                  <strong className="text-xs block font-black text-white">
                    {st.name}
                  </strong>
                  <span className="text-[10px] text-neutral-400">
                    &ldquo;Kituo kinachofuata ni...&rdquo;
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={handlePlaySpeedAlert}
              className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Sauti ya Tahadhari ya Spidi (LATRA 50 km/h)</span>
            </button>

            <button
              type="button"
              onClick={handlePlayChimeOnly}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Chime Pekee (Ding-Dong)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
