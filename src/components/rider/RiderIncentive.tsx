import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Award, Flame, CheckCircle2, ChevronRight, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Quest {
  id: string;
  title: string;
  desc: string;
  reward: string;
  progress: number;
  target: number;
  claimed: boolean;
  type: 'daily' | 'weekly';
}

export default function RiderIncentive({ onBack }: { onBack: () => void }) {
  const [points, setPoints] = useState(350);
  const [streak, setStreak] = useState(5);
  const [quests, setQuests] = useState<Quest[]>([
    {
      id: 'quest-1',
      title: 'Kikosi cha Asubuhi (Morning Booster)',
      desc: 'Kamilisha safari 3 kati ya saa 12:00 asubuhi na saa 3:00 asubuhi.',
      reward: '5,000 TZS',
      progress: 2,
      target: 3,
      claimed: false,
      type: 'daily'
    },
    {
      id: 'quest-2',
      title: 'Kamilisha Safari 10 Leo',
      desc: 'Toa huduma bora na kamilisha safari 10 ndani ya siku ya leo.',
      reward: '20,000 TZS',
      progress: 7,
      target: 10,
      claimed: false,
      type: 'daily'
    },
    {
      id: 'quest-3',
      title: 'Uaminifu wa Wiki (Weekly Champion)',
      desc: 'Kamilisha safari 45 ndani ya siku 7 mfululizo.',
      reward: '100,000 TZS',
      progress: 45,
      target: 45,
      claimed: false,
      type: 'weekly'
    }
  ]);

  const handleClaim = (questId: string) => {
    setQuests(prev => prev.map(q => {
      if (q.id === questId) {
        toast.success('Pesa ya Bonasi Imewekwa!', {
          description: `Umefanikiwa kuchukua bonasi ya ${q.reward} na kuongeza kwenye pochi yako.`,
          duration: 3000,
        });
        return { ...q, claimed: true };
      }
      return q;
    }));
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">BONASI NA ZAWADI</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">Motisha & Incentives (Vichocheo)</span>
        </div>
      </div>

      {/* Stats Summary Bento Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Streak card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-orange-500 text-white rounded-[2rem] p-6 space-y-3 relative overflow-hidden shadow-lg shadow-orange-500/10"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Flame className="w-20 h-20 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Siku mfululizo (Streak)</p>
          <div className="space-y-1">
            <h2 className="text-4xl font-black italic tracking-tighter">{streak} Siku</h2>
            <p className="text-[9px] font-bold text-white/90 uppercase">Unafanya kazi kwa ustadi mkubwa!</p>
          </div>
        </motion.div>

        {/* Reward Points */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="bg-neutral-900 text-white rounded-[2rem] p-6 space-y-3 relative overflow-hidden shadow-lg border border-neutral-800"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Award className="w-20 h-20 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">TegeX Performance Points</p>
          <div className="space-y-1">
            <h2 className="text-4xl font-black italic tracking-tighter text-emerald-400">{points} XP</h2>
            <p className="text-[9px] font-bold text-neutral-400 uppercase">Points hizi hutumika kuongeza kiwango cha dereva.</p>
          </div>
        </motion.div>
      </div>

      {/* Quests lists */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">KAMPENI ZILIZOPO LEO</h3>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Inasasishwa kila saa</span>
        </div>

        <div className="space-y-3">
          {quests.map((q) => {
            const isCompleted = q.progress >= q.target;
            const percent = Math.min(100, Math.round((q.progress / q.target) * 100));

            return (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        q.type === 'daily' ? 'bg-orange-500/10 text-orange-600' : 'bg-purple-500/10 text-purple-600'
                      }`}>
                        {q.type === 'daily' ? 'KILA SIKU' : 'KILA WIKI'}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200">{q.title}</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed pr-2">{q.desc}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Kipupwe</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-500 block italic leading-none">{q.reward}</span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className="text-neutral-400 uppercase tracking-wider">Maendeleo (Progress)</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{q.progress} / {q.target} ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-orange-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* Claim buttons */}
                {isCompleted ? (
                  q.claimed ? (
                    <div className="w-full h-12 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex items-center justify-center gap-2 text-neutral-400 font-extrabold text-xs uppercase tracking-widest border border-dashed border-neutral-200 dark:border-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-neutral-400 stroke-[3]" /> Bonasi Imechuliwa Tayari
                    </div>
                  ) : (
                    <button
                      onClick={() => handleClaim(q.id)}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest italic text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 fill-white" /> Chukua Bonasi Sasa hivi!
                    </button>
                  )
                ) : (
                  <div className="w-full h-12 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl flex items-center justify-center gap-2 text-neutral-400 font-bold text-xs uppercase tracking-widest border border-neutral-100 dark:border-neutral-800">
                    Bado haijakamilika
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
