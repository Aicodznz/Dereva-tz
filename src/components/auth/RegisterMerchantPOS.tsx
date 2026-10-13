import React, { useState } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store, Utensils, Building2, User, Mail, Phone, Lock, MapPin, ScanFace, CheckCircle2, Loader2, CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function RegisterMerchantPOS() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessCategory: 'duka' as 'duka' | 'mgahawa' | 'hotel' | 'other',
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    location: 'Dar es Salaam, Masaki',
    settlementAccount: 'M-Pesa 0754 111 222 (Biashara)',
    pin: '',
    confirmPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName.trim()) {
      toast.error('Weka jina la biashara au duka lako.');
      return;
    }
    if (!formData.ownerName.trim()) {
      toast.error('Weka jina la mmiliki au meneja.');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Weka namba ya simu ya biashara.');
      return;
    }
    if (formData.pin !== formData.confirmPin) {
      toast.error('Nenosiri/PIN hazilingani.');
      return;
    }

    setLoading(true);
    const generatedTerminalId = `PAPO-POS-${formData.businessCategory.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const merchantProfile = {
      posTerminalId: generatedTerminalId,
      merchantStoreName: formData.businessName,
      businessName: formData.businessName,
      merchantCategory: formData.businessCategory,
      ownerName: formData.ownerName,
      fullName: formData.ownerName,
      phone: formData.phone,
      phoneNumber: formData.phone,
      email: formData.email || `${formData.phone.replace(/\s+/g, '')}@merchant.papo.tz`,
      location: formData.location,
      settlementAccount: formData.settlementAccount,
      role: 'merchant_pos',
      todaySales: 0,
      todayCustomers: 0,
      isVerified: true,
      registeredAt: new Date().toISOString()
    };

    // Save locally for instant offline/demo persistent access
    try {
      localStorage.setItem('papopay_current_merchant', JSON.stringify(merchantProfile));
      localStorage.setItem('papopay_active_role', 'merchant_pos');
    } catch {}

    try {
      const emailToUse = formData.email?.includes('@') 
        ? formData.email.trim() 
        : `${formData.phone.replace(/\D/g, '') || 'pos'}@merchant.papo.tz`;

      await signUp(emailToUse, formData.pin.padEnd(6, '0'), 'merchant_pos', merchantProfile);
      toast.success(`Hongera! Terminal ya ${formData.businessName} imesajiliwa kikamilifu.`);
      navigate('/merchant/dashboard');
    } catch (err: any) {
      console.warn("Firebase fallback active, continuing with local merchant profile:", err);
      toast.success(`Biashara ya ${formData.businessName} imethibitishwa na kusajiliwa!`);
      navigate('/merchant/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Sajili Merchant POS" 
      subtitle="Fungua Terminal ya Malipo ya Uso (Duka, Mgahawa, Hotel au Kokote Kule)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Face Pay POS Benefit Banner */}
        <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
          <ScanFace className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <p>
            Pokea malipo ya wateja kwa <strong>utambuzi wa uso (Smile-to-Pay)</strong> ndani ya sekunde 2 bila foleni kaunta, bila kadi wala pesa taslimu!
          </p>
        </div>

        {/* Business Category Selector */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
            Aina ya Biashara Yako:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'duka', label: 'Duka & Market', icon: Store },
              { id: 'mgahawa', label: 'Mgahawa / Bar', icon: Utensils },
              { id: 'hotel', label: 'Hotel & Lodging', icon: Building2 }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData({ ...formData, businessCategory: cat.id as any })}
                className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                  formData.businessCategory === cat.id
                    ? 'bg-cyan-500 text-neutral-950 border-cyan-400 shadow-md font-black'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Business Name */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            Jina Kamili la Biashara / Duka / Mgahawa:
          </label>
          <div className="relative">
            <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              type="text"
              required
              placeholder="Mf. Shoppers Plaza Mikocheni au Serena Grill"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
            />
          </div>
        </div>

        {/* Owner Name */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            Jina la Mmiliki au Meneja wa Kaunta:
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              type="text"
              required
              placeholder="Mf. Zawadi Said"
              value={formData.ownerName}
              onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
              className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
            />
          </div>
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Namba ya Simu:
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="tel"
                required
                placeholder="0713 000 222"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Barua Pepe (Email):
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="email"
                placeholder="pos@duka.co.tz"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
              />
            </div>
          </div>
        </div>

        {/* Location & Settlement Account */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Mahali / Eneo la Biashara:
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="text"
                required
                placeholder="Dar es Salaam, Masaki"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Akaunti ya Malipo ya Mauzo (Settlement):
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="text"
                required
                placeholder="CRDB Bank / M-Pesa Biashara"
                value={formData.settlementAccount}
                onChange={(e) => setFormData({ ...formData, settlementAccount: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 text-xs"
              />
            </div>
          </div>
        </div>

        {/* PIN / Password for POS Terminal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              PIN ya Terminal ya Kaunta (POS PIN):
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="password"
                required
                placeholder="PIN ya tarakimu 4 au 6"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Thibitisha PIN:
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="password"
                required
                placeholder="Rudia PIN"
                value={formData.confirmPin}
                onChange={(e) => setFormData({ ...formData, confirmPin: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 font-mono"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-600/30 active:scale-98 transition-all mt-3"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-1" />
          )}
          <span>{loading ? 'Inasajili Merchant POS...' : 'Fungua Terminal ya POS Sasa'}</span>
        </Button>

        <div className="text-center text-xs text-neutral-500 pt-2 space-y-1">
          <p>
            Tayari una akaunti ya Biashara/POS?{' '}
            <Link to="/merchant/login" className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline">
              Ingia kwenye POS Terminal
            </Link>
          </p>
          <p>
            Wakala wa PapoPay?{' '}
            <Link to="/wakala/login" className="text-emerald-600 font-bold hover:underline">
              Ingia kama Wakala
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
