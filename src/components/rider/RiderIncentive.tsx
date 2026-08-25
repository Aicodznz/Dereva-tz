import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Award, Flame, CheckCircle2, ChevronRight, TrendingUp, 
  Sparkles, Zap, Clock, Volume2, VolumeX, ShieldAlert, Gift, Star, 
  Check, Trophy, Info
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';
import { 
  DriverVoice, 
  getDefaultAudioSettings, 
  saveAudioSettings, 
  DriverAudioSettings 
} from '../../utils/driverVoiceAlerts';

interface Quest {
  id: string;
  title: string;
  desc: string;
  rewardValue: number;
  reward: string;
  progress: number;
  target: number;
  claimed: boolean;
  type: 'daily' | 'weekly' | 'surge';
  badge?: string;
  expiresIn?: string;
}

export default function RiderIncentive({ onBack }: { onBack: () => void }) {
  const { user, profile, updateProfileData } = useAuth();
  const [points, setPoints] = useState(profile?.points || 420);
  const [streak, setStreak] = useState(5);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [audioSettings, setAudioSettings] = useState<DriverAudioSettings>(getDefaultAudioSettings());
  const [activeTab, setActiveTab] = useState<'quests' | 'streaks' | 'audio'>('quests');

  // Check if peak hour is active in Tanzania (06:00 - 09:00 or 16:30 - 20:00)
  const [isPeakHour, setIsPeakHour] = useState(false);

  useEffect(() => {
    const checkPeak = () => {
      const now = new Date();
      const hours = now.getHours();
      const mins = now.getMinutes();
      const currentTime = hours + mins / 60;
      // 06:00 to 09:00 OR 16:30 to 20:00
      const inMorningPeak = currentTime >= 6 && currentTime <= 9;
      const inEveningPeak = currentTime >= 16.5 && currentTime <= 20;
      setIsPeakHour(inMorningPeak || inEveningPeak);
    };

    checkPeak();
    const interval = setInterval(checkPeak, 60000);
    return () => clearInterval(interval);
  }, []);

  const [quests, setQuests] = useState<Quest[]>([
    {
      id: 'quest-morning',
      title: 'Kikosi cha Asubuhi (Morning Booster)',
      desc: 'Kamilisha safari 3 kati ya saa 12:00 asubuhi na saa 3:00 asubuhi ili upate bonasi ya ziada ya mafuta.',
      rewardValue: 5000,
      reward: '5,000 TZS',
      progress: 3,
      target: 3,
      claimed: false,
      type: 'daily',
      badge: '🌅 ASUBOHI BOOST',
      expiresIn: 'Saa 2 zimebaki'
    },
    {
      id: 'quest-daily-10',
      title: 'Bingwa wa Safari 10 (Daily 10 Challenge)',
      desc: 'Toa huduma bora na kamilisha safari 10 ndani ya siku ya leo upate bonasi kubwa.',
      rewardValue: 20000,
      reward: '20,000 TZS',
      progress: 7,
      target: 10,
      claimed: false,
      type: 'daily',
      badge: '🎯 LENGO LA SIKU',
      expiresIn: 'Leo Saa 5:59 Usiku'
    },
    {
      id: 'quest-surge-peak',
      title: 'Mvua ya Oda (Peak Hour Surge Multiplier)',
      desc: 'Piga safari 4 wakati wa saa za foleni na mahitaji makubwa (06:00-09:00 au 16:30-20:00).',
      rewardValue: 8000,
      reward: '8,000 TZS',
      progress: 4,
      target: 4,
      claimed: false,
      type: 'surge',
      badge: '⚡ SURGE BOOST',
      expiresIn: 'Inatumika Sasa'
    },
    {
      id: 'quest-weekly-champ',
      title: 'Uaminifu wa Wiki (Weekly Champion 40)',
      desc: 'Kamilisha safari 40 ndani ya siku 7 mfululizo uongeze kipato chako cha wiki.',
      rewardValue: 60000,
      reward: '60,000 TZS',
      progress: 28,
      target: 40,
      claimed: false,
      type: 'weekly',
      badge: '🏆 BINGWA WA WIKI',
      expiresIn: 'Siku 3 zimebaki'
    }
  ]);

  const handleClaim = async (quest: Quest) => {
    if (claimingId) return;
    setClaimingId(quest.id);

    try {
      // 1. Trigger Sound & Voice celebration
      DriverVoice.bonusClaimed(quest.reward);

      // 2. Deposit money into driver's wallet
      const currentWallet = profile?.walletBalance || 0;
      const newWallet = currentWallet + quest.rewardValue;
      const newPoints = points + 50;

      await updateProfileData({
        walletBalance: newWallet,
        points: newPoints
      });

      setPoints(newPoints);

      // 3. Mark quest as claimed
      setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, claimed: true } : q));

      toast.success('🎉 Pesa ya Bonasi Imewekwa!', {
        description: `Umepokea bonasi ya ${quest.reward} kwenye mkoba wako. Salio jipya: TZS ${newWallet.toLocaleString()}.`,
        duration: 4000,
      });
    } catch (e) {
      console.error("Failed to claim bonus:", e);
      toast.error('Hitilafu wakati wa kuchukua bonasi. Tafadhali jaribu tena.');
    } finally {
      setClaimingId(null);
    }
  };

  const updateAudio = (partial: Partial<DriverAudioSettings>) => {
    const updated = { ...audioSettings, ...partial };
    setAudioSettings(updated);
    saveAudioSettings(updated);
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-[#0c0c12] p-4 sm:p-6 pb-36 space-y-6 max-w-2xl mx-auto font-sans text-neutral-900 dark:text-white">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-200/60 dark:border-neutral-800 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] block mb-0.5">PAPO REWARDS & MOTISHA</span>
            <h1 className="text-base sm:text-lg font-black tracking-tight">Vivutio & Bonasi za Kazi</h1>
          </div>
        </div>

        {/* Total Points Badge */}
        <div className="flex items-center gap-2 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-full shadow-sm">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-black text-amber-600 dark:text-amber-400">{points} XP</span>
        </div>
      </div>

      {/* Peak Hour Surge Live Alert */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 sm:p-5 rounded-3xl border transition-all relative overflow-hidden flex items-center justify-between gap-4 ${
          isPeakHour 
            ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border-amber-500/40 shadow-lg shadow-amber-500/10'
            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isPeakHour 
              ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/30 animate-pulse'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
          }`}>
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isPeakHour ? 'bg-amber-500 text-slate-950 font-black' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}>
                {isPeakHour ? '🔥 SURGE HAI SASA HIVI' : 'Saa za Kawaida'}
              </span>
              <span className="text-[10px] text-neutral-400 font-bold">06:00-09:00 & 16:30-20:00</span>
            </div>
            <h3 className="text-sm font-black mt-0.5">
              {isPeakHour ? '+15% Bonasi ya Ziada kwa Kila Safari!' : 'Surge Inafunguka Saa za Foleni'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isPeakHour 
                ? 'Kila safari unayofanya sasa ina nyongeza ya papo hapo kwenye mapato yako.'
                : 'Ingia mtandaoni mapema asubuhi au jioni upate bonasi ya safari.'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 bg-neutral-200/70 dark:bg-neutral-900 p-1 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 text-xs font-black">
        <button
          onClick={() => setActiveTab('quests')}
          className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'quests'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5 text-amber-500" />
          <span>Malengo (Quests)</span>
        </button>
        <button
          onClick={() => setActiveTab('streaks')}
          className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'streaks'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span>Moto (Streaks)</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'audio'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sauti & Milio</span>
        </button>
      </div>

      {/* Tab 1: Quests List */}
      {activeTab === 'quests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">
              MALENGO YA LEO NA WIKI HII
            </h2>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              Inasasishwa Moja kwa Moja
            </span>
          </div>

          <div className="space-y-3.5">
            {quests.map((q) => {
              const isCompleted = q.progress >= q.target;
              const percent = Math.min(100, Math.round((q.progress / q.target) * 100));

              return (
                <motion.div 
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-3xl border p-5 space-y-4 shadow-sm transition-all ${
                    isCompleted && !q.claimed
                      ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white dark:to-neutral-900 border-emerald-500/40 shadow-emerald-500/10'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {q.badge}
                        </span>
                        {q.expiresIn && (
                          <span className="text-[8.5px] font-bold text-neutral-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {q.expiresIn}
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-sm text-neutral-900 dark:text-white">{q.title}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed pr-2">{q.desc}</p>
                    </div>

                    <div className="text-right shrink-0 bg-neutral-50 dark:bg-neutral-800/80 px-3 py-2 rounded-2xl border border-neutral-200/50 dark:border-neutral-700/50">
                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-0.5">BONASI</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block italic leading-none">{q.reward}</span>
                    </div>
                  </div>

                  {/* Progress bar container */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px] font-bold">
                      <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Maendeleo ya Safari</span>
                      <span className="text-neutral-800 dark:text-neutral-200">
                        <b>{q.progress}</b> / {q.target} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden p-0.5">
                      <motion.div 
                        className={`h-full rounded-full ${
                          isCompleted 
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isCompleted ? (
                    q.claimed ? (
                      <div className="w-full h-11 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl flex items-center justify-center gap-2 text-neutral-400 font-extrabold text-xs uppercase tracking-wider border border-dashed border-neutral-300 dark:border-neutral-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 stroke-[3]" /> Bonasi Imetumwa Kwenye Mkoba Wako
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaim(q)}
                        disabled={claimingId === q.id}
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs active:scale-95 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 fill-white animate-spin" />
                        <span>{claimingId === q.id ? 'Inaweka Pesa...' : `Chukua ${q.reward} Sasa Hivi!`}</span>
                      </button>
                    )
                  ) : (
                    <div className="w-full h-10 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl flex items-center justify-between px-4 text-neutral-500 text-xs font-bold border border-neutral-200/50 dark:border-neutral-800">
                      <span>Safari {q.target - q.progress} zimebaki</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase">Piga Kazi Kupata Bonasi</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Streaks & Daily Login Rewards */}
      {activeTab === 'streaks' && (
        <div className="space-y-5">
          {/* Flame streak hero card */}
          <div className="bg-gradient-to-br from-orange-500 via-amber-600 to-red-600 text-white rounded-[2.5rem] p-6 space-y-4 relative overflow-hidden shadow-xl shadow-orange-500/20">
            <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
              <Flame className="w-32 h-32 text-white" />
            </div>
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-100 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                  MOTO WA KAZI (DRIVER STREAK)
                </span>
                <h2 className="text-4xl font-black italic tracking-tight mt-2">{streak} Siku Mfululizo!</h2>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">
                🔥
              </div>
            </div>

            <p className="text-xs text-white/90 leading-relaxed font-medium">
              Kila siku unapoingia Online na kukamilisha angalau safari 1, unapanda daraja la moto. Siku 7 mfululizo unapokea Bonasi Kubwa ya <b>TZS 15,000</b>!
            </p>

            {/* 7-Day interactive streak roadmap */}
            <div className="grid grid-cols-7 gap-1.5 pt-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isPassed = day <= streak;
                const isCurrent = day === streak;
                return (
                  <div key={day} className="flex flex-col items-center gap-1 text-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                      isPassed 
                        ? 'bg-white text-orange-600 shadow-md font-black' 
                        : 'bg-white/20 text-white/60 border border-white/10'
                    }`}>
                      {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : `D${day}`}
                    </div>
                    <span className="text-[8px] font-bold text-white/80">Siku {day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Streak Tiers Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-5 space-y-3">
            <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Zawadi za Moto (Streak Tiers)</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
                <span className="font-bold">🔥 Siku 3 Mfululizo:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">+TZS 3,000 (Imekamilika)</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
                <span className="font-bold">🔥🔥 Siku 5 Mfululizo:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">+TZS 8,000 (Leo)</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
                <span className="font-bold">🔥🔥🔥 Siku 7 (Bingwa wa Wiki):</span>
                <span className="font-black text-amber-600 dark:text-amber-400">+TZS 15,000</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Driver Audio Alerts & Swahili Voice Navigation Settings */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Milio & Mwongozo wa Sauti</h3>
                  <p className="text-xs text-neutral-500">Milio mikali ya safari na sauti ya Kiswahili</p>
                </div>
              </div>

              {/* Test Audio Button */}
              <button
                onClick={() => DriverVoice.testVoice()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase px-3 py-2 rounded-xl active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" /> Jaribu Sauti
              </button>
            </div>

            {/* Toggle options */}
            <div className="space-y-3 pt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
              {/* Loud Dispatch Siren */}
              <div className="flex items-center justify-between pt-3">
                <div className="space-y-0.5 max-w-[75%]">
                  <span className="font-extrabold text-xs text-neutral-900 dark:text-white">
                    Milio Mikali ya Safari (Loud Dispatch Siren)
                  </span>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    Milio maalum ya nguvu inayopenya hata ukiwa kwenye kelele za barabara au ukiwa na helmet.
                  </p>
                </div>
                <button
                  onClick={() => updateAudio({ soundEnabled: !audioSettings.soundEnabled })}
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    audioSettings.soundEnabled ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                    animate={{ x: audioSettings.soundEnabled ? 20 : 0 }}
                  />
                </button>
              </div>

              {/* Swahili Voice Prompts */}
              <div className="flex items-center justify-between pt-3">
                <div className="space-y-0.5 max-w-[75%]">
                  <span className="font-extrabold text-xs text-neutral-900 dark:text-white">
                    Mwongozo wa Sauti ya Kiswahili (Swahili Voice Alerts)
                  </span>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    Inasoma kwa sauti oda mpya, anapokwenda mteja, nauli, na uthibitisho wa kuwasili.
                  </p>
                </div>
                <button
                  onClick={() => updateAudio({ voiceEnabled: !audioSettings.voiceEnabled })}
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    audioSettings.voiceEnabled ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                    animate={{ x: audioSettings.voiceEnabled ? 20 : 0 }}
                  />
                </button>
              </div>

              {/* Announce Destination */}
              <div className="flex items-center justify-between pt-3">
                <div className="space-y-0.5 max-w-[75%]">
                  <span className="font-extrabold text-xs text-neutral-900 dark:text-white">
                    Tamka Eneo la Mteja & Nauli
                  </span>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    Hutamka kwa sauti kiasi cha nauli na jina la kituo cha mteja mara safari inapoingia.
                  </p>
                </div>
                <button
                  onClick={() => updateAudio({ announceDestination: !audioSettings.announceDestination })}
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    audioSettings.announceDestination ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                    animate={{ x: audioSettings.announceDestination ? 20 : 0 }}
                  />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="pt-3 space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-neutral-500">Ukubwa wa Sauti (Volume)</span>
                  <span className="font-black text-emerald-600">{Math.round(audioSettings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={audioSettings.volume}
                  onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
