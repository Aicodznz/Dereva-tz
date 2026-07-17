import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Sparkles, Check, Flame, CreditCard, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  duration: string;
  popular: boolean;
  features: string[];
  color: string;
  bg: string;
  badge: string;
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'daily',
    name: 'Kifurushi cha Siku',
    price: '2,000 TZS',
    duration: 'Siku 1',
    popular: false,
    features: ['Kupokea safari bila ukomo', 'Ada ya mtandao 0%', 'Usaidizi wa haraka wa wateja'],
    color: 'text-neutral-500',
    bg: 'bg-neutral-50 dark:bg-neutral-900',
    badge: 'Ufanisi'
  },
  {
    id: 'weekly',
    name: 'Kifurushi cha Wiki',
    price: '10,000 TZS',
    duration: 'Siku 7',
    popular: true,
    features: ['Kupokea safari bila ukomo', 'Ada ya mtandao 0%', 'Usaidizi wa haraka wa wateja', 'Kipaumbele cha ziada cha kupokea safari'],
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20',
    badge: 'Inayopendwa zaidi'
  },
  {
    id: 'monthly',
    name: 'Kifurushi cha Mwezi',
    price: '30,000 TZS',
    duration: 'Siku 30',
    popular: false,
    features: ['Kupokea safari bila ukomo', 'Ada ya mtandao 0%', 'Usaidizi wa haraka wa wateja', 'Kipaumbele cha ziada cha kupokea safari', 'Ofa maalum za bima ya afya'],
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-500/20',
    badge: 'Okoa Zaidi'
  }
];

