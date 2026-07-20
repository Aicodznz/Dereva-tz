import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { toast } from 'sonner';

export default function RiderLanguage({ onBack }: { onBack: () => void }) {
  const { language, setLanguage } = useLanguage();

  const options = [
    { code: 'sw', name: 'Kiswahili (Swahili)', flag: '🇹🇿', desc: 'Lugha rasmi ya kazi nchini Tanzania' },
    { code: 'en', name: 'English (Kiingereza)', flag: '🇬🇧', desc: 'Global business and communication language' },
    { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦', desc: 'لغة التواصل والعمل الإضافية' }
  ];

  const tLocal = {
    sw: {
      title_sub: 'LUGHA',
      title: 'Chagua Lugha ya Dereva',
      available: 'LUGHA ZINAZOPATIKANA'
    },
    en: {
      title_sub: 'LANGUAGE',
      title: 'Choose Driver Language',
      available: 'AVAILABLE LANGUAGES'
    },
    ar: {
      title_sub: 'اللغة',
      title: 'اختر لغة السائق',
      available: 'اللغات المتاحة'
    }
  };

  const handleSelect = (code: 'sw' | 'en' | 'ar') => {
    setLanguage(code);
    toast.success(code === 'sw' ? 'Lugha imebadilishwa kikamilifu!' : code === 'en' ? 'Language updated successfully!' : 'تم تغيير اللغة بنجاح!', {
      description: code === 'sw' ? 'Mabadiliko ya lugha yameanza kutumika kwenye programu.' : code === 'en' ? 'Language changes are now live across the app.' : 'تم تطبيق التغييرات على الفور.',
      duration: 3000,
    });
  };

  const currentT = tLocal[language] || tLocal.sw;

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
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">{currentT.title_sub}</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">{currentT.title}</span>
        </div>
      </div>

      {/* Language cards list */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">{currentT.available}</h3>

        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-2 divide-y divide-neutral-100 dark:divide-neutral-800/50 shadow-sm overflow-hidden">
          {options.map((opt, index) => {
            const isSelected = language === opt.code;
            return (
              <motion.button 
                key={opt.code}
                onClick={() => handleSelect(opt.code as any)}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center justify-between p-6 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-all text-left first:rounded-t-[2rem] last:rounded-b-[2rem]"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl select-none">{opt.flag}</span>
                  <div>
                    <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200 leading-none mb-1.5">{opt.name}</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{opt.desc}</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
