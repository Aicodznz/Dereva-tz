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
    gender: 'male' as 'male' | 'female',
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
        phoneNumber: formData.phone,
        phone: formData.phone,
        gender: formData.gender
      });
      toast.success(t('account_created_success'));
      navigate('/');
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorCode = error.code || '';
      const errorMessage = error.message || '';

      if (errorCode === 'auth/operation-not-allowed') {
        toast.error(t('auth_disabled_instructions'), { duration: 8000 });
      } else if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        toast.error(t('email_already_exists'));
      } else if (errorCode === 'auth/weak-password') {
        toast.error(t('weak_password_error'));
      } else if (errorCode === 'auth/invalid-email') {
        toast.error(t('invalid_email_error'));
      } else {
        toast.error(errorMessage || t('signup_failed'));
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
            placeholder="Phone Number / Namba ya Simu" 
            className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>

        {/* Gender Selection (Jinsia: Mwanaume / Mwanamke) */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 block">
            Jinsia / Gender <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, gender: 'male' })}
              className={`h-12 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                formData.gender === 'male'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500'
                  : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <span className="text-base">👨</span>
              <span>Mwanaume</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, gender: 'female' })}
              className={`h-12 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                formData.gender === 'female'
                  ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300 shadow-sm ring-1 ring-pink-500'
                  : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
              }`}
            >
              <span className="text-base">👩</span>
              <span>Mwanamke</span>
            </button>
          </div>
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
