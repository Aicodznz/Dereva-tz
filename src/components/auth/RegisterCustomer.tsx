import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, Lock, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { toast } from 'sonner';

export default function RegisterCustomer() {
  const { t } = useLanguage();
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error(t('passwords_dont_match'));
      return;
    }

    if (!formData.email || !formData.email.includes('@') || formData.email.length < 5) {
      toast.error('Tafadhali weka barua pepe sahihi.');
      return;
    }
    
    setLoading(true);
    try {
      await signUp(formData.email.trim(), formData.password, 'customer', {
        fullName: formData.fullName,
        phone: formData.phone
      });
      toast.success(t('account_created_success'));
      navigate('/');
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        toast.error(t('auth_disabled_instructions'), { duration: 8000 });
      } else {
        toast.error(error.message || t('signup_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={t('sign_up')} 
      subtitle="Tengeneza Akaunti ya Mteja"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            required
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
            required
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
            required
            placeholder="Phone Number" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
          <Input 
            type="password" 
            required
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
            required
            placeholder="Confirm Password" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.confirmPassword}
            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
          />
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold mt-4"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign Up / Jisajili"}
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
