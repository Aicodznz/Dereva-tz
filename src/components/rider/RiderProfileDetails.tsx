import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, Phone, Mail, Camera, Save, CheckCircle, Lock, Eye, EyeOff, Upload } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';
import { storageService } from '../../services/storageService';

export default function RiderProfileDetails({ onBack }: { onBack: () => void }) {
  const { profile, user, updateProfileData, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '0712345678');
  const [email, setEmail] = useState(profile?.email || '');
  const [city, setCity] = useState(profile?.city || 'Dar es Salaam');
  const [gender, setGender] = useState(profile?.gender || 'Mwanaume');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarPresets = [
    { seed: 'Moses', label: 'Moses' },
    { seed: 'Sarah', label: 'Sarah' },
    { seed: 'Alex', label: 'Alex' },
    { seed: 'Mia', label: 'Mia' },
    { seed: 'Leo', label: 'Leo' },
    { seed: 'Emma', label: 'Emma' },
    { seed: 'Tzee', label: 'Tzee' },
    { seed: 'Driver', label: 'Captain' }
  ];

  const handleSelectAvatar = (seed: string) => {
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    setPhotoURL(url);
    setShowAvatarPicker(false);
    toast.success('Picha ya wasifu imeteuliwa!', {
      description: 'Bonyeza "Hifadhi Mabadiliko" chini kukamilisha.',
      duration: 2000,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setLoading(true);
      try {
        const path = storageService.getProfilePath(user.uid, file.name);
        const publicUrl = await storageService.uploadFile('profiles', path, file);
        
        setPhotoURL(publicUrl);
        await updateProfileData({ photoURL: publicUrl });
        toast.success("Picha ya wasifu imepakiwa vizuri!");
      } catch (error: any) {
        toast.error("Imeshindwa kupakia picha: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Tafadhali jaza nenosiri jipya na uthibitishe!');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Manenosiri hayafanani!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Nenosiri lazima liwe na herufi 6 au zaidi!');
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      toast.success('Nenosiri limebadilishwa kikamilifu!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Imeshindwa kubadili nenosiri: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfileData({
        displayName: name,
        phone: phone,
        city: city,
        gender: gender,
        photoURL: photoURL,
      });
      toast.success('Wasifu Umesahihishwa!', {
        description: 'Taarifa zako zimehifadhiwa kikamilifu kwenye mfumo.',
        duration: 3000,
      });
      onBack();
    } catch (err) {
      console.error(err);
      toast.error('Imeshindwa kusasisha wasifu. Tafadhali jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] leading-none block mb-0.5">WASIFU</span>
          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200 leading-none">Hariri Taarifa Zako</span>
        </div>
      </div>

      {/* Profile Picture Upload Section */}
      <div className="flex flex-col items-center justify-center py-4 relative">
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer border-0 bg-transparent outline-none"
            title="Pakia Picha kutoka Kifaa chako"
          >
            <div className="w-28 h-28 rounded-[2.5rem] border-4 border-emerald-500/20 p-1 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-lg group-hover:scale-105 transition-all">
              <img 
                src={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email || 'driver'}`} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-[2rem]"
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2.5 rounded-2xl shadow-lg border-2 border-white dark:border-neutral-900 active:scale-90 transition-all">
              <Camera className="w-4 h-4" />
            </div>
          </button>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] font-black text-emerald-600 hover:text-emerald-500 uppercase tracking-widest flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Pakia Picha
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <button
            type="button"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="text-[10px] font-black text-neutral-400 hover:text-neutral-500 uppercase tracking-widest"
          >
            Chagua Avatar
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />

        {/* Avatar presets grid */}
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-neutral-900 p-5 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 mt-4 space-y-3 shadow-md"
          >
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">Chagua Picha ya Avatar</span>
              <button 
                type="button" 
                onClick={() => setShowAvatarPicker(false)} 
                className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
              >
                Funga
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {avatarPresets.map((p) => (
                <button
                  key={p.seed}
                  type="button"
                  onClick={() => handleSelectAvatar(p.seed)}
                  className="flex flex-col items-center gap-1 p-1 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 transition-all active:scale-95"
                >
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seed}`} 
                    alt={p.label} 
                    className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800"
                  />
                  <span className="text-[9px] font-bold text-neutral-600 dark:text-neutral-400">{p.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Profile Details Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 space-y-6 shadow-sm">
          {/* Name Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Jina Kamili</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                placeholder="Ingiza jina lako kamili"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Namba ya Simu</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                placeholder="e.g. 0712345678"
              />
            </div>
          </div>

          {/* Email Field (Disabled) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4 opacity-50">Barua Pepe (Email)</label>
            <div className="relative opacity-60">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input 
                type="email" 
                value={email}
                disabled
                className="w-full h-14 pl-12 pr-6 rounded-2xl bg-neutral-100 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 outline-none font-bold text-sm text-neutral-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Grid fields for City & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Mkoa / Jiji</label>
              <select 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-14 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
              >
                <option value="Dar es Salaam">Dar es Salaam</option>
                <option value="Zanzibar">Zanzibar</option>
                <option value="Arusha">Arusha</option>
                <option value="Mwanza">Mwanza</option>
                <option value="Dodoma">Dodoma</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Jinsia</label>
              <select 
                value={gender} 
                onChange={(e) => setGender(e.target.value)}
                className="w-full h-14 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
              >
                <option value="Mwanaume">Mwanaume</option>
                <option value="Mwanamke">Mwanamke</option>
              </select>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <Lock className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-black uppercase italic tracking-tighter">Badili Nenosiri (Change Password)</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Nenosiri Jipya (New Password)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                  placeholder="Ingiza nenosiri jipya"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Thibitisha Nenosiri (Confirm Password)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 focus:border-emerald-500 outline-none font-bold text-sm text-neutral-800 dark:text-neutral-200"
                  placeholder="Thibitisha nenosiri jipya"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={loading}
              className="h-12 px-6 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Sasisha Nenosiri
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
        </button>
      </form>
    </div>
  );
}
