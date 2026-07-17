import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Upload, FileText, Landmark, 
  Car, User, Shield, CheckCircle, AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../../AuthContext';
import { toast } from 'sonner';

type RegTab = 'docs' | 'vehicle' | 'bank';

export default function RiderRegistrationDetails({ onBack, initialTab = 'docs' }: { onBack: () => void, initialTab?: RegTab }) {
  const [activeTab, setActiveTab] = useState<RegTab>(initialTab);

  const tabs = [
    { id: 'docs', label: 'Documents', icon: FileText },
    { id: 'vehicle', label: 'Vehicle', icon: Car },
    { id: 'bank', label: 'Bank', icon: Landmark },
  ];

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-36">
      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center border border-neutral-200 dark:border-neutral-800"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </motion.button>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Registration</h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as RegTab)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-[1.5rem] transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[8px] font-black uppercase tracking-widest leading-none">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="space-y-6">
           {activeTab === 'docs' && <DocumentForm />}
           {activeTab === 'vehicle' && <VehicleForm />}
           {activeTab === 'bank' && <BankForm />}
        </div>
      </div>
    </div>
  );
}

function DocumentForm() {
  const { profile, updateProfileData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Record<string, boolean>>({
    license_front: !!profile?.registrationDocs?.license_front,
    license_back: !!profile?.registrationDocs?.license_back,
    national_id: !!profile?.registrationDocs?.national_id,
  });

  const handleUploadSimulate = (key: string) => {
    toast.info('Inapakia hati...', { description: 'Tafadhali subiri sekunde chache' });
    setTimeout(() => {
      setUploads(prev => {
        const next = { ...prev, [key]: true };
        return next;
      });
      toast.success('Hati imepakiwa!', { description: 'Imekamilika kwa mafanikio.' });
    }, 1200);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData({
        registrationDocs: uploads
      });
      toast.success('Nyaraka zimehifadhiwa kikamilifu!', {
        description: 'Tathmini ya uhakiki itafanyika ndani ya masaa 24.'
      });
    } catch (err) {
      toast.error('Imeshindwa kuhifadhi nyaraka.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
       <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 flex gap-4">
          <Shield className="w-8 h-8 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
            Your documents are safe and encrypted. We only use them to verify your driver status according to local laws.
          </p>
       </div>

       <div className="space-y-4">
          <h3 className="text-sm font-black uppercase italic tracking-tighter px-2">Identity Details</h3>
          <div className="space-y-4">
            <FileUploadField 
              label="Driving License (Front)" 
              uploaded={uploads.license_front} 
              onUpload={() => handleUploadSimulate('license_front')} 
            />
            <FileUploadField 
              label="Driving License (Back)" 
              uploaded={uploads.license_back} 
              onUpload={() => handleUploadSimulate('license_back')} 
            />
            <FileUploadField 
              label="National ID / Passport" 
              uploaded={uploads.national_id} 
              onUpload={() => handleUploadSimulate('national_id')} 
            />
          </div>
       </div>

       <Button 
         onClick={handleSave}
         disabled={loading}
         className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-emerald-500/20 mt-8"
       >
          {loading ? 'Inahifadhi...' : 'Save & Update Documents'}
       </Button>
    </motion.div>
  );
}

function VehicleForm() {
  const { profile, updateProfileData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(profile?.vehicleModel || '');
  const [plate, setPlate] = useState(profile?.licensePlate || '');
  const [color, setColor] = useState(profile?.vehicleColor || '');
  
  const [uploads, setUploads] = useState<Record<string, boolean>>({
    vehicle_front: !!profile?.vehiclePhotos?.vehicle_front,
    vehicle_side: !!profile?.vehiclePhotos?.vehicle_side,
  });

  const handleUploadSimulate = (key: string) => {
    toast.info('Inapakia picha ya chombo...', { description: 'Inatuma kwenye seva...' });
    setTimeout(() => {
      setUploads(prev => ({ ...prev, [key]: true }));
      toast.success('Picha imepakiwa vizuri!');
    }, 1200);
  };

  const handleSave = async () => {
    if (!model || !plate) {
      toast.error('Tafadhali jaza jina la chombo na namba ya usajili!');
      return;
    }
    setLoading(true);
    try {
      await updateProfileData({
        vehicleModel: model,
        licensePlate: plate.toUpperCase(),
        vehicleColor: color,
        vehiclePhotos: uploads
      });
      toast.success('Taarifa za chombo zimehifadhiwa vizuri!');
    } catch (err) {
      toast.error('Imeshindwa kuhifadhi taarifa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
       <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Vehicle Model</label>
             <Input 
               value={model}
               onChange={(e) => setModel(e.target.value)}
               placeholder="e.g. Toyota Passo / Boxer 150" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">License Plate Number</label>
             <Input 
               value={plate}
               onChange={(e) => setPlate(e.target.value)}
               placeholder="e.g. T 123 ABC" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold uppercase" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Vehicle Color</label>
             <Input 
               value={color}
               onChange={(e) => setColor(e.target.value)}
               placeholder="e.g. White / Black" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
       </div>
       
       <div className="space-y-4 mt-6">
          <h3 className="text-sm font-black uppercase italic tracking-tighter px-2">Vehicle Photos</h3>
          <div className="grid grid-cols-2 gap-4">
             <FileUploadField 
               label="Front View" 
               uploaded={uploads.vehicle_front} 
               onUpload={() => handleUploadSimulate('vehicle_front')} 
             />
             <FileUploadField 
               label="Side View" 
               uploaded={uploads.vehicle_side} 
               onUpload={() => handleUploadSimulate('vehicle_side')} 
             />
          </div>
       </div>

       <Button 
         onClick={handleSave}
         disabled={loading}
         className="w-full h-16 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-2xl font-black uppercase tracking-widest italic shadow-xl mt-8"
       >
          {loading ? 'Inatuma...' : 'Update Vehicle Info'}
       </Button>
    </motion.div>
  );
}

function BankForm() {
  const { profile, updateProfileData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState(profile?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(profile?.accountNumber || '');
  const [accountHolderName, setAccountHolderName] = useState(profile?.accountHolderName || '');

  const handleSave = async () => {
    if (!bankName || !accountNumber) {
      toast.error('Tafadhali jaza jina la Benki na Namba ya Akaunti!');
      return;
    }
    setLoading(true);
    try {
      await updateProfileData({
        bankName,
        accountNumber,
        accountHolderName
      });
      toast.success('Taarifa za Benki zimehifadhiwa kwa ufanisi!');
    } catch (err) {
      toast.error('Imeshindwa kuhifadhi taarifa za benki.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center py-10">
       <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-900 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-neutral-300">
          <Landmark className="w-12 h-12" />
       </div>
       <h3 className="text-xl font-black italic uppercase tracking-tighter">Bank Details</h3>
       <p className="text-xs text-neutral-500 max-w-xs mx-auto mb-8">
         Manage where you receive your trip payouts and incentives.
       </p>

       <div className="space-y-6 text-left">
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Bank Name</label>
             <Input 
               value={bankName}
               onChange={(e) => setBankName(e.target.value)}
               placeholder="e.g. CRDB Bank / NMB Bank" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Account Number</label>
             <Input 
               value={accountNumber}
               onChange={(e) => setAccountNumber(e.target.value)}
               placeholder="012XXXXXXXX" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Account Holder Name</label>
             <Input 
               value={accountHolderName}
               onChange={(e) => setAccountHolderName(e.target.value)}
               placeholder="Your Full Name" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
       </div>

       <Button 
         onClick={handleSave}
         disabled={loading}
         className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic shadow-xl shadow-emerald-500/20 mt-8"
       >
          {loading ? 'Inahifadhi...' : 'Save Bank Details'}
       </Button>
    </motion.div>
  );
}

function FileUploadField({ label, uploaded, onUpload }: { label: string, uploaded: boolean, onUpload: () => void }) {
  return (
    <div className="relative group" onClick={onUpload}>
       <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 rounded-2xl transition-colors pointer-events-none" />
       <div className={`p-5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
         uploaded 
           ? 'border-emerald-500 bg-emerald-500/5' 
           : 'border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/30'
       }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-inner ${
            uploaded 
              ? 'bg-emerald-500 text-white' 
              : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-400 group-hover:text-emerald-500 group-hover:bg-emerald-50'
          }`}>
             {uploaded ? <CheckCircle className="w-5 h-5 stroke-[2.5]" /> : <Upload className="w-5 h-5" />}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            {label} {uploaded && <span className="text-emerald-600 dark:text-emerald-400">(IMETUMWA)</span>}
          </span>
       </div>
    </div>
  );
}
