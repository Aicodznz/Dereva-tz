import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, Calendar, LogOut, Camera, Save, X, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { profile, user, logout, updateProfileData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    email: profile?.email || '',
    phoneNumber: profile?.phoneNumber || '',
    photoURL: profile?.photoURL || ''
  });

  if (!profile) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData(formData);
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    if (isEditing) {
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="text-center py-8 relative">
        <div className="relative inline-block">
          <div 
            className={`w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg mx-auto mb-2 relative group ${isEditing ? 'cursor-pointer' : ''}`}
            onClick={handleImageClick}
          >
            <img 
              src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white mb-1" />
                <span className="text-[10px] text-white font-bold">Badili</span>
              </div>
            )}
          </div>

          {isEditing && formData.photoURL && (
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
        
        {isEditing ? (
          <div className="max-w-xs mx-auto">
            <Input 
              value={formData.displayName} 
              onChange={e => setFormData({...formData, displayName: e.target.value})}
              className="text-center text-xl font-bold bg-white border-neutral-200"
              placeholder="Jina Lako"
            />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-neutral-900">{profile.displayName}</h1>
            <p className="text-neutral-500 capitalize">{profile.role}</p>
          </>
        )}
      </div>

      <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-orange-600" />
            Taarifa Binafsi
          </CardTitle>
          {!isEditing ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              Hariri (Edit)
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    displayName: profile.displayName,
                    email: profile.email,
                    phoneNumber: profile.phoneNumber || '',
                    photoURL: profile.photoURL || ''
                  });
                }}
                className="text-neutral-500 hover:bg-neutral-100"
              >
                <X className="w-4 h-4 mr-1" /> Ghairi
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Hifadhi
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-neutral-400" />
              <div className="flex-1">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">Barua Pepe</p>
                {isEditing ? (
                  <Input 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="bg-neutral-50 border-none h-10"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile.email}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-neutral-400" />
              <div className="flex-1">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">Namba ya Simu</p>
                {isEditing ? (
                  <Input 
                    value={formData.phoneNumber} 
                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                    className="bg-neutral-50 border-none h-10"
                    placeholder="e.g. 0712345678"
                  />
                ) : (
                  <p className="text-sm font-medium">{profile.phoneNumber || 'Hujaweka'}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-neutral-400" />
              <div>
                <p className="text-xs text-neutral-500 uppercase font-bold">Umejiunga</p>
                <p className="text-sm font-medium">
                  {profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Button 
          variant="ghost" 
          onClick={logout}
          className="w-full h-14 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700 justify-start px-6 gap-3"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold">Ondoka (Sign Out)</span>
        </Button>
      </div>
    </div>
  );
}
