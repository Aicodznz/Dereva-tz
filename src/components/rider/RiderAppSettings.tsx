import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

interface ServicePreference {
  id: string;
  name: string;
  desc: string;
  isNew: boolean;
  statusKey: 'gocarL' | 'gosendInstant' | 'gocarComfort' | 'gocarPrioritas' | 'gocarHemat' | 'gocarSend';
}

const servicesList: ServicePreference[] = [
  {
    id: 'gocar-l',
    name: 'TegeX Gari (XL)',
    desc: 'Huduma ya kubeba hadi abiria 6 kwa safari moja ya gari kubwa.',
    isNew: false,
    statusKey: 'gocarL'
  },
  {
    id: 'gosend-instant',
    name: 'TegeX Parcel Instant',
    desc: 'Huduma ya haraka sana ya kusafirisha vifurushi na mizigo midogo.',
    isNew: false,
    statusKey: 'gosendInstant'
  },
  {
    id: 'gocar-comfort',
    name: 'TegeX Comfort',
    desc: 'Huduma ya usafiri yenye faraja ya ziada, AC, na madereva wenye kiwango cha juu.',
    isNew: true,
    statusKey: 'gocarComfort'
  },
  {
    id: 'gocar-prioritas',
    name: 'TegeX Prioritas',
    desc: 'Huduma yenye kipaumbele cha juu kwa oda zinazotoka kwa abiria wetu wa VIP na mashirika.',
    isNew: true,
    statusKey: 'gocarPrioritas'
  },
  {
    id: 'gocar-hemat',
    name: 'TegeX Gari Hemat',
    desc: 'Huduma ya usafiri wa kiuchumi (bei nafuu zaidi) kwa abiria wanaojali bajeti.',
    isNew: true,
    statusKey: 'gocarHemat'
  },
  {
    id: 'gocar-send',
    name: 'TegeX Delivery Gari',
    desc: 'Huduma maalumu ya kusafirisha mizigo mikubwa na mizito kwa kutumia magari ya kubebea mizigo.',
    isNew: true,
    statusKey: 'gocarSend'
  }
];

export default function RiderAppSettings({ onBack }: { onBack: () => void }) {
  const { profile, updateProfileData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Initialize state with values from profile or defaults (all true by default so driver starts receiving all)
  const [preferences, setPreferences] = useState({
    gocarL: true,
    gosendInstant: true,
    gocarComfort: true,
    gocarPrioritas: true,
    gocarHemat: true,
    gocarSend: true,
  });

  // Sync with profile if it exists
  useEffect(() => {
    if (profile?.servicePreferences) {
      setPreferences({
        gocarL: profile.servicePreferences.gocarL !== false,
        gosendInstant: profile.servicePreferences.gosendInstant !== false,
        gocarComfort: profile.servicePreferences.gocarComfort !== false,
        gocarPrioritas: profile.servicePreferences.gocarPrioritas !== false,
        gocarHemat: profile.servicePreferences.gocarHemat !== false,
        gocarSend: profile.servicePreferences.gocarSend !== false,
      });
    }
  }, [profile]);

  const handleToggle = async (key: keyof typeof preferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key]
    };
    
    // Quick local update for responsive UI feedback
    setPreferences(updated);

    try {
      setLoading(true);
      await updateProfileData({
        servicePreferences: updated
      });
      toast.success('Mipangilio imesasishwa kikamilifu!', {
        description: 'Mabadiliko ya huduma yataanza kutumika kwenye maombi yako ya safari sasa hivi.',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to update service preferences:', error);
      toast.error('Imeshindwa kuhifadhi mipangilio. Tafadhali jaribu tena.');
      // Revert in case of failure
      setPreferences(preferences);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Top Bar with Back option */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
          title="Rudi kwenye Wasifu"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] leading-none block mb-0.5">DEREVA WA TEKSI & BODA</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200 leading-none">Mipangilio ya Kupokea Safari</span>
        </div>
      </div>

      {/* Info Warning Alert */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6 text-neutral-800 dark:text-neutral-200 flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Udhibiti wa Maombi</h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Hapa nchini Tanzania, unaweza kuwasha au kuzima huduma mbalimbali kulingana na aina ya gari au pikiipiki yako ili kuzuia kupokea safari usizozitaka. Washa zile tu unazotaka kuhudumia kwa sasa!
          </p>
        </div>
      </motion.div>

      {/* Services Toggle Card Layout */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">UCHAGUZI WA HUDUMA (SERVICE TOGGLES)</h3>
        
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-2 divide-y divide-neutral-100 dark:divide-neutral-800/50 shadow-sm overflow-hidden">
          {servicesList.map((service, index) => {
            const isChecked = preferences[service.statusKey];
            return (
              <motion.div 
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-6 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-all first:rounded-t-[2rem] last:rounded-b-[2rem]"
              >
                <div className="space-y-1.5 max-w-[75%] pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200">
                      {service.name}
                    </span>
                    {service.isNew && (
                      <span className="bg-red-500 text-[8px] font-black uppercase text-white px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                        <Sparkles className="w-2 h-2 fill-white" /> MPYA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {service.desc}
                  </p>
                </div>

                {/* Animated iOS-style Toggle Switch matching user picture */}
                <button
                  disabled={loading}
                  onClick={() => handleToggle(service.statusKey)}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 relative focus:outline-none select-none shrink-0 ${
                    isChecked 
                      ? 'bg-emerald-500 dark:bg-emerald-600' 
                      : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                >
                  <motion.div
                    layout
                    className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                    animate={{ x: isChecked ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {isChecked && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    )}
                  </motion.div>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Notes */}
      <div className="text-center p-4 bg-neutral-100 dark:bg-neutral-900/30 rounded-[1.5rem] border border-dashed border-neutral-200 dark:border-neutral-800">
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
          Hakikisha usalama wako kwanza. Usibadilishe mipangilio hii ukiwa kwenye mwendo wa gari au pikipiki.
        </p>
      </div>
    </div>
  );
}
