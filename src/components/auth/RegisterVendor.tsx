import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Store, Mail, Phone, Lock, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function RegisterVendor() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const [formData, setFormData] = useState({
    ownerName: '',
    businessName: '',
    category: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreed: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreed) {
      toast.error("Please agree to the terms and conditions");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    setLoading(true);
    try {
      await signUp(formData.email, formData.password, 'vendor', {
        fullName: formData.ownerName,
        businessName: formData.businessName,
        category: formData.category,
        phone: formData.phone,
        status: 'pending' // Vendors need approval
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
      title="Become a Vendor" 
      subtitle="Kuwa Muuzaji"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            placeholder="Owner's Full Name" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.ownerName}
            onChange={e => setFormData({...formData, ownerName: e.target.value})}
          />
        </div>

        <div className="relative">
          <Store className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            placeholder="Business Name" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.businessName}
            onChange={e => setFormData({...formData, businessName: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Select onValueChange={(val: string) => setFormData({...formData, category: val})}>
            <SelectTrigger className="h-12 bg-neutral-50 border-none rounded-xl">
              <SelectValue placeholder="Business Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="grocery">Grocery</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="ecommerce">eCommerce</SelectItem>
              <SelectItem value="salon">Salon</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="relative">
          <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            type="email" 
            placeholder="Business Email" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div className="relative">
          <Phone className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            type="tel" 
            placeholder="Business Phone Number" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
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

        <div className="relative">
          <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            type="password" 
            placeholder="Confirm Password" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.confirmPassword}
            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
          />
        </div>

        <div className="flex items-start space-x-3 py-2">
          <Checkbox 
            id="terms" 
            className="mt-1 border-neutral-300 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
            onCheckedChange={(checked) => setFormData({...formData, agreed: checked as boolean})}
          />
          <label htmlFor="terms" className="text-xs text-neutral-500 leading-tight">
            I agree to the <Link to="#" className="text-orange-600 font-medium">Terms and Conditions</Link> and <Link to="#" className="text-orange-600 font-medium">Privacy Policy</Link>.
          </label>
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold mt-2"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Create Account / Tengeneza Akaunti"}
        </Button>

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
