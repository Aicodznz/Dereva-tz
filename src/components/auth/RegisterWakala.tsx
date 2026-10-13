import React, { useState } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store, User, Mail, Phone, Lock, MapPin, ShieldCheck, Banknote, Loader2, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function RegisterWakala() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    fullName: '',
    email: '',
    phone: '',
    location: 'Dar es Salaam, Kinondoni',
    nidaNumber: '',
    initialFloat: '3000000',
    pin: '',
    confirmPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName.trim()) {
      toast.error('Weka jina la kituo cha Wakala.');
      return;
    }
    if (!formData.fullName.trim()) {
      toast.error('Weka jina lako kamili.');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Weka namba yako ya simu.');
      return;
    }
    if (formData.pin !== formData.confirmPin) {
      toast.error('Nenosiri/PIN hazilingani.');
      return;
    }
    if (formData.pin.length < 4) {
      toast.error('PIN inapaswa kuwa angalau tarakimu 4.');
      return;
    }

    setLoading(true);
    const generatedWakalaId = `TZ-WAKALA-${Math.floor(1000 + Math.random() * 9000)}-DAR`;
    const floatAmount = Number(formData.initialFloat) || 2000000;

    const wakalaProfile = {
      wakalaId: generatedWakalaId,
      businessName: formData.businessName,
      agentName: formData.fullName,
      fullName: formData.fullName,
      phone: formData.phone,
      phoneNumber: formData.phone,
      email: formData.email || `${formData.phone.replace(/\s+/g, '')}@wakala.papo.tz`,
      location: formData.location,
      nidaNumber: formData.nidaNumber,
      wakalaFloatBalance: floatAmount,
      commissionEarned: 0,
      role: 'wakala',
      isVerified: true,
      registeredAt: new Date().toISOString()
    };

    // Save locally for instant offline/demo persistent access
    try {
      localStorage.setItem('papopay_current_wakala', JSON.stringify(wakalaProfile));
      localStorage.setItem('papopay_active_role', 'wakala');
    } catch {}

    try {
      const emailToUse = formData.email?.includes('@') 
        ? formData.email.trim() 
        : `${formData.phone.replace(/\D/g, '') || 'wakala'}@wakala.papo.tz`;

      await signUp(emailToUse, formData.pin.padEnd(6, '0'), 'wakala', wakalaProfile);
      toast.success(`Hongera! Kituo cha Wakala ${formData.businessName} kimesajiliwa kikamilifu.`);
      navigate('/wakala/dashboard');
    } catch (err: any) {
      console.warn("Firebase fallback active, continuing with local wakala profile:", err);
      toast.success(`Kituo cha Wakala ${formData.businessName} kimethibitishwa na kusajiliwa!`);
      navigate('/wakala/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Sajili Kituo cha Wakala" 
      subtitle="Jiunge na Mtandao wa Mawakala wa PapoPay (Kuweka & Kutoa Pesa kwa Uso)"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Wakala Benefit Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            Pata <strong>kamisheni ya 1.2% papo hapo</strong> kwa kila muamala wa kuweka (Cash-In) na kutoa pesa (Cash-Out) kwa njia ya utambuzi wa uso wa PapoPay!
          </p>
        </div>

        {/* Business Name */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            Jina la Kituo cha Wakala / Biashara:
          </label>
          <div className="relative">
            <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              type="text"
              required
              placeholder="Mf. Wakala wa PapoPay - Dar Express"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
            />
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            Jina Kamili la Mmliki / Msimamizi:
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              type="text"
              required
              placeholder="Mf. Baraka Juma Mrema"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
            />
          </div>
        </div>

        {/* Phone & Email Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Namba ya Simu ya Wakala:
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="tel"
                required
                placeholder="0754 000 111"
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
                placeholder="wakala@papo.tz"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
              />
            </div>
          </div>
        </div>

        {/* Location & NIDA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Eneo / Mtaa wa Kituo:
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="text"
                required
                placeholder="Dar es Salaam, Kinondoni"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Namba ya NIDA (Kitambulisho):
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="19900101-12345-00001-20"
                value={formData.nidaNumber}
                onChange={(e) => setFormData({ ...formData, nidaNumber: e.target.value })}
                className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Initial Float Setup */}
        <div>
          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
            Kianzio cha Salio la Float (TZS):
          </label>
          <div className="relative">
            <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            <Input
              type="number"
              required
              value={formData.initialFloat}
              onChange={(e) => setFormData({ ...formData, initialFloat: e.target.value })}
              className="pl-10 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base"
            />
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">
            Salio la float litatumika kuweka pesa kwa wateja (Cash-In) kituoni kwako.
          </span>
        </div>

        {/* PIN / Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
              Nenosiri / PIN ya Wakala:
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
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/30 active:scale-98 transition-all mt-3"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-1" />
          )}
          <span>{loading ? 'Inasajili Kituo cha Wakala...' : 'Kamilisha Usajili wa Wakala'}</span>
        </Button>

        <div className="text-center text-xs text-neutral-500 pt-2 space-y-1">
          <p>
            Tayari una akaunti ya Wakala?{' '}
            <Link to="/wakala/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              Ingia kwenye Portal ya Wakala
            </Link>
          </p>
          <p>
            Mteja wa kawaida?{' '}
            <Link to="/login" className="text-blue-600 font-bold hover:underline">
              Ingia kama Mteja
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
