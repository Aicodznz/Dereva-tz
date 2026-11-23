import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Phone, Lock, Eye, EyeOff, Chrome, Facebook, Apple, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';
import firebaseConfig from '../../../firebase-applet-config.json';

import { useLanguage } from '../../LanguageContext';

export default function Login() {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isCredentialError, setIsCredentialError] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const { signIn, login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setIsCredentialError(false);
    try {
      await login(email.trim(), password);
      toast.success(t('welcome_back'));
      navigate('/');
    } catch (error: any) {
      const errorMessage = error.message || '';
      const errorCode = error.code || '';

      if (errorCode === 'auth/invalid-credential' || 
          errorMessage.includes('invalid-credential') || 
          errorMessage.includes('Invalid login credentials') ||
          errorCode === 'auth/wrong-password' || 
          errorCode === 'auth/user-not-found') {
        console.warn('Authentication failure info (credential error):', errorMessage);
        setIsCredentialError(true);
        toast.error(t('invalid_email_or_password'));
      } else {
        console.error('Login non-credential error details:', error);
        toast.error(errorMessage || t('login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setUnauthorizedDomain(null);
    setGoogleLoading(true);
    try {
      await signIn();
    } catch (error: any) {
      const code = error?.code || '';
      const msg = error?.message || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomain(host);
        toast.error('Kikoa hiki bado hakijaidhinishwa kwa Google Sign-In. Tumia Email/Password au idhinisha kikoa kwenye Firebase Console.');
      } else if (code === 'auth/popup-blocked') {
        toast.error('Dirisha la Google limezuiwa na kivinjari (Popup blocked). Ruhusu popups au ingia kwa Email.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        toast.info('Umeghairi kuingia kwa Google.');
      } else {
        toast.error(msg || 'Google login failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCopyDomain = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedDomain(true);
      toast.success('Domain imenakiliwa!');
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      toast.info(`Nakili domain hii: ${unauthorizedDomain}`);
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
              required
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

        {isCredentialError && (
          <div className="p-4 bg-orange-50 border border-orange-200/60 rounded-2xl space-y-2 text-xs text-orange-950 transition-all duration-300">
            <p className="font-extrabold flex items-center gap-1 text-orange-850 uppercase tracking-tight text-[11px]">
               Msaada wa Kuingia / Helpful Tip
            </p>
            <p className="leading-relaxed">
              <strong>Kiswahili:</strong> Kama bado hujasajili akaunti hii kwenye mradi mpya wa Firebase, tafadhali bofya <strong>"Jisajili"</strong> (Sign up) hapo chini ili kutengeneza akaunti yako kwanza.
            </p>
            <p className="leading-relaxed">
              <strong>English:</strong> If you have not registered this email on this new Firebase project, please click <strong>"Sign up"</strong> at the bottom to create your credentials first.
            </p>
          </div>
        )}

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-neutral-500 font-medium uppercase">{t('or')}</span>
          </div>
        </div>

        {unauthorizedDomain && (
          <div className="p-4 bg-amber-50 border border-amber-300/80 rounded-2xl space-y-2.5 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-black uppercase tracking-tight text-[11px] text-amber-900">
                  Google Sign-In Inahitaji Kuidhinisha Kikoa (Authorized Domain)
                </p>
                <p className="leading-relaxed text-amber-900/90">
                  Mradi wa Firebase (<strong>{firebaseConfig.projectId}</strong>) haujaongeza kikoa hiki kwenye orodha ya{' '}
                  <strong>Authentication → Settings → Authorized domains</strong>:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl p-2">
              <code className="text-[11px] font-mono text-neutral-800 truncate flex-1">{unauthorizedDomain}</code>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase flex items-center gap-1 shrink-0"
              >
                {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDomain ? 'Imenakiliwa' : 'Nakili'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-amber-800 font-medium">
                💡 Unaweza kuingia au kujisajili kwa <strong>Email na Password</strong> hapo juu mara moja.
              </span>
              <a
                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-black text-orange-700 hover:underline"
              >
                Fungua Firebase Console →
              </a>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button 
            type="button"
            variant="outline" 
            disabled={googleLoading}
            className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold"
            onClick={handleGoogleSignIn}
          >
            {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-red-500" /> : <Chrome className="w-5 h-5 text-red-500" />}
            {t('continue_with_google')}
          </Button>
          <Button 
            type="button"
            variant="outline" 
            onClick={() => toast.info('Tafadhali tumia Barua Pepe au Google kuingia.')}
            className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold"
          >
            <Apple className="w-5 h-5" />
            Continue with Apple
          </Button>
          <Button 
            type="button"
            variant="outline" 
            onClick={() => toast.info('Tafadhali tumia Barua Pepe au Google kuingia.')}
            className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold"
          >
            <Facebook className="w-5 h-5 text-blue-600" />
            Continue with Facebook
          </Button>
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/wakala/login"
              className="py-2.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors"
            >
              <span>Wakala Login</span>
            </Link>
            <Link
              to="/merchant/login"
              className="py-2.5 px-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-cyan-100 transition-colors"
            >
              <span>Merchant POS</span>
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-neutral-600 mt-4">
          {t('dont_have_account')}{' '}
          <Link to="/register" className="text-orange-600 font-bold hover:underline">
            {t('sign_up')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
