import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldAlert, FileText, CheckCircle } from 'lucide-react';

export default function RiderPrivacyPolicy({ onBack }: { onBack: () => void }) {
  const policies = [
    {
      title: "1. Taarifa Tunazokusanya (Information We Collect)",
      content: "Tunakusanya taarifa za eneo lako (GPS Location) ili kukupa maombi ya safari yaliyo karibu nawe, taarifa za gari/pikipiki yako, jina kamili, barua pepe, na namba yako ya simu kwa ajili ya usalama."
    },
    {
      title: "2. Matumizi ya Eneo kwa Dereva (Location Access)",
      content: "Papo Hapo inakusanya data ya eneo lako hata ukiwa hufungua programu (background location) iwapo tu umeweka hali ya kuwa mtandaoni (Online/On-Duty). Hii inasaidia kupata abiria na kuratibu njia salama za barabara."
    },
    {
      title: "3. Ulinzi wa Taarifa Zako (Data Security)",
      content: "Nyaraka zako zote za utambulisho kama leseni, kadi ya gari (kadi ya njano), na bima zinahifadhiwa kwenye seva salama zenye ulinzi wa hali ya juu na hazitolewi kwa upande wowote wa tatu bila idhini yako."
    },
    {
      title: "4. Haki na Udhibiti Wako (Your Rights & Control)",
      content: "Una haki ya kufuta akaunti yako wakati wowote kupitia mipangilio ya programu. Ukifuta akaunti yako, taarifa zako zote za kibinafsi zitaondolewa kwenye mfumo wetu ndani ya siku 14 za kazi."
    }
  ];

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
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">SHERIA NA USALAMA</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">Sera ya Faragha (Privacy Policy)</span>
        </div>
      </div>

      {/* Info Warning Alert */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6 text-neutral-800 dark:text-neutral-200 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Papo Hapo Tanzanian Compliance</h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Sera hii ya faragha inaendana kikamilifu na sheria ya ulinzi wa data ya kibinafsi ya Tanzania ya mwaka 2022 (Personal Data Protection Act, 2022).
          </p>
        </div>
      </div>

      {/* Accordion list */}
      <div className="space-y-4">
        {policies.map((p, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 space-y-3 shadow-sm"
          >
            <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200">{p.title}</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {p.content}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Footer Notes */}
      <div className="text-center p-4 bg-neutral-100 dark:bg-neutral-900/30 rounded-[1.5rem] border border-dashed border-neutral-200 dark:border-neutral-800">
        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
          Inasasishwa mara kwa mara. Matumizi yako ya huduma yanamaanisha unakubaliana na sera hizi.
        </p>
      </div>
    </div>
  );
}
