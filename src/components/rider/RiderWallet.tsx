import React from 'react';
import { 
  Plus, ArrowUpRight, ArrowDownLeft, Clock, 
  ChevronLeft, History, CreditCard, Banknote, Landmark
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../AuthContext';

export default function RiderWallet({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth();
  const balance = profile?.walletBalance ?? 0;
  
  const transactions = [
    { id: 1, type: 'receive', title: 'Ride Earnings', subtitle: 'Trip #8210 - Posta to Kariakoo', amount: '12,500', date: 'Today, 2:45 PM' },
    { id: 2, type: 'send', title: 'Wallet Withdraw', subtitle: 'Moved to M-Pesa (071...234)', amount: '45,000', date: 'Yesterday, 8:20 PM' },
    { id: 3, type: 'receive', title: 'Top Up', subtitle: 'M-Pesa 071...234', amount: '10,000', date: '21 April, 10:15 AM' },
    { id: 4, type: 'receive', title: 'Ride Earnings', subtitle: 'Trip #8208 - Sinza to Posta', amount: '18,200', date: '21 April, 9:30 AM' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-36">
      <div className="p-6 space-y-8 max-w-2xl mx-auto">
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-500/20"
        >
          <div className="absolute top-0 right-0 p-10 opacity-10">
             <Landmark className="w-32 h-32" />
          </div>
          <div className="relative z-10 text-center space-y-4">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Available Balance</p>
             <h2 className="text-5xl font-black italic uppercase tracking-tight">TZS {balance.toLocaleString()}</h2>
             
             <div className="flex gap-3 pt-6">
                <Button className="flex-1 h-14 bg-white text-emerald-600 hover:bg-neutral-100 rounded-2xl font-black uppercase tracking-widest italic text-xs shadow-xl">
                   <Plus className="w-4 h-4 mr-2 stroke-[3px]" /> Top Up
                </Button>
                <Button className="flex-1 h-14 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black uppercase tracking-widest italic text-xs shadow-xl border border-white/10">
                   <ArrowDownLeft className="w-4 h-4 mr-2" /> Withdraw
                </Button>
             </div>
          </div>
        </motion.div>

        {/* Quick Options */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CreditCard, label: "Add Card" },
            { icon: Banknote, label: "Banks" },
            { icon: History, label: "Reports" }
          ].map((opt, idx) => (
             <motion.button 
              key={idx}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-2"
             >
                <div className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                   <opt.icon className="w-5 h-5" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">{opt.label}</span>
             </motion.button>
          ))}
        </div>

        {/* Transactions */}
        <div className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-black uppercase italic tracking-tighter">History</h3>
              <button className="text-[10px] font-black uppercase text-emerald-600 underline tracking-widest">Filter</button>
           </div>
           
           <div className="space-y-3">
              {transactions.map((tx) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-5 bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm"
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                         tx.type === 'receive' 
                          ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' 
                          : 'bg-red-50 text-red-500 dark:bg-red-950/20'
                      }`}>
                         {tx.type === 'receive' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
                      </div>
                      <div>
                         <h4 className="font-black italic uppercase tracking-tighter text-sm leading-none mb-1">{tx.title}</h4>
                         <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">{tx.subtitle}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <h4 className={`font-black italic text-sm ${
                         tx.type === 'receive' ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {tx.type === 'receive' ? '+' : '-'} {tx.amount}
                      </h4>
                      <p className="text-[8px] font-black text-neutral-300 uppercase tracking-widest mt-1">{tx.date}</p>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
