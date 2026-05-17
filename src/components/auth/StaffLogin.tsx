import React, { useState, useEffect } from 'react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '../../LanguageContext';

export default function StaffLogin() {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { staffLogin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;

    setLoading(true);
    try {
      await staffLogin(phone.trim(), password);
      toast.success(t('welcome_back') || 'Karibu Kazini!');
      navigate('/');
    } catch (error: any) {
      console.error('Staff Login error:', error);
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Staff Login" 
      subtitle="Karibu Kazini! Ingia kwa kutumia namba yako ya simu."
    >
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
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
              className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-600/20"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Ingia Kazini'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
