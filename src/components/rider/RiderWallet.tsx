import React, { useState } from 'react';
import { 
  Plus, ArrowUpRight, ArrowDownLeft, Clock, 
  ChevronLeft, History, CreditCard, Banknote, Landmark, CheckCircle, Loader2, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function RiderWallet({ onBack }: { onBack: () => void }) {
  const { profile, updateProfileData } = useAuth();
  const balance = profile?.walletBalance ?? 0;

  const [actionType, setActionType] = useState<'topup' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState<string>('10000');
  const [phoneNumber, setPhoneNumber] = useState<string>(profile?.phone || '0712345678');
  const [provider, setProvider] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa'>('mpesa');
  const [isLoading, setIsLoading] = useState(false);
  const [customTransactions, setCustomTransactions] = useState<any[]>([]);

  const staticTransactions = [
    { id: 't1', type: 'receive', title: 'Ride Earnings', subtitle: 'Trip #8210 - Posta to Kariakoo', amount: '12,500', date: 'Today, 2:45 PM' },
    { id: 't2', type: 'send', title: 'Wallet Withdraw', subtitle: 'Moved to M-Pesa (071...234)', amount: '45,000', date: 'Yesterday, 8:20 PM' },
    { id: 't3', type: 'receive', title: 'Top Up', subtitle: 'M-Pesa 071...234', amount: '10,000', date: '21 April, 10:15 AM' },
    { id: 't4', type: 'receive', title: 'Ride Earnings', subtitle: 'Trip #8208 - Sinza to Posta', amount: '18,200', date: '21 April, 9:30 AM' },
  ];

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Weka kiasi sahihi cha fedha');
      return;
    }

    if (actionType === 'withdraw' && numAmount > balance) {
      toast.error('Salio lako halitoshi kufanya muamala huu');
      return;
    }

    setIsLoading(true);

    // Simulate mobile money push notification / request approval
    const carrierName = provider === 'mpesa' ? 'M-Pesa' 
                     : provider === 'tigopesa' ? 'Tigo Pesa' 
                     : provider === 'airtel' ? 'Airtel Money' 
                     : 'Halopesa';

    toast.info(actionType === 'topup' 
      ? `Push ya ${carrierName} inatumwa kwenda ${phoneNumber}...` 
      : `Muamala wa kutoa fedha unaandaliwa kwenda ${phoneNumber}...`
    );

    setTimeout(async () => {
      try {
        const newBalance = actionType === 'topup' ? balance + numAmount : balance - numAmount;
        await updateProfileData({ walletBalance: newBalance });

        const txType = actionType === 'topup' ? 'receive' : 'send';
        const txTitle = actionType === 'topup' ? 'Top Up Salio' : 'Kutoa Fedha (Withdraw)';
        const txSubtitle = `${carrierName} (${phoneNumber})`;

        const newTx = {
          id: `new-${Date.now()}`,
          type: txType,
          title: txTitle,
          subtitle: txSubtitle,
          amount: numAmount.toLocaleString(),
          date: 'Sasa Hivi'
        };

        setCustomTransactions(prev => [newTx, ...prev]);

        toast.success(actionType === 'topup' 
          ? `Imefanikiwa! TZS ${numAmount.toLocaleString()} zimeongezwa kwenye salio.` 
          : `Imefanikiwa! TZS ${numAmount.toLocaleString()} zimetumwa kwenda kwenye simu yako.`
        );

        setActionType(null);
      } catch (err) {
        console.error(err);
        toast.error('Muamala umeshindwa. Tafadhali jaribu tena.');
      } finally {
        setIsLoading(false);
      }
    }, 3000);
  };

  const allTransactions = [...customTransactions, ...staticTransactions];

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-36">
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center border border-neutral-200 dark:border-neutral-800"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </motion.button>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">My Wallet</h1>
        </div>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <Landmark className="w-24 h-24" />
          </div>
          <div className="relative z-10 text-center space-y-3">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Salio Lako la Sasa</p>
             <h2 className="text-4xl font-black italic uppercase tracking-tight">TZS {balance.toLocaleString()}</h2>
             
             <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => { setActionType('topup'); setAmount('10000'); }}
                  className="flex-1 h-12 bg-white text-emerald-600 hover:bg-neutral-100 rounded-xl font-black uppercase tracking-widest italic text-[11px] shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 border-0 outline-none"
                >
                   <Plus className="w-4 h-4 stroke-[3px]" /> Weka Salio (Top Up)
                </button>
                <button 
                  onClick={() => { setActionType('withdraw'); setAmount('10000'); }}
                  className="flex-1 h-12 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black uppercase tracking-widest italic text-[11px] shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 border border-white/10 outline-none"
                >
                   <ArrowDownLeft className="w-4 h-4" /> Toa Fedha
                </button>
             </div>
          </div>
        </motion.div>

        {/* Action Form Dialog (Topup / Withdraw) */}
        <AnimatePresence>
          {actionType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleTransaction} className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    {actionType === 'topup' ? 'Weka Pesa kwenye Wallet' : 'Toa Pesa Kwenda Simuni'}
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => setActionType(null)} 
                    className="text-xs font-bold text-neutral-400 hover:text-neutral-600 border-0 bg-transparent"
                  >
                    Funga
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Carrier Provider choice */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'mpesa', name: 'M-Pesa', color: 'border-red-500 bg-red-50/10 text-red-600' },
                      { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500 bg-blue-50/10 text-blue-600' },
                      { id: 'airtel', name: 'Airtel', color: 'border-rose-500 bg-rose-50/10 text-rose-600' },
                      { id: 'halopesa', name: 'Halo Pesa', color: 'border-orange-500 bg-orange-50/10 text-orange-600' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setProvider(opt.id as any)}
                        className={`py-2 px-1 text-center rounded-xl text-[10px] font-black border transition-all ${
                          provider === opt.id 
                            ? `${opt.color} ring-2 ring-offset-2 ring-emerald-500` 
                            : 'border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Namba ya Simu ya Malipo</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      placeholder="e.g. 0712345678"
                      className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-150 dark:border-neutral-800 outline-none font-bold text-sm"
                    />
                  </div>

                  {/* Amount Field */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Kiasi cha Fedha (TZS)</label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {['5000', '10000', '20000', '50000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmount(amt)}
                          className={`py-2 text-center rounded-xl text-[10px] font-black border transition-all ${
                            amount === amt 
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' 
                              : 'border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {parseInt(amt).toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="Kiasi kingine"
                      className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-150 dark:border-neutral-800 outline-none font-bold text-sm text-emerald-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest italic text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50 border-0 outline-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Inatuma Ombi...
                    </>
                  ) : (
                    <>
                      {actionType === 'topup' ? 'Thibitisha Weka Salio' : 'Thibitisha Toa Fedha'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Options */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CreditCard, label: "Add Card", desc: "Kadi Mpya" },
            { icon: Banknote, label: "Banks", desc: "Benki Zangu" },
            { icon: History, label: "Reports", desc: "Ripoti" }
          ].map((opt, idx) => (
             <motion.button 
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={() => toast.info(`${opt.label} bado inatengenezwa.`, { description: 'Kipengele hiki kinakuja hivi karibuni.' })}
              className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-1 shadow-sm"
             >
                <div className="w-8 h-8 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                   <opt.icon className="w-4 h-4" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">{opt.label}</span>
             </motion.button>
          ))}
        </div>

        {/* Transactions */}
        <div className="space-y-3">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase italic tracking-tighter">Historia ya Miamala</h3>
              <button className="text-[8px] font-black uppercase text-emerald-600 underline tracking-widest border-0 bg-transparent">Zote</button>
           </div>
           
           <div className="space-y-2">
              {allTransactions.map((tx) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-xs"
                >
                   <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                         tx.type === 'receive' 
                          ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' 
                          : 'bg-red-50 text-red-500 dark:bg-red-950/20'
                      }`}>
                         {tx.type === 'receive' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                         <h4 className="font-black italic uppercase tracking-tighter text-xs leading-none mb-1">{tx.title}</h4>
                         <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-wide">{tx.subtitle}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <h4 className={`font-black italic text-xs ${
                         tx.type === 'receive' ? 'text-emerald-500' : 'text-red-500'
                       }`}>
                        {tx.type === 'receive' ? '+' : '-'} TZS {tx.amount}
                      </h4>
                      <p className="text-[7px] font-black text-neutral-300 uppercase tracking-widest mt-0.5">{tx.date}</p>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
