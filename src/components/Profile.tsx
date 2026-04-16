import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  LogOut, 
  Camera, 
  Save, 
  X, 
  Loader2, 
  Trash2,
  ShoppingBag,
  MessageCircle,
  MapPin,
  Lock,
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '../LanguageContext';
import MyOrders from './MyOrders';
import Chat from './Chat';
import { updatePassword } from 'firebase/auth';

type ProfileView = 'menu' | 'edit' | 'orders' | 'chat' | 'password' | 'language';

export default function Profile() {
  const { profile, user, logout, updateProfileData } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [view, setView] = useState<ProfileView>('menu');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    email: profile?.email || '',
    phoneNumber: profile?.phoneNumber || '',
    photoURL: profile?.photoURL || ''
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  if (!profile) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData(formData);
      toast.success("Profile updated successfully!");
      setView('menu');
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(user, passwordData.newPassword);
      toast.success("Password updated successfully!");
      setView('menu');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Please sign out and sign in again to change your password for security reasons.");
      } else {
        toast.error("Failed to update password: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    if (view === 'edit') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photoURL: '' });
    toast.info("Picha imeondolewa. Kumbuka kuhifadhi.");
  };

  if (view === 'orders') return <MyOrders onBack={() => setView('menu')} />;
  if (view === 'chat') return <Chat onBack={() => setView('menu')} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header Section */}
      <div className="text-center py-8 relative">
        <div className="relative inline-block">
          <div 
            className={`w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto mb-2 relative group ${view === 'edit' ? 'cursor-pointer' : ''}`}
            onClick={handleImageClick}
          >
            <img 
              src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
              alt="Avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {view === 'edit' && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white mb-1" />
                <span className="text-[10px] text-white font-bold">Badili</span>
              </div>
            )}
          </div>

          {view === 'edit' && formData.photoURL && (
            <Button
              variant="destructive"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePhoto();
              }}
              className="absolute -top-1 -right-1 w-8 h-8 rounded-full shadow-md"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
        
        <h1 className="text-2xl font-bold text-neutral-900">{profile.displayName}</h1>
        <p className="text-neutral-500 capitalize">{profile.role}</p>
      </div>

      {view === 'menu' && (
        <div className="space-y-4">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-2">
              <div className="divide-y divide-neutral-100">
                <button 
                  onClick={() => setView('orders')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('my_orders')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-orange-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('edit')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('edit_profile')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('chat')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('chat')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-green-600 transition-colors" />
                </button>

                <Link 
                  to="/notifications"
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('notifications') || 'Notifications'}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-orange-600 transition-colors" />
                </Link>

                <button 
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('address')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-purple-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('password')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('change_password')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-yellow-600 transition-colors" />
                </button>

                <button 
                  onClick={() => setView('language')}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                      <Globe className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-neutral-700">{t('change_language')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-400 uppercase">{language === 'en' ? 'English' : 'Kiswahili'}</span>
                    <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-teal-600 transition-colors" />
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Button 
            variant="ghost" 
            onClick={logout}
            className="w-full h-14 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700 justify-start px-6 gap-3"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold">{t('sign_out')}</span>
          </Button>
        </div>
      )}

      {view === 'edit' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-orange-600" />
              {t('personal_info')}
            </CardTitle>
            <div className="w-6" /> {/* Spacer */}
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('email')}</label>
                <Input 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('phone')}</label>
                <Input 
                  value={formData.phoneNumber} 
                  onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                  placeholder="e.g. 0712345678"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl"
                onClick={() => setView('menu')}
              >
                {t('cancel')}
              </Button>
              <Button 
                className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'password' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-600" />
              {t('change_password')}
            </CardTitle>
            <div className="w-6" />
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('new_password')}</label>
                <Input 
                  type="password"
                  value={passwordData.newPassword} 
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-bold">{t('confirm_password')}</label>
                <Input 
                  type="password"
                  value={passwordData.confirmPassword} 
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="bg-neutral-50 border-none h-12 rounded-xl"
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold"
              onClick={handleChangePassword}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('update_password')}
            </Button>
          </CardContent>
        </Card>
      )}

      {view === 'language' && (
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
            <button onClick={() => setView('menu')} className="text-neutral-500 hover:text-neutral-800">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-600" />
              {t('change_language')}
            </CardTitle>
            <div className="w-6" />
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <button 
              onClick={() => {
                setLanguage('en');
                toast.success("Language changed to English");
              }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                language === 'en' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src="https://flagcdn.com/w40/gb.png" alt="English" className="w-8 rounded-sm shadow-sm" />
                <span className="font-bold text-neutral-800">English</span>
              </div>
              {language === 'en' && <Check className="w-5 h-5 text-orange-600" />}
            </button>

            <button 
              onClick={() => {
                setLanguage('sw');
                toast.success("Lugha imebadilishwa kuwa Kiswahili");
              }}
              className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                language === 'sw' ? 'border-orange-600 bg-orange-50' : 'border-neutral-100 hover:border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src="https://flagcdn.com/w40/tz.png" alt="Kiswahili" className="w-8 rounded-sm shadow-sm" />
                <span className="font-bold text-neutral-800">Kiswahili</span>
              </div>
              {language === 'sw' && <Check className="w-5 h-5 text-orange-600" />}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
