import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Phone, Lock, Eye, EyeOff, Chrome, Facebook, Apple, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

import { useLanguage } from '../../LanguageContext';

export default function Login() {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState<'standard' | 'staff'>('standard');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, login, staffLogin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (loginType === 'standard') {
        if (!email || !password) return;
        await login(email.trim(), password);
      } else {
        if (!phone || !password) return;
        await staffLogin(phone.trim(), password);
      }
      toast.success(t('welcome_back'));
      navigate('/');
    } catch (error: any) {
      console.error('Login error details:', error);
      toast.error(error.message || t('login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      toast.error("Google login failed.");
    }
  };

  return (
    <AuthLayout 
      title={t('welcome_back')} 
      subtitle={t('sign_in_subtitle')}
    >
      <div className="flex bg-neutral-100 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setLoginType('standard')}
          className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${loginType === 'standard' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500'}`}
        >
          {t('standard_login') || 'Owner / Customer'}
        </button>
        <button 
          onClick={() => setLoginType('staff')}
          className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${loginType === 'staff' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500'}`}
        >
          {t('staff_login') || 'Staff / Wafanyakazi'}
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          {loginType === 'standard' ? (
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input 
                type="email" 
                required
                placeholder={t('email')} 
                className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : (
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <Input 
                type="tel" 
                required
                placeholder="Phone Number / Namba ya Simu" 
                className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
          
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
            <Input 
              type={showPassword ? "text" : "password"} 
              required
              placeholder={t('password')} 
              className="pl-10 pr-10 h-12 bg-neutral-50 border-none rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="text-right">
          <Link to="#" className="text-sm font-medium text-orange-600 hover:underline">
            {t('forgot_password')}
          </Link>
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('sign_in')}
        </Button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-neutral-500 font-medium uppercase">{t('or')}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold"
            onClick={handleGoogleSignIn}
          >
            <Chrome className="w-5 h-5 text-red-500" />
            {t('continue_with_google')}
          </Button>
          <Button variant="outline" className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold">
            <Apple className="w-5 h-5" />
            Continue with Apple
          </Button>
          <Button variant="outline" className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold">
            <Facebook className="w-5 h-5 text-blue-600" />
            Continue with Facebook
          </Button>
        </div>

        <p className="text-center text-sm text-neutral-600 mt-6">
          {t('dont_have_account')}{' '}
          <Link to="/register" className="text-orange-600 font-bold hover:underline">
            {t('sign_up')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
