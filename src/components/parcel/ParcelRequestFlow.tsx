import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, FileText, Smartphone, Box, Pill, Dog, 
  User, Phone, ChevronRight, ArrowLeft, 
  Clock, CreditCard, ShieldCheck, Info, AlertTriangle, Search, Map
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { ParcelCategory } from '../../types/parcel';
import { toast } from 'sonner';
import LocationPicker from '../LocationPicker';

const categoryConfig: Record<string, { 
  title: string, 
  icon: any, 
  color: string, 
  baseFare: number,
  desc: string,
  type: ParcelCategory
}> = {
  gifts: { title: 'Zawadi', icon: Package, color: 'bg-pink-500', baseFare: 5000, desc: 'Tuma zawadi kwa uangalifu mkubwa.', type: 'gift' },
  documents: { title: 'Hati', icon: FileText, color: 'bg-blue-500', baseFare: 3000, desc: 'Uwasilishaji wa haraka wa nyaraka.', type: 'document' },
  electronics: { title: 'Elektroniki', icon: Smartphone, color: 'bg-amber-500', baseFare: 7000, desc: 'Vifaa vya kielektroniki, salama zaidi.', type: 'electronics' },
  package: { title: 'Kifurushi', icon: Box, color: 'bg-neutral-500', baseFare: 4000, desc: 'Mzigo wowote, mdogo au mkubwa.', type: 'package' },
  medicines: { title: 'Dawa', icon: Pill, color: 'bg-red-500', baseFare: 2500, desc: 'Dawa muhimu, kwa haraka zaidi.', type: 'medicine' },
  pet_supplies: { title: 'Mifugo', icon: Dog, color: 'bg-green-500', baseFare: 6000, desc: 'Chakula na vifaa vya wanyama.', type: 'pet_supplies' }
};

