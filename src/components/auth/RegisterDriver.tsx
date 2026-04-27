import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  User, Mail, Phone, MapPin, Lock, Car, CreditCard, Upload, 
  ChevronRight, ChevronLeft, Loader2, Truck, Package, Bike,
  Calendar, Info, ShieldCheck, FileText, CheckCircle2, Wallet,
  Briefcase, Activity
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { toast } from 'sonner';

type DriverType = 'taxi' | 'delivery' | null;

export default function RegisterDriver() {
  const { t } = useLanguage();
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [driverType, setDriverType] = useState<DriverType>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    // Vehicle
    vehicleType: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    licensePlate: '',
    vehicleYear: '',
    carryingCapacity: '',
    // Verification
    licenseNumber: '',
    licenseExpiry: '',
    latraNumber: '',
    latraExpiry: '',
    nidaNumber: '',
    // Work/Payment
    mobileMoneyNumber: '',
    bankAccount: '',
    preferredPayment: 'mpesa',
    preferredWorkArea: '',
    availability: 'full-time',
    commissionAccepted: false,
    parcelTypes: [] as string[],
    maxWeight: '',
    deliveryRegion: 'inside'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final Step Logic: Corrected to step 4
    const isLastStep = (driverType === 'taxi' && step === 4) || (driverType === 'delivery' && step === 4);
    
    if (!isLastStep) {
      setStep(prev => prev + 1);
      return;
    }

    if (!formData.email || !formData.email.includes('@') || formData.email.length < 5) {
      toast.error('Tafadhali weka barua pepe sahihi katika hatua ya kwanza.');
      setStep(1); // Go back to step 1 to fix email
      return;
    }

    if (!formData.commissionAccepted) {
      toast.error('Tafadhali kubali masharti na kamisheni katika ukurasa wa mwisho.');
      return;
    }

    setLoading(true);
    try {
      await signUp(formData.email.trim(), formData.password, 'rider', {
        ...formData,
        phoneNumber: formData.phone,
        driverType,
        approvalStatus: 'pending',
        status: 'offline',
        createdAt: new Date().toISOString()
      });
      toast.success(t('registration_submitted'));
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || t('signup_failed'));
    } finally {
      setLoading(false);
    }
  };

  const renderTypeSelection = () => (
    <motion.div 
      key="selection"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h3 className="text-xl font-black italic uppercase italic tracking-tighter">Choose Your Path</h3>
        <p className="text-neutral-500 text-sm">Chagua aina ya kazi unayotaka kufanya</p>
      </div>

      <button 
        onClick={() => { setDriverType('taxi'); setStep(1); }}
        className="w-full flex items-center p-6 rounded-[2rem] border-2 border-neutral-100 hover:border-orange-500 hover:bg-orange-50/30 transition-all group text-left"
      >
        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
          <Car className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <h4 className="font-black uppercase italic tracking-tighter text-lg">Taxi Driver</h4>
          <p className="text-sm text-neutral-500 font-medium leading-tight">Huduma ya teksi ya haraka na salama.</p>
        </div>
        <ChevronRight className="w-6 h-6 text-neutral-300 group-hover:text-orange-600" />
      </button>

      <button 
        onClick={() => { setDriverType('delivery'); setStep(1); }}
        className="w-full flex items-center p-6 rounded-[2rem] border-2 border-neutral-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all group text-left"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
          <Package className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <h4 className="font-black uppercase italic tracking-tighter text-lg">Delivery (Parcel)</h4>
          <p className="text-sm text-neutral-500 font-medium leading-tight">Safirisha vifurushi na chakula kwa haraka.</p>
        </div>
        <ChevronRight className="w-6 h-6 text-neutral-300 group-hover:text-blue-600" />
      </button>
    </motion.div>
  );

  const renderSteps = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h4 className="text-sm font-black uppercase text-neutral-400 tracking-widest ml-4">Personal Info / Taarifa Binafsi</h4>
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
              <Input required placeholder="Full Name" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
              <Input type="email" required placeholder="Email Address" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
              <Input type="tel" required placeholder="Phone Number" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
              <Input type="password" required placeholder="Password" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-4 text-center hover:border-orange-300 transition-colors cursor-pointer group">
              <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2 group-hover:text-orange-600" />
              <p className="text-xs font-bold text-neutral-600">Upload Profile Photo (Selfie)</p>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h4 className="text-sm font-black uppercase text-neutral-400 tracking-widest ml-4">Vehicle Info / Taarifa za Gari</h4>
            <div className="grid grid-cols-1 gap-4">
              <Select onValueChange={(val: string) => setFormData({...formData, vehicleType: val})}>
                <SelectTrigger className="h-12 bg-neutral-50/50 rounded-xl border-none">
                  <SelectValue placeholder="Aina ya Gari (Vehicle Type)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pikipiki">Pikipiki</SelectItem>
                  <SelectItem value="bajaji">Bajaji</SelectItem>
                  <SelectItem value="gari">Gari</SelectItem>
                  {driverType === 'delivery' && <SelectItem value="baskeli">Baskeli</SelectItem>}
                </SelectContent>
              </Select>
              
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Brand (e.g. Toyota)" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.vehicleBrand} onChange={e => setFormData({...formData, vehicleBrand: e.target.value})} />
                <Input placeholder="Model (e.g. IST)" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.vehicleModel} onChange={e => setFormData({...formData, vehicleModel: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Color / Rangi" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.vehicleColor} onChange={e => setFormData({...formData, vehicleColor: e.target.value})} />
                <Input placeholder="Plate Number" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.licensePlate} onChange={e => setFormData({...formData, licensePlate: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input type="number" placeholder="Year (Optional)" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.vehicleYear} onChange={e => setFormData({...formData, vehicleYear: e.target.value})} />
                {driverType === 'delivery' && (
                  <Select onValueChange={(val: string) => setFormData({...formData, carryingCapacity: val})}>
                    <SelectTrigger className="h-12 bg-neutral-50/50 rounded-xl border-none">
                      <SelectValue placeholder="Capacity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (Food/Docs)</SelectItem>
                      <SelectItem value="medium">Medium (Boxes)</SelectItem>
                      <SelectItem value="large">Large (Mizigo)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h4 className="text-sm font-black uppercase text-neutral-400 tracking-widest ml-4">Verification / Uthibitisho</h4>
            <div className="space-y-3">
              <div className="relative">
                <CreditCard className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                <Input placeholder="Driving License Number" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                <Input placeholder="License Expiry Date" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
              </div>
              
              {driverType === 'taxi' && (
                <>
                  <Input placeholder="LATRA Number" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.latraNumber} onChange={e => setFormData({...formData, latraNumber: e.target.value})} />
                  <Input placeholder="LATRA Expiry Date" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.latraExpiry} onChange={e => setFormData({...formData, latraExpiry: e.target.value})} />
                </>
              )}

              <Input placeholder="NIDA Number" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.nidaNumber} onChange={e => setFormData({...formData, nidaNumber: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-dashed border-neutral-300 rounded-xl p-3 text-center text-[10px] font-bold hover:border-orange-500 cursor-pointer transition-colors group">
                   <Upload className="w-4 h-4 mx-auto mb-1 text-neutral-400 group-hover:text-orange-600" />
                   License Front
                </div>
                <div className="border border-dashed border-neutral-300 rounded-xl p-3 text-center text-[10px] font-bold hover:border-orange-500 cursor-pointer transition-colors group">
                   <Upload className="w-4 h-4 mx-auto mb-1 text-neutral-400 group-hover:text-orange-600" />
                   License Back
                </div>
                <div className="border border-dashed border-neutral-300 rounded-xl p-3 text-center text-[10px] font-bold hover:border-orange-500 cursor-pointer transition-colors group">
                   <Upload className="w-4 h-4 mx-auto mb-1 text-neutral-400 group-hover:text-orange-600" />
                   NIDA / ID Card
                </div>
                {driverType === 'taxi' && (
                  <div className="border border-dashed border-neutral-300 rounded-xl p-3 text-center text-[10px] font-bold hover:border-orange-500 cursor-pointer transition-colors group">
                    <Upload className="w-4 h-4 mx-auto mb-1 text-neutral-400 group-hover:text-orange-600" />
                    Upload LATRA
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 pb-4">
            <h4 className="text-sm font-black uppercase text-neutral-400 tracking-widest ml-4">Payment & Operations</h4>
            
            <div className="space-y-3">
              <Input placeholder="City / Mkoa" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              <Input placeholder="Preferred Area / Eneo unalopenda kufanya kazi" className="h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.preferredWorkArea} onChange={e => setFormData({...formData, preferredWorkArea: e.target.value})} />
              
              <Select onValueChange={(val: string) => setFormData({...formData, availability: val})}>
                <SelectTrigger className="h-12 bg-neutral-50/50 rounded-xl border-none">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                </SelectContent>
              </Select>

              <div className="h-px bg-neutral-100 my-4" />
              
              <div className="relative">
                <Wallet className="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
                <Input placeholder="Mobile Money Number (payout)" className="pl-10 h-12 bg-neutral-50/50 rounded-xl border-none" value={formData.mobileMoneyNumber} onChange={e => setFormData({...formData, mobileMoneyNumber: e.target.value})} />
              </div>

              <div className="flex items-center space-x-2 mt-6 p-5 bg-orange-600/10 rounded-2xl border border-orange-600/20">
                <input 
                  type="checkbox" 
                  id="terms" 
                  className="w-6 h-6 rounded-lg border-orange-200 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  checked={formData.commissionAccepted}
                  onChange={e => setFormData({...formData, commissionAccepted: e.target.checked})}
                />
                <label htmlFor="terms" className="text-xs font-black text-neutral-700 leading-tight cursor-pointer uppercase italic tracking-tighter">
                  Nakubali kulipa kamisheni na kufuata masharti ya TegeX
                </label>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  const isFinalStep = step === 4;

  return (
    <AuthLayout 
      title={step === 0 ? "Be Your Own Boss" : (driverType === 'taxi' ? "Taxi Driver Signup" : "Delivery Partner Signup")}
      subtitle={step === 0 ? "Jiunge na familia ya TegeX" : "Hatua ya mwisho kuelekea uhuru"}
    >
      <div className="mb-8">
        {step > 0 && (
          <div className="flex items-center justify-between mb-10 overflow-x-auto no-scrollbar py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center flex-1 min-w-[50px]">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all transform ${
                  step >= i ? 'bg-orange-600 text-white shadow-2xl shadow-orange-600/40 -rotate-3 scale-110' : 'bg-neutral-100 text-neutral-400'
                }`}>
                  {i}
                </div>
                {i < 4 && <div className={`flex-1 h-1.5 mx-2 rounded-full ${step > i ? 'bg-orange-600 shadow-sm' : 'bg-neutral-100'}`} />}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 0 ? renderTypeSelection() : renderSteps()}
          </AnimatePresence>

          {step > 0 && (
            <div className="flex gap-4 mt-8">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setStep(prev => prev - 1)}
                className="flex-1 h-14 rounded-2xl border-neutral-200 font-bold"
              >
                <ChevronLeft className="w-5 h-5 mr-2" /> Back
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="flex-[2] h-14 bg-neutral-900 hover:bg-neutral-800 rounded-2xl text-lg font-black italic uppercase tracking-tighter"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                ((driverType === 'taxi' && step === 4) || (driverType === 'delivery' && step === 4) ? "Kamilisha" : "Next Step")}
              </Button>
            </div>
          )}
        </form>

        <p className="text-center text-sm text-neutral-600 mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-black hover:underline uppercase tracking-tighter italic">
            Sign in / Ingia
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
