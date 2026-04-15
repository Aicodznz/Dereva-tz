import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, Eye, EyeOff, Chrome, Facebook, Apple, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

export default function Login() {
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
      toast.success("Welcome back!");
      navigate('/');
    } catch (error: any) {
      console.error('Login error details:', error);
      if (error.message.includes('auth/invalid-credential')) {
        toast.error("Barua pepe au nenosiri si sahihi. Kama huna akaunti, tafadhali jisajili kwanza.");
      } else {
        toast.error(error.message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn();
    navigate('/');
  };

  return (
    <AuthLayout 
      title="Welcome Back!" 
      subtitle="Sign in to your account / Karibu Tena!"
    >
      <form onSubmit={handleEmailLogin} className="space-y-6">
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
            <Input 
              type="email" 
              placeholder="Email Address" 
              className="pl-10 h-12 bg-neutral-50 border-none rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
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
            Forgot Password? / Umesahau nenosiri?
          </Link>
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 rounded-xl text-lg font-bold"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In / Ingia"}
        </Button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-neutral-500 font-medium uppercase">OR / AU</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-neutral-200 gap-3 font-semibold"
            onClick={handleGoogleSignIn}
          >
            <Chrome className="w-5 h-5 text-red-500" />
            Continue with Google
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
          Don't have an account?{' '}
          <Link to="/register" className="text-orange-600 font-bold hover:underline">
            Sign up / Jisajili
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