const ParcelRequestFlow: React.FC = () => {
  const { category = 'package' } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const config = categoryConfig[category] || categoryConfig.package;
  const Icon = config.icon;

  const [formData, setFormData] = useState({
    sender: { name: '', phone: '', address: '', notes: '', lat: -6.7924, lng: 39.2083 },
    recipient: { name: '', phone: '', address: '', notes: '', lat: -6.8124, lng: 39.2283 },
    categoryDetails: { weight: '1-5kg', isFragile: false, requiresCold: false }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState<{ type: 'sender' | 'recipient', isOpen: boolean }>({ type: 'sender', isOpen: false });

  const handleLocationSelect = (loc: { address: string; lat: number; lng: number }) => {
    if (showLocationPicker.type === 'sender') {
      setFormData({
        ...formData,
        sender: {
          ...formData.sender,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng
        }
      });
    } else {
      setFormData({
        ...formData,
        recipient: {
          ...formData.recipient,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng
        }
      });
    }
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Tafadhali ingia kwenye akaunti kwanza');
      return;
    }

    setIsSubmitting(true);
    try {
      const parcelData = {
        customerId: user.uid,
        status: 'pending',
        category: config.type,
        categoryDetails: formData.categoryDetails,
        sender: formData.sender,
        recipient: formData.recipient,
        pricing: {
          baseFare: config.baseFare,
          distanceFare: 2500,
          categoryFee: 500,
          total: config.baseFare + 2500 + 500,
          partnerEarnings: (config.baseFare + 2500 + 500) * 0.8
        },
        timestamps: {
          createdAt: serverTimestamp()
        }
      };

      await addDoc(collection(db, 'parcels'), parcelData);
      toast.success('Ombi lako limetumwa! Rider atapatikana hivi punde.');
      navigate('/');
    } catch (error) {
      console.error('Error creating parcel job:', error);
      toast.error('Hitilafu ilitokea. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 font-sans">
      {/* Header */}
      <div className="p-6 flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-900 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl z-50">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
            <ArrowLeft size={18} />
        </button>
        <div>
           <h1 className="text-lg font-black tracking-tight uppercase italic">Safirisha {config.title}</h1>
           <div className="flex items-center gap-2">
              <div className="h-1 flex-1 bg-neutral-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: `${(step/3) * 100}%` }}
                    className={`h-full ${config.color}`} 
                 />
              </div>
              <span className="text-[10px] font-bold text-neutral-400">STEP {step}/3</span>
           </div>
        </div>
      </div>

      <div className="p-6 max-w-xl mx-auto overflow-x-hidden">
        <LocationPicker 
          isOpen={showLocationPicker.isOpen}
          onClose={() => setShowLocationPicker({ ...showLocationPicker, isOpen: false })}
          onSelect={handleLocationSelect}
          useParcelIcon={true}
          initialLocation={
            showLocationPicker.type === 'sender' 
              ? { lat: formData.sender.lat, lng: formData.sender.lng, address: formData.sender.address }
              : { lat: formData.recipient.lat, lng: formData.recipient.lng, address: formData.recipient.address }
          }
        />
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               <div className="bg-neutral-50 dark:bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-100 dark:border-neutral-800">
                  <div className={`w-16 h-16 ${config.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl`}>
                     <Icon size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic">Taarifa za Mtumaji</h2>
                  <p className="text-sm text-neutral-400 mt-2">{config.desc}</p>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Jina lako</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Ally Hamisi"
                      className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                      value={formData.sender.name}
                      onChange={e => setFormData({ ...formData, sender: { ...formData.sender, name: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Namba ya Simu</label>
                    <input 
                      type="tel" 
                      placeholder="07XX XXX XXX"
                      className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                      value={formData.sender.phone}
                      onChange={e => setFormData({ ...formData, sender: { ...formData.sender, phone: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Mahali (Pickup Address)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
                          <Package className="text-white" size={14} />
                        </div>
                        <input 
                          type="text" 
                          placeholder="e.g. Masaki, Dar es Salaam"
                          className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl pl-14 pr-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                          value={formData.sender.address}
                          onChange={e => setFormData({ ...formData, sender: { ...formData.sender, address: e.target.value } })}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowLocationPicker({ type: 'sender', isOpen: true })}
                        className="w-14 h-14 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center shrink-0 shadow-lg active:scale-95 transition-transform"
                      >
                        <Map size={20} />
                      </button>
                    </div>
                  </div>
               </div>

               <button 
                onClick={handleNext}
                disabled={!formData.sender.name || !formData.sender.phone || !formData.sender.address}
                className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black py-5 rounded-[2rem] font-black tracking-widest uppercase shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all"
               >
                 ENDELEA <ChevronRight size={20} />
               </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
               <div className="bg-neutral-50 dark:bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-100 dark:border-neutral-800">
                  <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-2xl">
                     <User size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter italic">Taarifa za Mpokeaji</h2>
                  <p className="text-sm text-neutral-400 mt-2">Nani anapokea kifurushi hiki?</p>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Jina la Mpokeaji</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Grace John"
                      className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                      value={formData.recipient.name}
                      onChange={e => setFormData({ ...formData, recipient: { ...formData.recipient, name: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Namba ya Simu</label>
                    <input 
                      type="tel" 
                      placeholder="07XX XXX XXX"
                      className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                      value={formData.recipient.phone}
                      onChange={e => setFormData({ ...formData, recipient: { ...formData.recipient, phone: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Atapokelea wapi?</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
                          <Package className="text-white" size={14} />
                        </div>
                        <input 
                          type="text" 
                          placeholder="e.g. Sinza Kijiweni"
                          className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl pl-14 pr-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold"
                          value={formData.recipient.address}
                          onChange={e => setFormData({ ...formData, recipient: { ...formData.recipient, address: e.target.value } })}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowLocationPicker({ type: 'recipient', isOpen: true })}
                        className="w-14 h-14 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center shrink-0 shadow-lg active:scale-95 transition-transform"
                      >
                        <Map size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Maelezo ya ziada</label>
                    <textarea 
                      placeholder="e.g. Panda ghorofa ya 2, mlango wa kulia"
                      className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 font-bold h-24 resize-none"
                      value={formData.recipient.notes}
                      onChange={e => setFormData({ ...formData, recipient: { ...formData.recipient, notes: e.target.value } })}
                    />
                  </div>
               </div>

               <div className="flex gap-4">
                  <button onClick={handlePrev} className="px-8 bg-neutral-100 dark:bg-neutral-900 font-black rounded-[2rem] uppercase tracking-widest text-[10px]">RUDI</button>
                  <button 
                    onClick={handleNext}
                    disabled={!formData.recipient.name || !formData.recipient.phone || !formData.recipient.address}
                    className="flex-1 bg-neutral-900 dark:bg-white text-white dark:text-black py-5 rounded-[2rem] font-black tracking-widest uppercase shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
                  >
                    THIBITISHA <ChevronRight size={20} />
                  </button>
               </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-8"
            >
               <div className="bg-neutral-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Package size={120} />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic relative z-10">Muhtasari wa Malipo</h2>
                  <div className="mt-6 flex items-baseline gap-2 relative z-10">
                     <span className="text-lg font-bold opacity-50 uppercase tracking-widest">TZS</span>
                     <span className="text-5xl font-black">{(config.baseFare + 2500 + 500).toLocaleString()}</span>
                  </div>
                  <p className="text-white/40 text-[10px] mt-2 font-bold uppercase tracking-widest relative z-10">Inajumuisha: Bima + Usafiri + Kasi</p>
               </div>

               <div className="space-y-4">
                  <div className="bg-neutral-50 dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800">
                     <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Clock size={20} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Muda wa Kufika</p>
                           <p className="font-bold text-neutral-900 dark:text-white">Takriban Dakika 45</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Usalama</p>
                           <p className="font-bold text-neutral-900 dark:text-white">Kifurushi kimekadiriwa bima</p>
                        </div>
                     </div>
                  </div>

                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex gap-4">
                    <Info className="text-blue-500 shrink-0" size={20} />
                    <p className="text-xs text-blue-900/60 dark:text-blue-100/40 font-medium">
                      Kwa kubonyeza "AGIZA SASA", unakubaliana na vigezo na masharti ya usafirishaji wa SwiftApp.
                    </p>
                  </div>
               </div>

               <div className="flex gap-4">
                  <button onClick={handlePrev} className="px-8 bg-neutral-100 dark:bg-neutral-900 font-black rounded-[2rem] uppercase tracking-widest text-[10px]">RUDI</button>
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-orange-600 text-white py-5 rounded-[2rem] font-black tracking-widest uppercase shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 transition-all"
                  >
                    {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>AGIZA SASA <ChevronRight size={20} /></>
                    )}
                  </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ParcelRequestFlow;
