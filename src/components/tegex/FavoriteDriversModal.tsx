import React, { useState, useEffect } from 'react';
import { 
  X, Heart, Plus, Trash2, Phone, MessageSquare, Star, 
  Car, ShieldCheck, Check, Edit2, Sparkles, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useTheme } from '../../ThemeContext';
import { 
  FavoriteDriver, 
  getLocalFavoriteDrivers, 
  saveCustomerFavoriteDriver, 
  removeCustomerFavoriteDriver,
  fetchFavoriteDrivers
} from '../../utils/customerPreferences';

interface FavoriteDriversModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDriverForBooking?: (driver: FavoriteDriver) => void;
  userId?: string;
}

const VEHICLE_CONFIGS: Record<string, { label: string; iconEmoji: string; color: string }> = {
  mini: { label: 'Gari / Taxi', iconEmoji: '🚗', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  bajaj: { label: 'Bajaji', iconEmoji: '🛺', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  bike: { label: 'Boda Boda', iconEmoji: '🏍️', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
};

export const FavoriteDriversModal: React.FC<FavoriteDriversModalProps> = ({
  isOpen,
  onClose,
  onSelectDriverForBooking,
  userId,
}) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const [drivers, setDrivers] = useState<FavoriteDriver[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<'mini' | 'bajaj' | 'bike' | string>('mini');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState('');

  // Load drivers on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      const list = getLocalFavoriteDrivers();
      setDrivers(list);
      fetchFavoriteDrivers(userId).then(fetched => {
        if (fetched && fetched.length > 0) {
          setDrivers(fetched);
        }
      });
    }
  }, [isOpen, userId]);

  // Listen to favorite driver update events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) setDrivers(e.detail);
    };
    window.addEventListener('paporide_drivers_updated', handleUpdate);
    return () => window.removeEventListener('paporide_drivers_updated', handleUpdate);
  }, []);

  const handleResetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setVehicleType('mini');
    setVehiclePlate('');
    setVehicleModel('');
    setVehicleColor('');
    setRating(5);
    setNotes('');
    setIsAddingNew(false);
  };

  const handleStartEdit = (drv: FavoriteDriver) => {
    setEditingId(drv.id);
    setName(drv.name);
    setPhone(drv.phone);
    setVehicleType(drv.vehicleType || 'mini');
    setVehiclePlate(drv.vehiclePlate || '');
    setVehicleModel(drv.vehicleModel || '');
    setVehicleColor(drv.vehicleColor || '');
    setRating(drv.rating || 5);
    setNotes(drv.notes || '');
    setIsAddingNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tafadhali weka jina la dereva');
      return;
    }
    if (!phone.trim()) {
      toast.error('Tafadhali weka namba ya simu ya dereva');
      return;
    }

    try {
      await saveCustomerFavoriteDriver(
        {
          id: editingId || undefined,
          name: name.trim(),
          phone: phone.trim(),
          vehicleType,
          vehiclePlate: vehiclePlate.trim().toUpperCase() || 'T 000 AAA',
          vehicleModel: vehicleModel.trim() || undefined,
          vehicleColor: vehicleColor.trim() || undefined,
          rating,
          notes: notes.trim() || undefined,
        },
        userId
      );

      toast.success(editingId ? 'Taarifa za dereva zimesasishwa! ✨' : 'Dereva ameongezwa kwenye pendwa zako! ❤️');
      handleResetForm();
      setDrivers(getLocalFavoriteDrivers());
    } catch (err) {
      toast.error('Imeshindikana kuhifadhi dereva');
    }
  };

  const handleDelete = async (id: string, driverName: string) => {
    if (window.confirm(`Una uhakika unataka kuondoa "${driverName}" kwenye madereva unaowapenda?`)) {
      await removeCustomerFavoriteDriver(id, userId);
      toast.success(`"${driverName}" ameondolewa.`);
      setDrivers(getLocalFavoriteDrivers());
    }
  };

  const formatCleanPhone = (p: string) => {
    let clean = p.replace(/\s+/g, '').replace(/-/g, '');
    if (clean.startsWith('0')) {
      clean = '255' + clean.substring(1);
    } else if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    return clean;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          theme === 'dark' ? 'bg-[#111118] border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          theme === 'dark' ? 'border-neutral-800 bg-[#161622]' : 'border-neutral-100 bg-neutral-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Madereva Ninaowapenda (Favorite Drivers)</h3>
              <p className="text-[11px] text-neutral-400 font-semibold">
                Orodha ya madereva wako unaowaamini na kuwapenda zaidi
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleResetForm();
              onClose();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top Toggle: Add new favorite driver button */}
          {!isAddingNew && (
            <button
              onClick={() => {
                handleResetForm();
                setIsAddingNew(true);
              }}
              className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-rose-500/40 hover:border-rose-500 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all group active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Ongeza Dereva Unayempenda (Add Favorite Driver)
            </button>
          )}

          {/* Form to Add or Edit */}
          <AnimatePresence>
            {isAddingNew && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSave}
                className={`p-4 rounded-2xl border space-y-3.5 ${
                  theme === 'dark' ? 'bg-neutral-900/90 border-neutral-800' : 'bg-neutral-50/90 border-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-500">
                    {editingId ? 'Hariri Dereva' : 'Dereva Mpya Anayependwa'}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-[11px] font-bold text-neutral-400 hover:text-neutral-200"
                  >
                    Ghairi (Cancel)
                  </button>
                </div>

                {/* Vehicle Type Picker */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Aina ya Usafiri wa Dereva
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(VEHICLE_CONFIGS).map(([key, v]) => {
                      const isSelected = vehicleType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setVehicleType(key)}
                          className={`p-2 rounded-xl flex items-center justify-center gap-2 text-xs font-black border transition-all ${
                            isSelected
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : `${theme === 'dark' ? 'bg-neutral-800/80 border-neutral-700 text-neutral-300' : 'bg-white border-neutral-200 text-neutral-600'} hover:border-rose-400`
                          }`}
                        >
                          <span className="text-base">{v.iconEmoji}</span>
                          <span>{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                      Jina Kamili la Dereva *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="k.m. Rashid Bakari"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                        theme === 'dark'
                          ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-rose-500'
                          : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-rose-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                      Namba ya Simu *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="k.m. 0712 345 678"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                        theme === 'dark'
                          ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-rose-500'
                          : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-rose-600'
                      }`}
                    />
                  </div>
                </div>

                {/* Vehicle Plate & Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                      Namba ya Namba ya Gari/Boda/Bajaji
                    </label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder="k.m. T 842 DKP"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider font-mono border outline-none ${
                        theme === 'dark'
                          ? 'bg-[#111118] border-neutral-700 text-amber-400 placeholder-neutral-500 focus:border-rose-500'
                          : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-rose-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                      Model ya Chombo (Gari/Chombo)
                    </label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="k.m. Toyota IST / Boxer / TVS King"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                        theme === 'dark'
                          ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-rose-500'
                          : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-rose-600'
                      }`}
                    />
                  </div>
                </div>

                {/* Rating stars picker */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                    Kiwango cha Ubora (Rating)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="p-1 active:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= rating ? 'fill-amber-500 text-amber-500' : 'text-neutral-300 dark:text-neutral-700'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-amber-500 ml-2">{rating}.0 / 5.0</span>
                  </div>
                </div>

                {/* Notes input */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                    Maoni / Sababu ya Kumpenda (Hiari)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="k.m. Anajua njia nzuri, mstaarabu na anafika kwa haraka"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                      theme === 'dark'
                        ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-rose-500'
                        : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-rose-600'
                    }`}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Hifadhi Mabadiliko' : 'Hifadhi Dereva Huyu (Save Favorite Driver)'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Favorite Drivers */}
          <div className="space-y-3">
            {drivers.length === 0 && !isAddingNew ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                  <Heart className="w-7 h-7 fill-rose-500/50" />
                </div>
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  Huna dereva unayempenda bado
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Ukisafiri na dereva mzuri, mwaminifu na mstaarabu, mhifadhi hapa ili upate naye safari za kipaumbele au kuwasiliana naye moja kwa moja!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      handleResetForm();
                      setIsAddingNew(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    + Ongeza Dereva Wangu wa Kwanza
                  </button>
                </div>
              </div>
            ) : (
              drivers.map((drv) => {
                const vehicleConfig = VEHICLE_CONFIGS[drv.vehicleType] || VEHICLE_CONFIGS.mini;
                const cleanPhone = formatCleanPhone(drv.phone);

                return (
                  <div
                    key={drv.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all hover:shadow-md flex flex-col gap-3 ${
                      theme === 'dark'
                        ? 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                        : 'bg-white border-neutral-200/90 hover:border-neutral-300 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Avatar, Name, Rating & Badges */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 border-rose-500 flex items-center justify-center text-lg font-black ${
                            theme === 'dark' ? 'bg-neutral-800 text-neutral-200' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {drv.photo ? (
                              <img src={drv.photo} alt={drv.name} className="w-full h-full object-cover" />
                            ) : (
                              drv.name.charAt(0)
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center shadow-sm text-xs">
                            {vehicleConfig.iconEmoji}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-black tracking-tight truncate">
                              {drv.name}
                            </h4>
                            <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-md text-[10px] font-black shrink-0 border border-amber-500/20">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>{drv.rating ? drv.rating.toFixed(1) : '5.0'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-amber-400 text-neutral-950 font-mono font-black text-[9.5px] px-1.5 py-0.5 rounded border border-amber-500 shadow-2xs leading-none">
                              {drv.vehiclePlate}
                            </span>
                            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 truncate">
                              {drv.vehicleModel || vehicleConfig.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Edit / Delete small menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(drv)}
                          className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="Hariri taarifa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(drv.id, drv.name)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors"
                          title="Ondoa kwenye pendwa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Driver Notes if any */}
                    {drv.notes && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic bg-neutral-100/70 dark:bg-neutral-800/40 p-2 rounded-xl">
                        💬 "{drv.notes}"
                      </p>
                    )}

                    {/* Bottom Action Buttons: Agiza Safari Naye | Piga Simu | WhatsApp */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      {/* Book With Driver */}
                      {onSelectDriverForBooking && (
                        <button
                          onClick={() => {
                            onSelectDriverForBooking(drv);
                            toast.success(`Safari itaombwa kupitia dereva wako mpendwa: ${drv.name}! 🚕❤️`);
                            onClose();
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Agiza Safari Naye</span>
                        </button>
                      )}

                      {/* Call direct */}
                      <a
                        href={`tel:${drv.phone}`}
                        className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                        title="Piga Simu Moja kwa Moja"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Piga Simu</span>
                      </a>

                      {/* WhatsApp direct */}
                      <a
                        href={`https://wa.me/${cleanPhone}?text=Habari%20${encodeURIComponent(drv.name)},%20nimepata%20namba%20yako%20kupitia%20PapoRide.%20Je,%20upo%20tayari%20kwa%20safari?`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                        title="Tuma Ujumbe WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-3.5 border-t flex items-center justify-between text-[11px] text-neutral-400 ${
          theme === 'dark' ? 'border-neutral-800 bg-[#14141e]' : 'border-neutral-100 bg-neutral-50'
        }`}>
          <span>Jumla: {drivers.length} {drivers.length === 1 ? 'dereva mpendwa' : 'madereva unaowapenda'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold hover:opacity-80 transition-opacity"
          >
            Funga
          </button>
        </div>
      </motion.div>
    </div>
  );
};
