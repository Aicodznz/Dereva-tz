import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, MapPin, Lock, Car, CreditCard, Upload, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function RegisterDriver() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    password: '',
    confirmPassword: '',
    vehicleType: '',
    licensePlate: '',
    licenseNumber: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      await signUp(formData.email, formData.password, 'rider', {
        fullName: formData.fullName,
        phone: formData.phone,
        city: formData.city,
        vehicleType: formData.vehicleType,
        licensePlate: formData.licensePlate,
        licenseNumber: formData.licenseNumber,
        status: 'pending' // Riders need approval
      });
      toast.success("Registration submitted for approval!");
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Become a Driver" 
      subtitle="Kuwa Dereva"
    >
      <div className="mb-8 flex items-center justify-between">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= i ? 'bg-orange-600 text-white' : 'bg-neutral-100 text-neutral-400'
            }`}>
              {i}
            </div>
            {i === 1 && <div className={`flex-1 h-1 mx-2 rounded ${step > 1 ? 'bg-orange-600' : 'bg-neutral-100'}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder="Full Name" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  type="email" 
                  placeholder="Email Address" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  type="tel" 
                  placeholder="Phone Number" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder="City/Region of Operation" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  type="password" 
                  placeholder="Password" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              
              <Button 
                type="button" 
                onClick={() => setStep(2)}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold mt-4 gap-2"
              >
                Next Step <ChevronRight className="w-5 h-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-600 ml-1">Vehicle Type</label>
                <Select onValueChange={(val: string) => setFormData({...formData, vehicleType: val})}>
                  <SelectTrigger className="h-12 bg-neutral-50 border-none rounded-xl">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Car className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder="License Plate Number" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.licensePlate}
                  onChange={e => setFormData({...formData, licensePlate: e.target.value})}
                />
              </div>

              <div className="relative">
                <CreditCard className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                <Input 
                  placeholder="Driving License Number" 
                  className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                  value={formData.licenseNumber}
                  onChange={e => setFormData({...formData, licenseNumber: e.target.value})}
                />
              </div>

              <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center hover:border-orange-300 transition-colors cursor-pointer group">
                <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2 group-hover:text-orange-600" />
                <p className="text-sm font-medium text-neutral-600">Upload Driving License</p>
                <p className="text-xs text-neutral-400 mt-1">PNG, JPG up to 5MB</p>
              </div>

              <div className="flex gap-3 mt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 rounded-xl border-neutral-200 gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-[2] h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Register / Jisajili"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:underline">
            Sign in / Ingia
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
