import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MessageSquare, Plus, CheckCircle, HelpCircle, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: 'Open' | 'Resolved' | 'In Progress';
  date: string;
  desc: string;
}

export default function RiderSupportTicket({ onBack }: { onBack: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([
    {
      id: 'TCK-2901',
      subject: 'Malipo ya Safari #8210 Hayajafika kwenye Wallet',
      category: 'Finances & Payouts',
      status: 'Resolved',
      date: 'Juzi, 11:20 AM',
      desc: 'Nilikamilisha safari kutoka Posta kwenda Mwenge, lakini salio langu kwenye wallet halijaongezeka mpaka sasa.'
    },
    {
      id: 'TCK-1092',
      subject: 'Leseni Yangu ya Udereva Inakaribia Kuisha Muda',
      category: 'Registration & Verification',
      status: 'Open',
      date: 'Leo, 8:40 AM',
      desc: 'Nimepata leseni mpya, nataka kujua jinsi ya kuisasisha kwenye mfumo ili nisije nikasimamishwa kupokea safari.'
    }
  ]);

  const [step, setStep] = useState<'list' | 'create'>('list');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Finances & Payouts');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      const newTicket: Ticket = {
        id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: subject,
        category: category,
        status: 'Open',
        date: 'Sasa hivi',
        desc: desc
      };

      setTickets([newTicket, ...tickets]);
      setStep('list');
      setSubject('');
      setDesc('');
      setLoading(false);
      toast.success('Tiketi yako imefunguliwa!', {
        description: 'TegeX Support Team wataipitia na kukujibu ndani ya masaa 2.',
        duration: 3000,
      });
    }, 1500);
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => step === 'create' ? setStep('list') : onBack()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">MSAADA MAALUM</span>
            <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">Tiketi za Huduma (Support Ticket)</span>
          </div>
        </div>

        {step === 'list' && (
          <button
            onClick={() => setStep('create')}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest italic flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Fungua
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-4"
          >
            {tickets.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-[2rem] border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-4">
                <HelpCircle className="w-12 h-12 text-neutral-300 mx-auto" />
                <h4 className="font-black italic uppercase text-neutral-800 dark:text-neutral-200">Hakuna tiketi bado</h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  Ikiwa una tatizo lolote la kiufundi, bima, malipo au usajili, unaweza kufungua tiketi sasa hivi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => {
                  return (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 space-y-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.id}</span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                              t.status === 'Resolved' 
                                ? 'bg-emerald-500/10 text-emerald-600' 
                                : t.status === 'Open'
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-orange-500/10 text-orange-600'
                            }`}>
                              {t.status === 'Resolved' ? 'Imetatuliwa' : t.status === 'Open' ? 'Imefunguliwa' : 'Inafanyiwa kazi'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200">{t.subject}</h4>
                          <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block">{t.category}</span>
                        </div>
                        <span className="text-[9px] font-bold text-neutral-400 uppercase shrink-0">{t.date}</span>
                      </div>

                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed border-t border-neutral-50 dark:border-neutral-800/50 pt-3">
                        {t.desc}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {step === 'create' && (
          <motion.div 
            key="create"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 space-y-6 shadow-sm">
                <h3 className="text-sm font-black uppercase text-neutral-800 dark:text-neutral-200 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                  Fungua Tiketi Mpya ya Msaada
                </h3>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Mada (Subject)</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full h-14 px-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                    placeholder="e.g. Swali la uanzishaji wa akaunti"
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Kitengo (Category)</label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-14 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="Finances & Payouts">Fedha na Malipo (Finances)</option>
                    <option value="Registration & Verification">Usajili na Uhakiki</option>
                    <option value="App Bugs & Technical">Hitilafu ya Programu (Technical)</option>
                    <option value="Safety & Accidents">Usalama na Dharura</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Maelezo ya Kina</label>
                  <textarea 
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    required
                    rows={4}
                    className="w-full p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200 resize-none"
                    placeholder="Eleza kwa undani changamoto unayokutana nayo ili tukusaidie haraka..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Inatuma Tiketi...' : 'Tuma Tiketi ya Msaada'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('list')}
                  disabled={loading}
                  className="w-full h-14 bg-white hover:bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-xs border border-neutral-100 dark:border-neutral-800 active:scale-95 transition-all"
                >
                  Ghairi
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
