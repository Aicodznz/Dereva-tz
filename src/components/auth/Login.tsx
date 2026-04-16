import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Eye, EyeOff, Chrome, Facebook, Apple, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

import { useLanguage } from '../../LanguageContext';

export default function Login() {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t('welcome_back'));
      navigate('/');
    } catch (error: any) {
      console.error('Login error details:', error);
      
      // Handle the common 'invalid-credential' error which covers wrong password and user not found
      if (error.code === 'auth/invalid-credential' || error.message?.includes('auth/invalid-credential')) {
        toast.error(
          t('invalid_credential_error') || "Barua pepe au nenosiri si sahihi.",
          {
            description: "Invalid email or password.",
            duration: 5000,
          }
        );
      } else {
        toast.error(error.message || t('login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      // Error is already logged in AuthContext
    }
  };

  return (
    <AuthLayout 
      title={t('welcome_back')} 
      subtitle={t('sign_in_subtitle')}
    >
      <form onSubmit={handleEmailLogin} className="space-y-6">
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
            <Input 
              type="email" 
              placeholder={t('email')} 
              className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
            <Input 
              type={showPassword ? "text" : "password"} 
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
