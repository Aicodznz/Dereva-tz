import React, { useState, useMemo } from 'react';
import { 
  Plus, ArrowUpRight, ArrowDownLeft, Clock, 
  ChevronLeft, History, CreditCard, Banknote, Landmark, CheckCircle, Loader2, 
  Smartphone, Users, ShieldCheck, Zap, Sparkles, TrendingUp, Award,
  Flame, Check, AlertTriangle, UserPlus, HelpCircle, RefreshCw, Star, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

type WalletTab = 'wallet' | 'subscription' | 'sacco' | 'aicredit';

interface RiderWalletProps {
  onBack: () => void;
  initialTab?: WalletTab;
}

export default function RiderWallet({ onBack, initialTab = 'wallet' }: RiderWalletProps) {
  const { profile, updateProfileData } = useAuth();
  const balance = profile?.walletBalance ?? 0;

  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);
  
  // Wallet Top-up / Withdraw form state
  const [actionType, setActionType] = useState<'topup' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState<string>('10000');
  const [phoneNumber, setPhoneNumber] = useState<string>(profile?.phoneNumber || profile?.phone || '0712345678');
  const [provider, setProvider] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa'>('mpesa');
  const [isLoading, setIsLoading] = useState(false);

  // Subscription state
  const [selectedSubPlan, setSelectedSubPlan] = useState<'daily' | 'weekly' | 'monthly' | null>(null);
  const [subPaymentSource, setSubPaymentSource] = useState<'wallet' | 'mobile'>('wallet');
  const [isSubscribing, setIsSubscribing] = useState(false);

  // SACCO State
  const [showJoinSaccoModal, setShowJoinSaccoModal] = useState(false);
  const [showCreateSaccoModal, setShowCreateSaccoModal] = useState(false);
  const [saccoCodeInput, setSaccoCodeInput] = useState('');
  const [newSaccoName, setNewSaccoName] = useState('');
  const [saccoContributeAmount, setSaccoContributeAmount] = useState('5000');
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [isSaccoLoading, setIsSaccoLoading] = useState(false);

  // AI Overdraft toggle
  const [aiOverdraftActive, setAiOverdraftActive] = useState(profile?.aiCreditScore?.enabled ?? true);

  // Fallback defaults for rich experience
  const currentSubscription = profile?.subscription || {
    planId: '',
    planName: 'Bila Kifurushi (10% Kamisheni)',
    expiresAt: null,
    status: 'inactive' as const
  };

  const isSubActive = useMemo(() => {
    if (!currentSubscription || currentSubscription.status !== 'active' || !currentSubscription.expiresAt) return false;
    return new Date(currentSubscription.expiresAt).getTime() > Date.now();
  }, [currentSubscription]);

  const sacco = profile?.saccoGroup || {
    groupId: 'sacco-posta-1',
    groupName: 'Umoja wa Boda Posta & Kariakoo',
    branchName: 'Kituo cha Mnazi Mmoja',
    role: 'member' as const,
    membersCount: 8,
    poolBalance: 85000,
    guaranteeLimit: 20000,
    joinedAt: '2026-05-12',
    code: 'POSTA-884'
  };

  const aiScore = profile?.aiCreditScore || {
    score: 88,
    tier: 'Gold Champion' as const,
    overdraftLimit: 30000,
    usedOverdraft: balance < 0 ? Math.abs(balance) : 0,
    completedTrips: 184,
    acceptanceRate: 98,
    customerRating: 4.9,
    repaymentRate: 100,
    enabled: true
  };

  // Transactions list
  const [transactions, setTransactions] = useState<any[]>([
    { id: 't1', type: 'receive', title: 'Malipo ya Safari #8210', subtitle: 'Posta Mpaka Kariakoo (Cash)', amount: '12,500', date: 'Leo, 2:45 PM', category: 'trip' },
    { id: 't2', type: 'deduct', title: 'Kamisheni ya Safari (10%)', subtitle: 'PapoRide System Deduction', amount: '1,250', date: 'Leo, 2:45 PM', category: 'commission' },
    { id: 't3', type: 'receive', title: 'Weka Salio (Top Up)', subtitle: 'M-Pesa 071...234', amount: '15,000', date: 'Jana, 8:20 PM', category: 'topup' },
    { id: 't4', type: 'send', title: 'Mchango wa Mfuko wa SACCO', subtitle: 'Umoja wa Boda Posta (Akiba)', amount: '5,000', date: 'Juzi, 10:15 AM', category: 'sacco' },
  ]);

  // Handle Wallet Top-up / Withdraw
  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Weka kiasi sahihi cha fedha');
      return;
    }

    if (actionType === 'withdraw' && numAmount > balance) {
      toast.error('Salio lako halitoshi kutoa kiasi hiki');
      return;
    }

    setIsLoading(true);
    const carrierName = provider === 'mpesa' ? 'Vodacom M-Pesa' 
                     : provider === 'tigopesa' ? 'Tigo Pesa' 
                     : provider === 'airtel' ? 'Airtel Money' 
                     : 'HaloPesa';

    toast.info(actionType === 'topup' 
      ? `Tafadhali thibitisha ombi la ${carrierName} kwenye simu yako (${phoneNumber})...` 
      : `Muamala wa kutoa fedha unatumwa kwenda ${phoneNumber}...`
    );

    setTimeout(async () => {
      try {
        const newBalance = actionType === 'topup' ? balance + numAmount : balance - numAmount;
        await updateProfileData({ walletBalance: newBalance });

        const txType = actionType === 'topup' ? 'receive' : 'send';
        const txTitle = actionType === 'topup' ? 'Weka Salio (Top Up)' : 'Kutoa Fedha (Withdraw)';
        const txSubtitle = `${carrierName} (${phoneNumber})`;

        const newTx = {
          id: `new-${Date.now()}`,
          type: txType,
          title: txTitle,
          subtitle: txSubtitle,
          amount: numAmount.toLocaleString(),
          date: 'Sasa Hivi',
          category: actionType === 'topup' ? 'topup' : 'withdraw'
        };

        setTransactions(prev => [newTx, ...prev]);

        toast.success(actionType === 'topup' 
          ? `Imefanikiwa! TZS ${numAmount.toLocaleString()} zimeongezwa kwenye mkoba wako.` 
          : `Imefanikiwa! TZS ${numAmount.toLocaleString()} zimetumwa kwenye simu yako.`
        );

        setActionType(null);
      } catch (err) {
        console.error(err);
        toast.error('Muamala umeshindwa. Tafadhali jaribu tena.');
      } finally {
        setIsLoading(false);
      }
    }, 2000);
  };

  // Handle Subscription Purchase (PapoPass)
  const handleBuySubscription = async (planKey: 'daily' | 'weekly' | 'monthly', price: number, days: number, planName: string) => {
    if (subPaymentSource === 'wallet' && balance < price) {
      toast.error('Salio la Wallet halitoshi. Weka salio kwanza au chagua malipo kwa Simu (M-Pesa).');
      return;
    }

    setIsSubscribing(true);
    toast.info(`Inaandaa Kifurushi cha ${planName}...`);

    setTimeout(async () => {
      try {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        const newBalance = subPaymentSource === 'wallet' ? balance - price : balance;

        await updateProfileData({
          walletBalance: newBalance,
          subscription: {
            planId: planKey,
            planName: planName,
            expiresAt: expiryDate.toISOString(),
            status: 'active'
          }
        });

        // Add transaction
        setTransactions(prev => [
          {
            id: `sub-${Date.now()}`,
            type: 'deduct',
            title: `Kifurushi cha ${planName}`,
            subtitle: `0% Kamisheni kwa siku ${days} (${subPaymentSource === 'wallet' ? 'Kutoka Mkobani' : 'Kupitia Simu'})`,
            amount: price.toLocaleString(),
            date: 'Sasa Hivi',
            category: 'subscription'
          },
          ...prev
        ]);

        toast.success(`Hongera! Kifurushi cha ${planName} kimewashwa kikamilifu. Sasa unafanya safari zote bila kukatwa kamisheni ya 10%!`, {
          duration: 4500
        });

        setSelectedSubPlan(null);
      } catch (err) {
        console.error(err);
        toast.error('Kushindwa kuwasha kifurushi.');
      } finally {
        setIsSubscribing(false);
      }
    }, 2000);
  };

  // Handle SACCO Contribution
  const handleSaccoContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseInt(saccoContributeAmount, 10);
    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error('Weka kiasi sahihi cha mchango');
      return;
    }
    if (balance < numAmt) {
      toast.error('Salio lako la wallet halitoshi kutoa mchango huu.');
      return;
    }

    setIsSaccoLoading(true);
    setTimeout(async () => {
      try {
        const updatedPool = (sacco?.poolBalance || 0) + numAmt;
        const newBal = balance - numAmt;

        await updateProfileData({
          walletBalance: newBal,
          saccoGroup: {
            ...sacco,
            poolBalance: updatedPool
          }
        });

        setTransactions(prev => [
          {
            id: `sacco-${Date.now()}`,
            type: 'send',
            title: 'Mchango wa Akiba ya SACCO',
            subtitle: `${sacco.groupName} Pool`,
            amount: numAmt.toLocaleString(),
            date: 'Sasa Hivi',
            category: 'sacco'
          },
          ...prev
        ]);

        toast.success(`Mchango wa TZS ${numAmt.toLocaleString()} umewekwa kwenye Mfuko wa Dhamana wa Chama chako!`);
        setShowContributeModal(false);
      } catch (err) {
        console.error(err);
        toast.error('Kushindwa kuweka mchango');
      } finally {
        setIsSaccoLoading(false);
      }
    }, 1500);
  };

  // Handle Joining SACCO
  const handleJoinSaccoByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saccoCodeInput.trim()) {
      toast.error('Weka nambari ya msimbo wa SACCO (SACCO Code)');
      return;
    }
    setIsSaccoLoading(true);
    setTimeout(async () => {
      const groupName = saccoCodeInput.toUpperCase().includes('SINZA') ? 'Sinza & Mwenge Bajaji Chama' 
                      : saccoCodeInput.toUpperCase().includes('ILALA') ? 'Ilala Boda Boda Solidarity' 
                      : 'Umoja wa Madereva wa Kijiwe';

      await updateProfileData({
        saccoGroup: {
          groupId: `sacco-${Date.now()}`,
          groupName: groupName,
          branchName: 'Tawi Kuu',
          role: 'member',
          membersCount: 7,
          poolBalance: 65000,
          guaranteeLimit: 25000,
          joinedAt: new Date().toISOString().split('T')[0],
          code: saccoCodeInput.toUpperCase()
        }
      });
      setIsSaccoLoading(false);
      setShowJoinSaccoModal(false);
      toast.success(`Umejiunga kikamilifu na ${groupName}! Sasa unalindwa na mfuko wa dhamana ya pamoja.`);
    }, 1500);
  };

  // Toggle AI Overdraft
  const handleToggleAiOverdraft = async () => {
    const nextVal = !aiOverdraftActive;
    setAiOverdraftActive(nextVal);
    await updateProfileData({
      aiCreditScore: {
        ...aiScore,
        enabled: nextVal
      }
    });
    toast.success(nextVal 
      ? `AI Dynamic Overdraft imewashwa! Unaweza kuingia barabarani hata salio likiwa chini hadi -TZS ${aiScore.overdraftLimit.toLocaleString()}.` 
      : 'AI Dynamic Overdraft imezimwa.');
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-36 text-neutral-900 dark:text-neutral-100">
      <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.2em] block">
                PAPO FINANCIAL HUB
              </span>
              <h1 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter">
                Mkoba & Mipango ya Dereva
              </h1>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (4 Core Financial Systems) */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-neutral-200/70 dark:bg-neutral-900 rounded-2xl border border-neutral-200/50 dark:border-neutral-800">
          {[
            { id: 'wallet', label: 'Mkoba', icon: Banknote },
            { id: 'subscription', label: 'Vifurushi', icon: Flame, badge: isSubActive ? '0%' : undefined },
            { id: 'sacco', label: 'Chama/SACCO', icon: Users },
            { id: 'aicredit', label: 'AI Alama', icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WalletTab)}
              className={`py-2.5 px-1.5 rounded-xl font-black text-[10.5px] uppercase tracking-tight flex flex-col sm:flex-row items-center justify-center gap-1 transition-all relative ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.label}</span>
              {tab.badge && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[7.5px] px-1 rounded-full border border-white">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: MKOBA WA DEREVA (LIVE WALLET & BALANCES) */}
        {activeTab === 'wallet' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Main Balance Card */}
            <div className={`rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl transition-all ${
              balance < 0 
                ? 'bg-gradient-to-br from-amber-700 via-rose-800 to-neutral-900' 
                : 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900'
            }`}>
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Landmark className="w-28 h-28" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white">
                    {balance < 0 ? '⚠️ SALIO LA DENI (OVERDRAFT)' : 'MKOBI WA PAPORIDE'}
                  </span>

                  {isSubActive ? (
                    <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-3 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Flame className="w-3 h-3 fill-slate-950" /> 0% KAMISHENI HEWANI
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold opacity-80">
                      Kamisheni: 10% kwa safari
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Salio Lako Linalopatikana:</p>
                  <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight">
                    {balance < 0 ? `- TZS ${Math.abs(balance).toLocaleString()}` : `TZS ${balance.toLocaleString()}`}
                  </h2>
                </div>

                {/* Overdraft Protection info if balance is negative or near zero */}
                {aiOverdraftActive && (
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                      <div>
                        <p className="font-bold text-[11px]">Kikomo cha AI Overdraft</p>
                        <p className="text-[9px] opacity-80">Huruhusiwi kuzuiwa hadi kufikia -TZS {aiScore.overdraftLimit.toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="font-black text-emerald-300 text-[10px] uppercase">HAI</span>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => { setActionType('topup'); setAmount('10000'); }}
                    className="flex-1 h-12 bg-white text-emerald-700 hover:bg-neutral-100 rounded-2xl font-black uppercase tracking-wider text-[11px] shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 border-0 outline-none"
                  >
                    <Plus className="w-4 h-4 stroke-[3px]" /> Weka Salio (Top Up)
                  </button>
                  <button 
                    onClick={() => { setActionType('withdraw'); setAmount('10000'); }}
                    className="flex-1 h-12 bg-emerald-900/80 hover:bg-emerald-950 text-white rounded-2xl font-black uppercase tracking-wider text-[11px] shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 border border-white/20 outline-none"
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Toa Fedha
                  </button>
                </div>
              </div>
            </div>

            {/* Action Form (Top-up / Withdraw Modal Flow) */}
            <AnimatePresence>
              {actionType && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleTransaction} className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                          {actionType === 'topup' ? 'Weka Pesa kwenye Mkoba' : 'Toa Pesa Kwenda Simuni'}
                        </h3>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setActionType(null)} 
                        className="text-xs font-bold text-neutral-400 hover:text-neutral-600 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full border-0"
                      >
                        Ghairi
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Carrier Provider selector */}
                      <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">Chagua Mtandao wa Simu</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'mpesa', name: 'M-Pesa', color: 'border-red-500 bg-red-500/10 text-red-600' },
                          { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500 bg-blue-500/10 text-blue-600' },
                          { id: 'airtel', name: 'Airtel Money', color: 'border-rose-500 bg-rose-500/10 text-rose-600' },
                          { id: 'halopesa', name: 'HaloPesa', color: 'border-orange-500 bg-orange-500/10 text-orange-600' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setProvider(opt.id as any)}
                            className={`py-2 px-1 text-center rounded-xl text-[10px] font-black border transition-all ${
                              provider === opt.id 
                                ? `${opt.color} ring-2 ring-emerald-500 shadow-sm` 
                                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>

                      {/* Phone Field */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Namba ya Simu ya M-Pesa / TigoPesa</label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          required
                          placeholder="0712345678"
                          className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 outline-none font-bold text-sm"
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
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500' 
                                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400'
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
                          className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 outline-none font-black text-sm text-emerald-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 border-0 outline-none"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Inatuma Ombi la Malipo...
                        </>
                      ) : (
                        <>
                          {actionType === 'topup' ? `Weka TZS ${parseInt(amount || '0').toLocaleString()} Sasa` : `Toa TZS ${parseInt(amount || '0').toLocaleString()} Sasa`}
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick 3-Pill Highlights */}
            <div className="grid grid-cols-3 gap-2.5">
              <div 
                onClick={() => setActiveTab('subscription')}
                className="cursor-pointer p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-1 shadow-sm hover:border-amber-500/50 transition-all text-center"
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase">PapoPass</span>
                <span className="text-[8px] text-neutral-400 font-bold">{isSubActive ? 'Imewashwa (0%)' : 'Nunua Kifurushi'}</span>
              </div>

              <div 
                onClick={() => setActiveTab('sacco')}
                className="cursor-pointer p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-1 shadow-sm hover:border-blue-500/50 transition-all text-center"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase">Chama/SACCO</span>
                <span className="text-[8px] text-neutral-400 font-bold">{sacco.membersCount} Wanachama</span>
              </div>

              <div 
                onClick={() => setActiveTab('aicredit')}
                className="cursor-pointer p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-1 shadow-sm hover:border-emerald-500/50 transition-all text-center"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase">AI Alama: {aiScore.score}</span>
                <span className="text-[8px] text-neutral-400 font-bold">Kikomo -TZS {aiScore.overdraftLimit / 1000}k</span>
              </div>
            </div>

            {/* Transactions History */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-500" /> Historia ya Miamala
                </h3>
                <span className="text-[8px] font-bold text-neutral-400 uppercase">Miamala ya Hivi Karibuni</span>
              </div>
              
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'receive' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' 
                          : tx.type === 'deduct'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                      }`}>
                        {tx.type === 'receive' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black uppercase text-xs truncate leading-tight">{tx.title}</h4>
                        <p className="text-[8.5px] font-bold text-neutral-500 truncate">{tx.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <h4 className={`font-black text-xs ${
                        tx.type === 'receive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-800 dark:text-neutral-200'
                      }`}>
                        {tx.type === 'receive' ? '+' : '-'} TZS {tx.amount}
                      </h4>
                      <p className="text-[7.5px] font-bold text-neutral-400 uppercase mt-0.5">{tx.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: VIFURUSHI VYA PAPOPASS (FLAT SUBSCRIPTIONS - 0% COMMISSION) */}
        {activeTab === 'subscription' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Active Subscription Status Banner */}
            <div className={`rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-xl ${
              isSubActive 
                ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700' 
                : 'bg-neutral-900 border border-neutral-800'
            }`}>
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Flame className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[8.5px] font-black uppercase px-3 py-1 rounded-full ${
                    isSubActive ? 'bg-white text-orange-600' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {isSubActive ? '🔥 KIFURUSHI KIKO HEWANI' : 'BILA KIFURUSHI'}
                  </span>
                  <span className="text-[9px] font-black uppercase text-amber-200">
                    {isSubActive ? '0% ADA YA KAMISHENI' : 'Ada ya 10% kwa kila safari'}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs text-neutral-300 font-bold uppercase tracking-wider">Kifurushi Chako Sasa:</h3>
                  <h2 className="text-2xl font-black italic uppercase text-white mt-0.5">{currentSubscription.planName}</h2>
                </div>

                {isSubActive && currentSubscription.expiresAt && (
                  <div className="flex items-center gap-2 text-xs pt-2 border-t border-white/20 text-white/90">
                    <Clock className="w-4 h-4 text-amber-200" />
                    <span>Kinaisha: <b>{new Date(currentSubscription.expiresAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</b></span>
                  </div>
                )}
              </div>
            </div>

            {/* Explanation of Subscription Model */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-black text-emerald-800 dark:text-emerald-300 uppercase">Faida ya Kifurushi cha PapoPass</p>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  Ukinunua kifurushi cha Siku au Wiki, <b>hukatwi kamisheni yoyote (0%)</b> kwa safari zote unazofanya! Pesa zote za safari unazofanya ni faida yako 100%.
                </p>
              </div>
            </div>

            {/* Subscription Plans List */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 px-1">CHAGUA KIFURUSHI CHAKO</h4>
              
              <div className="grid grid-cols-1 gap-3.5">
                {[
                  {
                    id: 'daily' as const,
                    name: 'Kifurushi cha Siku (1 Day Pass)',
                    price: 2000,
                    days: 1,
                    desc: 'Siku 1 Nzima',
                    badge: 'Maarufu Sana',
                    popular: true,
                    features: ['Safari zote bila kukatwa 10%', 'Kupokea wateja bila ukomo', 'Hakuna deni linaloongezeka'],
                  },
                  {
                    id: 'weekly' as const,
                    name: 'Kifurushi cha Wiki (7 Days Pass)',
                    price: 10000,
                    days: 7,
                    desc: 'Siku 7 (Wiki Nzima)',
                    badge: 'Okoa TZS 4,000',
                    popular: false,
                    features: ['0% Kamisheni kwa siku 7', 'Kipaumbele cha wateja wa karibu', 'Usaidizi wa haraka 24/7'],
                  },
                  {
                    id: 'monthly' as const,
                    name: 'Kifurushi cha Mwezi (30 Days Pass)',
                    price: 32000,
                    days: 30,
                    desc: 'Siku 30 (Mwezi Mzima)',
                    badge: 'Faida Kubwa Zaidi',
                    popular: false,
                    features: ['0% Kamisheni mwezi mzima', 'Nafasi ya kwanza kwenye maeneo yenye wateja wengi', 'Bima ya ajali & Mfuko wa Chama'],
                  }
                ].map((plan) => (
                  <div 
                    key={plan.id}
                    className={`bg-white dark:bg-neutral-900 rounded-3xl p-5 border transition-all shadow-sm relative overflow-hidden ${
                      selectedSubPlan === plan.id 
                        ? 'border-emerald-500 ring-2 ring-emerald-500' 
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute top-4 right-4 bg-emerald-500 text-white font-black text-[8px] uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                        {plan.badge}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">{plan.desc}</span>
                        <h3 className="text-base font-black uppercase text-neutral-800 dark:text-neutral-100">{plan.name}</h3>
                        <p className="text-2xl font-black italic text-emerald-600 dark:text-emerald-400 mt-0.5">
                          TZS {plan.price.toLocaleString()}
                        </p>
                      </div>

                      <ul className="space-y-1.5 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[3]" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Payment Source & Buy button */}
                      <div className="pt-2">
                        {selectedSubPlan === plan.id ? (
                          <div className="space-y-3 bg-neutral-50 dark:bg-neutral-950 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                            <label className="text-[9px] font-black uppercase text-neutral-400">Lipia Kutoka:</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSubPaymentSource('wallet')}
                                className={`py-2 px-2 rounded-xl text-xs font-black border transition-all ${
                                  subPaymentSource === 'wallet' 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                Salio la Mkoba ({balance.toLocaleString()} TZS)
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubPaymentSource('mobile')}
                                className={`py-2 px-2 rounded-xl text-xs font-black border transition-all ${
                                  subPaymentSource === 'mobile' 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                Simu (M-Pesa / Tigo)
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={isSubscribing}
                              onClick={() => handleBuySubscription(plan.id, plan.price, plan.days, plan.name)}
                              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50 border-0 outline-none"
                            >
                              {isSubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 fill-white" />}
                              Thibitisha & Washa Kifurushi
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSubPlan(plan.id)}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border-0"
                          >
                            <Flame className="w-3.5 h-3.5 fill-white" /> Chagua Kifurushi Hiki
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: DHAMANA YA CHAMA / SACCO (GROUP GUARANTEE & SOLIDARITY) */}
        {activeTab === 'sacco' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* SACCO Hero Card */}
            <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Users className="w-28 h-28" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> MFUKO WA DHAMANA YA CHAMA
                  </span>
                  <span className="text-[9px] font-bold bg-blue-500/40 px-2 py-0.5 rounded-full">
                    KODI: <b>{sacco.code}</b>
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">{sacco.groupName}</h2>
                  <p className="text-[10px] text-blue-200 font-bold uppercase">{sacco.branchName || 'Tawi la Dar es Salaam'}</p>
                </div>

                {/* Balance in Pool */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                    <p className="text-[8.5px] uppercase font-bold text-blue-200">Mfuko wa Pamoja:</p>
                    <h3 className="text-xl font-black italic">TZS {sacco.poolBalance.toLocaleString()}</h3>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                    <p className="text-[8.5px] uppercase font-bold text-blue-200">Dhamana Yako:</p>
                    <h3 className="text-xl font-black italic text-emerald-300">TZS {sacco.guaranteeLimit.toLocaleString()}</h3>
                  </div>
                </div>

                {/* SACCO Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowContributeModal(true)}
                    className="flex-1 h-11 bg-white text-blue-700 hover:bg-neutral-100 rounded-xl font-black uppercase text-[11px] tracking-wide shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 border-0"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3px]" /> Weka Mchango
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sacco.code);
                      toast.success(`Msimbo wa SACCO (${sacco.code}) umenakiliwa! Watumie madereva wenzako wajiunge.`);
                    }}
                    className="flex-1 h-11 bg-blue-900/80 hover:bg-blue-950 text-white rounded-xl font-black uppercase text-[11px] tracking-wide shadow-md flex items-center justify-center gap-1.5 border border-white/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Alika Dereva
                  </button>
                </div>
              </div>
            </div>

            {/* How SACCO Group Guarantee Works */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-black text-blue-800 dark:text-blue-300 uppercase">Jinsi Dhamana ya Chama Inavyokulinda</p>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  Unapokuwa na dharura au salio lako linaposhuka chini, <b>Mfuko wa Chama unakudhamini papo hapo hadi TZS {sacco.guaranteeLimit.toLocaleString()}</b> bila akaunti yako kufungiwa. Unaendelea kupiga mzigo bila kero!
                </p>
              </div>
            </div>

            {/* SACCO Members List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" /> Wanachama wa Chama ({sacco.membersCount})
                </h4>
                <button 
                  onClick={() => setShowJoinSaccoModal(true)}
                  className="text-[9px] font-black uppercase text-blue-600 underline"
                >
                  Badili Chama / Jiunge Kingine
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {[
                  { name: `${profile?.displayName || 'Wewe'} (Dereva)`, role: 'Mwanachama Hai', status: 'Inalindwa', isMe: true, contributed: '15,000 TZS' },
                  { name: 'Juma Khamis (Boda Posta)', role: 'Mwenyekiti', status: 'Inalindwa', isMe: false, contributed: '25,000 TZS' },
                  { name: 'Rashidi Mfaume (Bajaji Sinza)', role: 'Mweka Hazina', status: 'Inalindwa', isMe: false, contributed: '20,000 TZS' },
                  { name: 'Emmanuel Mwita (Taxi Kariakoo)', role: 'Mwanachama', status: 'Inalindwa', isMe: false, contributed: '15,000 TZS' },
                  { name: 'Bakari Salum (Boda Mwenge)', role: 'Mwanachama', status: 'Inalindwa', isMe: false, contributed: '10,000 TZS' },
                ].map((member, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-2xl border ${
                      member.isMe 
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' 
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center font-black text-xs">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-xs text-neutral-800 dark:text-neutral-200 leading-tight">
                          {member.name}
                        </p>
                        <p className="text-[8px] font-bold text-neutral-400 uppercase">{member.role} • Mchango: {member.contributed}</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                      {member.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal: Contribute to SACCO */}
            <AnimatePresence>
              {showContributeModal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 max-w-sm w-full space-y-4 border border-neutral-200 dark:border-neutral-800">
                    <h3 className="text-sm font-black uppercase text-neutral-900 dark:text-white">Weka Mchango wa Chama</h3>
                    <p className="text-xs text-neutral-500">Mchango huu unaingia kwenye Mfuko wa Pamoja na kuongeza kikomo cha dhamana yako.</p>
                    
                    <form onSubmit={handleSaccoContribute} className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {['2000', '5000', '10000'].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setSaccoContributeAmount(amt)}
                            className={`py-2 text-xs font-black rounded-xl border ${
                              saccoContributeAmount === amt ? 'bg-blue-600 text-white border-blue-600' : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600'
                            }`}
                          >
                            {parseInt(amt).toLocaleString()} TZS
                          </button>
                        ))}
                      </div>

                      <input
                        type="number"
                        value={saccoContributeAmount}
                        onChange={(e) => setSaccoContributeAmount(e.target.value)}
                        placeholder="Kiasi kingine"
                        className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-bold text-sm"
                      />

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowContributeModal(false)}
                          className="flex-1 h-11 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 rounded-xl font-bold text-xs"
                        >
                          Ghairi
                        </button>
                        <button
                          type="submit"
                          disabled={isSaccoLoading}
                          className="flex-1 h-11 bg-blue-600 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-1 shadow-md"
                        >
                          {isSaccoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Weka Sasa'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modal: Join Other SACCO */}
            <AnimatePresence>
              {showJoinSaccoModal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 max-w-sm w-full space-y-4 border border-neutral-200 dark:border-neutral-800">
                    <h3 className="text-sm font-black uppercase text-neutral-900 dark:text-white">Jiunge na Chama cha Kijiwe</h3>
                    <p className="text-xs text-neutral-500">Weka Msimbo (SACCO Code) uliyopewa na kiongozi au dereva mwenzako wa kijiwe.</p>
                    
                    <form onSubmit={handleJoinSaccoByCode} className="space-y-3">
                      <input
                        type="text"
                        value={saccoCodeInput}
                        onChange={(e) => setSaccoCodeInput(e.target.value)}
                        placeholder="Mfano: POSTA-884 au SINZA-202"
                        className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-black text-sm uppercase tracking-wider text-blue-600"
                        required
                      />

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowJoinSaccoModal(false)}
                          className="flex-1 h-11 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 rounded-xl font-bold text-xs"
                        >
                          Ghairi
                        </button>
                        <button
                          type="submit"
                          disabled={isSaccoLoading}
                          className="flex-1 h-11 bg-blue-600 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-1 shadow-md"
                        >
                          {isSaccoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Jiunge Sasa'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* TAB 4: AI MKUZA ALAMA & KIKOMO CHA DENI (DYNAMIC CREDIT SCORING) */}
        {activeTab === 'aicredit' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* AI Trust Score Hero Card */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-800 to-slate-900 rounded-[2.5rem] p-6 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="w-28 h-28" />
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" /> AI DRIVER TRUST SCORE
                  </span>
                  <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Award className="w-3 h-3" /> {aiScore.tier}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-black italic tracking-tight">{aiScore.score}<span className="text-xl font-normal opacity-70">/100</span></h2>
                    <p className="text-[10px] text-emerald-200 font-bold uppercase mt-1">Kiwango cha Uaminifu wa AI</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase text-emerald-200">Kikomo cha Deni (Overdraft):</p>
                    <h3 className="text-2xl font-black text-amber-300 italic">- TZS {aiScore.overdraftLimit.toLocaleString()}</h3>
                  </div>
                </div>

                {/* Progress Meter */}
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${aiScore.score}%` }} 
                      className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold opacity-80 uppercase">
                    <span>Bronze (-5k)</span>
                    <span>Silver (-15k)</span>
                    <span className="text-amber-300 font-black">Gold (-30k)</span>
                    <span>Platinum (-50k)</span>
                  </div>
                </div>

                {/* Overdraft Toggle Button */}
                <div className="pt-2">
                  <button
                    onClick={handleToggleAiOverdraft}
                    className={`w-full h-11 rounded-xl font-black uppercase text-[11px] tracking-wide shadow-md flex items-center justify-center gap-2 transition-all ${
                      aiOverdraftActive 
                        ? 'bg-white text-emerald-800' 
                        : 'bg-neutral-800 text-neutral-300 border border-white/20'
                    }`}
                  >
                    <Zap className={`w-4 h-4 ${aiOverdraftActive ? 'fill-emerald-600 text-emerald-600' : ''}`} />
                    {aiOverdraftActive ? 'AI Dynamic Overdraft: IMEWASHWA (Hai)' : 'Washa AI Overdraft'}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Breakdown Factors */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 px-1">
                VIPENGELE VYA ALAMA YA AI (SCORE BREAKDOWN)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="text-[9px] font-black uppercase">Safari Zilizokamilika</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-black text-neutral-800 dark:text-neutral-100">{aiScore.completedTrips} Safari</h3>
                  <p className="text-[8px] text-emerald-600 font-bold">+15 Pts ya Uzoefu</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="text-[9px] font-black uppercase">Ukadiriaji wa Wateja</span>
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  </div>
                  <h3 className="text-lg font-black text-neutral-800 dark:text-neutral-100">{aiScore.customerRating} ⭐ Nyota</h3>
                  <p className="text-[8px] text-emerald-600 font-bold">Madereva 5% Bora</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="text-[9px] font-black uppercase">Kiwango cha Kukubali Oda</span>
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-black text-neutral-800 dark:text-neutral-100">{aiScore.acceptanceRate}%</h3>
                  <p className="text-[8px] text-blue-600 font-bold">Haraka na Uhakika</p>
                </div>

                <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-neutral-500">
                    <span className="text-[9px] font-black uppercase">Malipo ya Wakati</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-black text-neutral-800 dark:text-neutral-100">{aiScore.repaymentRate}%</h3>
                  <p className="text-[8px] text-purple-600 font-bold">Hakuna Madeni Sugu</p>
                </div>
              </div>
            </div>

            {/* AI Dynamic Tip for Driver */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-black text-amber-800 dark:text-amber-300 uppercase">Ushauri wa AI wa Kuongeza Alama</p>
                <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5">
                  Ukikamilisha safari 16 zaidi wiki hii na kudumisha nyota 4.8+, utapandishwa hadi kiwango cha <b>Platinum Legend</b> na kikomo chako cha deni kitaongezeka hadi <b>-TZS 50,000</b>!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
