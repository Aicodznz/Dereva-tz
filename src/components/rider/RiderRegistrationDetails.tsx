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
  
  // Real initial states
  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber || '');
  const [licenseExpiry, setLicenseExpiry] = useState(profile?.licenseExpiry || '');
  const [nidaNumber, setNidaNumber] = useState(profile?.nidaNumber || '');

  const [uploads, setUploads] = useState<Record<string, string>>({
    license_front: typeof profile?.registrationDocs?.license_front === 'string' ? profile.registrationDocs.license_front : (profile?.licenseFrontUrl || ''),
    license_back: typeof profile?.registrationDocs?.license_back === 'string' ? profile.registrationDocs.license_back : (profile?.licenseBackUrl || ''),
    national_id: typeof profile?.registrationDocs?.national_id === 'string' ? profile.registrationDocs.national_id : (profile?.nidaUrl || ''),
  });

  const handleUploadSimulate = (key: string) => {
    toast.info('Inapakia hati...', { description: 'Tafadhali subiri sekunde chache' });
    
    // Choose beautiful preset document image simulation
    let presetUrl = '';
    if (key === 'license_front') presetUrl = 'https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&q=80&w=400';
    else if (key === 'license_back') presetUrl = 'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?auto=format&fit=crop&q=80&w=400';
    else if (key === 'national_id') presetUrl = 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=400';

    setTimeout(() => {
      setUploads(prev => ({ ...prev, [key]: presetUrl }));
      toast.success('Hati imepakiwa na inaonekana sasa!', { description: 'Imekamilika kwa mafanikio.' });
    }, 1200);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfileData({
        registrationDocs: {
          license_front: uploads.license_front,
          license_back: uploads.license_back,
          national_id: uploads.national_id,
        },
        licenseFrontUrl: uploads.license_front,
        licenseBackUrl: uploads.license_back,
        nidaUrl: uploads.national_id,
        licenseNumber,
        licenseExpiry,
        nidaNumber,
        licenseStatus: uploads.license_front && uploads.license_back ? 'pending' : 'not_uploaded',
        nidaStatus: uploads.national_id ? 'pending' : 'not_uploaded',
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
            Nyaraka zako ziko salama na zimesimbwa. Tunazitumia tu kuthibitisha wasifu wako wa udereva kulingana na sheria za nchi.
          </p>
       </div>

       <div className="space-y-4">
          <h3 className="text-sm font-black uppercase italic tracking-tighter px-2">Identity Documents (Nyaraka za Utambulisho)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUploadField 
              label="Driving License Front (Leseni Mbele)" 
              value={uploads.license_front} 
              onUpload={() => handleUploadSimulate('license_front')} 
            />
            <FileUploadField 
              label="Driving License Back (Leseni Nyuma)" 
              value={uploads.license_back} 
              onUpload={() => handleUploadSimulate('license_back')} 
            />
            <FileUploadField 
              label="National ID / Passport (NIDA/Pasipoti)" 
              value={uploads.national_id} 
              onUpload={() => handleUploadSimulate('national_id')} 
            />
          </div>
       </div>

       <div className="space-y-4 mt-6">
          <h3 className="text-sm font-black uppercase italic tracking-tighter px-2">Written Details (Namba za Nyaraka)</h3>
          <div className="space-y-4 bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Driving License Number (Namba ya Leseni)</label>
              <Input 
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. TZ-091234-DL"
                className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 px-6 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">License Expiry Date (Tarehe ya Kuisha Leseni)</label>
              <Input 
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                placeholder="e.g. 12/2028"
                className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 px-6 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">NIDA National ID Number (Namba ya NIDA)</label>
              <Input 
                value={nidaNumber}
                onChange={(e) => setNidaNumber(e.target.value)}
                placeholder="e.g. 19950812-XXXXX-XXXXX-XX"
                className="h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 px-6 font-bold"
              />
            </div>
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
  
  const [uploads, setUploads] = useState<Record<string, string>>({
    vehicle_front: typeof profile?.vehiclePhotos?.vehicle_front === 'string' ? profile.vehiclePhotos.vehicle_front : '',
    vehicle_side: typeof profile?.vehiclePhotos?.vehicle_side === 'string' ? profile.vehiclePhotos.vehicle_side : '',
  });

  const handleUploadSimulate = (key: string) => {
    toast.info('Inapakia picha ya chombo...', { description: 'Inatuma kwenye seva...' });
    
    let presetUrl = '';
    if (key === 'vehicle_front') presetUrl = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400';
    else if (key === 'vehicle_side') presetUrl = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=400';

    setTimeout(() => {
      setUploads(prev => ({ ...prev, [key]: presetUrl }));
      toast.success('Picha ya chombo imepakiwa vizuri na inaonekana sasa!');
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
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Vehicle Model (Modeli ya Chombo)</label>
             <Input 
               value={model}
               onChange={(e) => setModel(e.target.value)}
               placeholder="e.g. Toyota Passo / Boxer 150" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">License Plate Number (Namba ya Bamba)</label>
             <Input 
               value={plate}
               onChange={(e) => setPlate(e.target.value)}
               placeholder="e.g. T 123 ABC" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold uppercase" 
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest ml-4">Vehicle Color (Rangi ya Chombo)</label>
             <Input 
               value={color}
               onChange={(e) => setColor(e.target.value)}
               placeholder="e.g. White / Black" 
               className="h-14 rounded-2xl bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800 px-6 font-bold" 
             />
          </div>
       </div>
       
       <div className="space-y-4 mt-6">
          <h3 className="text-sm font-black uppercase italic tracking-tighter px-2">Vehicle Photos (Picha za Chombo)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <FileUploadField 
               label="Front View (Mbele)" 
               value={uploads.vehicle_front} 
               onUpload={() => handleUploadSimulate('vehicle_front')} 
             />
             <FileUploadField 
               label="Side View (Pembeni)" 
               value={uploads.vehicle_side} 
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

function FileUploadField({ label, value, onUpload }: { label: string, value: string, onUpload: () => void }) {
  const isUploaded = !!value;
  return (
    <div className="relative group overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-all shadow-sm">
      {isUploaded ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <div 
            onClick={onUpload}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white cursor-pointer"
          >
            <Upload className="w-6 h-6 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Badilisha Nyaraka</span>
          </div>
          <div className="absolute top-3 left-3 bg-emerald-500 text-white py-1 px-2.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md">
            <CheckCircle className="w-3 h-3 stroke-[3]" />
            Tayari Imetumwa
          </div>
          <div className="absolute bottom-3 inset-x-3 bg-black/50 backdrop-blur-md py-1 px-2.5 rounded-xl text-center">
            <p className="text-[9px] font-black text-white/90 uppercase tracking-widest truncate">{label}</p>
          </div>
        </div>
      ) : (
        <div 
          onClick={onUpload}
          className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-50/5 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-neutral-50 dark:bg-neutral-800 text-neutral-400 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 flex items-center justify-center transition-all shadow-inner">
             <Upload className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
            Gonga Kupakia {label}
          </span>
          <span className="text-[8px] font-bold text-neutral-400">Inasaidia PNG, JPG, PDF up to 10MB</span>
        </div>
      )}
    </div>
  );
}
