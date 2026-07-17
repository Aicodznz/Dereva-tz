import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Copy, Check, Users, Gift, Share2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function RiderReferral({ onBack }: { onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = "TEGEX8219";

  const referrals = [
    { name: 'John J. Minja', phone: '071***8822', status: 'Active (Completed 5 rides)', reward: '5,000 TZS', date: 'Leo, 10:30 AM' },
    { name: 'Salum Rashid', phone: '065***1190', status: 'Registered (No rides yet)', reward: 'Pending', date: 'Juzi, 4:15 PM' },
    { name: 'Emanuel Massawe', phone: '076***4421', status: 'Active (Completed 12 rides)', reward: '5,000 TZS', date: '12 Julai, 1:00 PM' }
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Kodi ya mwaliko imenakiliwa!', {
      description: 'Shiriki sasa hivi na marafiki zako ili ujipatie kipato cha ziada.',
      duration: 3000,
    });
    setTimeout(() => setCopied(false), 2000);
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
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">ALIKA MARAFIKI</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">Tengeneza Pesa (Earn Money)</span>
        </div>
      </div>

      {/* Hero card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-emerald-600 text-white rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden shadow-xl shadow-emerald-500/10"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Gift className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="bg-white/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full text-white tracking-widest leading-none inline-block">
            OFARI MAALUMU YA TEGEX
          </span>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">
            Pata TZS 5,000 kwa kila Dereva mpya unayemleta!
          </h2>
          <p className="text-xs text-emerald-100 leading-relaxed max-w-md pt-2">
            Dereva mpya akijiunga kwa kutumia kodi yako ya mwaliko na kukamilisha safari zake za kwanza 5, wote wawili mtajipatia kiasi cha <b>TZS 5,000</b> papo hapo kwenye pochi zenu.
          </p>
        </div>
      </motion.div>

      {/* Copy code and Share section */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 space-y-4 shadow-sm text-center">
        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">KODI YAKO YA MWALIKO</span>
        
        <div className="flex items-center gap-2 max-w-sm mx-auto">
          <div className="flex-1 h-14 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center font-black text-lg tracking-wider text-neutral-800 dark:text-neutral-100 uppercase select-all">
            {code}
          </div>
          <button
            onClick={handleCopy}
            className="w-14 h-14 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl flex items-center justify-center active:scale-90 transition-all shrink-0"
            title="Nakili kodi"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500 stroke-[3]" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <button className="h-12 px-6 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-all">
          <Share2 className="w-4 h-4" /> Shiriki na Madereva wengine
        </button>
      </div>

      {/* Stats of Referrals */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">MARAFIKI ULIO-ALIKA</h3>
        
        <div className="space-y-3">
          {referrals.map((ref, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-neutral-900 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 p-5 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200">{ref.name}</h4>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">{ref.phone} • {ref.date}</p>
                  <p className="text-[10px] text-neutral-500 mt-1">{ref.status}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block">MALIPO</span>
                <span className={`text-xs font-black italic uppercase ${
                  ref.reward === 'Pending' ? 'text-amber-500' : 'text-emerald-600'
                }`}>
                  {ref.reward}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