export default function RiderSubscription({ onBack }: { onBack: () => void }) {
  const { profile, updateProfileData } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'tigopesa' | 'airtelmoney'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone || '0712345678');
  const [step, setStep] = useState<'list' | 'pay' | 'success'>('list');
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setStep('pay');
  };

  const handlePay = async () => {
    setLoading(true);
    // Simulate payment processing
    setTimeout(async () => {
      try {
        const expiresAt = new Date();
        if (selectedPlan?.id === 'daily') expiresAt.setDate(expiresAt.getDate() + 1);
        else if (selectedPlan?.id === 'weekly') expiresAt.setDate(expiresAt.getDate() + 7);
        else if (selectedPlan?.id === 'monthly') expiresAt.setDate(expiresAt.getDate() + 30);

        await updateProfileData({
          subscription: {
            planId: selectedPlan?.id || 'weekly',
            planName: selectedPlan?.name || 'Kifurushi cha Wiki',
            expiresAt: expiresAt.toISOString(),
            status: 'active'
          }
        });
        setStep('success');
        toast.success('Malipo yamekamilika kwa ufanisi!', {
          description: `Kifurushi chako cha ${selectedPlan?.name} kimeanzishwa.`,
          duration: 3000,
        });
      } catch (err) {
        console.error(err);
        toast.error('Imeshindwa kukamilisha usajili.');
      } finally {
        setLoading(false);
      }
    }, 2500);
  };

  const currentPlan = profile?.subscription || {
    planName: 'Bure (Ada ya 15% kwa kila safari)',
    status: 'inactive',
    expiresAt: null
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => step === 'pay' ? setStep('list') : onBack()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] block mb-0.5">MALIPO YAKO</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">Kifurushi cha Subscription</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Current Active Plan Status Card */}
            <div className="bg-neutral-900 text-white rounded-[2.5rem] p-8 relative overflow-hidden border border-neutral-800">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Sparkles className="w-24 h-24 text-white" />
              </div>
              <div className="relative z-10 space-y-4">
                <span className="text-[8px] font-black uppercase bg-emerald-500 px-3 py-1 rounded-full text-white tracking-widest leading-none inline-block">
                  {currentPlan.status === 'active' ? 'INATUMIKA' : 'HUNA KIFURUSHI'}
                </span>
                <div className="space-y-1">
                  <h3 className="text-xs text-neutral-400 font-extrabold uppercase tracking-widest leading-none">Kifurushi chako sasa hivi:</h3>
                  <h2 className="text-xl font-black italic uppercase text-emerald-400">{currentPlan.planName}</h2>
                </div>
                {currentPlan.expiresAt && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 pt-2 border-t border-neutral-800">
                    <Clock className="w-4 h-4 text-neutral-500" />
                    <span>Muda wa mwisho: <b className="text-white">{new Date(currentPlan.expiresAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</b></span>
                  </div>
                )}
              </div>
            </div>

            {/* Title list */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">CHAGUA KIFURUSHI CHAKO MAALUMU</h4>
              
              <div className="grid grid-cols-1 gap-4">
                {subscriptionPlans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-6 flex flex-col justify-between gap-6 transition-all bg-white dark:bg-neutral-900 hover:border-emerald-500/30 shadow-sm relative overflow-hidden`}
                  >
                    {plan.popular && (
                      <div className="absolute top-4 right-4 bg-emerald-500 text-[8px] font-black uppercase text-white px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <Flame className="w-2.5 h-2.5 fill-white" /> {plan.badge}
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block">{plan.duration}</span>
                        <h3 className="text-lg font-black italic uppercase text-neutral-800 dark:text-neutral-200">{plan.name}</h3>
                        <p className="text-2xl font-black italic text-emerald-600 dark:text-emerald-500">{plan.price}</p>
                      </div>

                      <ul className="space-y-2 border-t border-neutral-100 dark:border-neutral-800/50 pt-4">
                        {plan.features.map((feature, fIdx) => (
                          <li key={fIdx} className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0 stroke-[3]" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest italic text-xs active:scale-95 transition-all shadow-md shadow-emerald-500/10"
                    >
                      Jiunge Sasa hivi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'pay' && selectedPlan && (
          <motion.div 
            key="pay"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 p-8 space-y-6 shadow-sm">
              <h3 className="text-sm font-black uppercase text-neutral-800 dark:text-neutral-200 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                Uthibitisho wa Malipo ya {selectedPlan.name}
              </h3>

              <div className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl">
                <span className="text-xs text-neutral-500">Kiasi cha Kulipia:</span>
                <span className="text-lg font-black text-emerald-600">{selectedPlan.price}</span>
              </div>

              {/* Mobile Money Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Njia ya Malipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'mpesa', name: 'M-Pesa', color: 'border-red-500 text-red-500' },
                    { id: 'tigopesa', name: 'Tigo Pesa', color: 'border-blue-500 text-blue-500' },
                    { id: 'airtelmoney', name: 'Airtel Money', color: 'border-red-600 text-red-600' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`h-12 border rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                        paymentMethod === m.id 
                          ? `${m.color} bg-neutral-50 dark:bg-neutral-800 ring-2 ring-emerald-500/25` 
                          : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Number to pay with */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Namba ya Simu ya Malipo</label>
                <input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full h-14 px-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                  placeholder="e.g. 0712345678"
                />
                <p className="text-[9px] text-neutral-400 ml-4 leading-relaxed">
                  Tutaomba muamala wa malipo (Push Notification) uje moja kwa moja kwenye simu yako kwa usalama.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Subiri, Kichochezi cha Malipo kinatumwa...' : 'Lipia Sasa Hivi'}
              </button>
              <button
                onClick={() => setStep('list')}
                disabled={loading}
                className="w-full h-14 bg-white hover:bg-neutral-50 text-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-xs border border-neutral-100 dark:border-neutral-800 active:scale-95 transition-all"
              >
                Ghairi Malipo
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="space-y-6 text-center py-12"
          >
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-12 h-12 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-neutral-800 dark:text-white">Malipo Yamefanikiwa!</h2>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Asante sana! Huduma yako ya subscription ya TegeX imeanza sasa hivi. Unaweza kuendelea kupokea safari bila ukomo nchini kote.
              </p>
            </div>

            <button
              onClick={onBack}
              className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-8"
            >
              Rudi kwenye Ramani ya Kazi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
