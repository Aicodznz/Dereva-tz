import React, { useState, useEffect } from 'react';
import { 
  X, MapPin, Plus, Trash2, Home, Briefcase, Dumbbell, 
  GraduationCap, ShoppingBag, Navigation, Check, Edit2, Search, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useTheme } from '../../ThemeContext';
import { 
  SavedAddress, 
  getLocalSavedAddresses, 
  saveCustomerAddress, 
  removeCustomerAddress,
  fetchSavedAddresses
} from '../../utils/customerPreferences';
import LocationPicker from '../LocationPicker';

interface SavedAddressesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (address: string, coords?: { lat: number; lng: number }, mode?: 'destination' | 'pickup') => void;
  userId?: string;
  currentLocationName?: string;
  currentLocationCoords?: [number, number] | null;
}

const CATEGORY_ICONS: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  home: { icon: Home, label: 'Nyumbani', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  work: { icon: Briefcase, label: 'Kazini', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  gym: { icon: Dumbbell, label: 'Gym / Mazoezi', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  school: { icon: GraduationCap, label: 'Chuo / Shule', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  shop: { icon: ShoppingBag, label: 'Duka / Soko', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  custom: { icon: MapPin, label: 'Eneo Maalumu', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
};

export const SavedAddressesModal: React.FC<SavedAddressesModalProps> = ({
  isOpen,
  onClose,
  onSelectAddress,
  userId,
  currentLocationName,
  currentLocationCoords,
}) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [label, setLabel] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [category, setCategory] = useState<SavedAddress['category']>('home');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');

  // Geocoding suggestions
  const [suggestions, setSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // Load addresses on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      const list = getLocalSavedAddresses();
      setAddresses(list);
      fetchSavedAddresses(userId).then(fetched => {
        if (fetched && fetched.length > 0) {
          setAddresses(fetched);
        }
      });
    }
  }, [isOpen, userId]);

  // Listen to address update events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) setAddresses(e.detail);
    };
    window.addEventListener('paporide_addresses_updated', handleUpdate);
    return () => window.removeEventListener('paporide_addresses_updated', handleUpdate);
  }, []);

  // Search geocode when typing address
  const handleAddressSearch = async (query: string) => {
    setAddressInput(query);
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearchingGeo(true);
    try {
      const cleanQ = query.trim();
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(cleanQ)}&limit=5&countrycodes=tz`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
        }
      }
    } catch (err) {
      console.warn('Geocoding search failed in SavedAddressesModal:', err);
    } finally {
      setIsSearchingGeo(false);
    }
  };

  const handleSelectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    setAddressInput(s.display_name);
    setLat(parseFloat(s.lat));
    setLng(parseFloat(s.lon));
    setSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if (currentLocationCoords) {
      setLat(currentLocationCoords[0]);
      setLng(currentLocationCoords[1]);
      setAddressInput(currentLocationName || 'Eneo Nililopo Sasa');
      toast.success('Eneo ulilopo sasa limewekwa!');
    } else {
      toast.error('Hakuna GPS ya eneo lako kwa sasa');
    }
  };

  const handleStartEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setAddressInput(addr.address);
    setCategory(addr.category || 'custom');
    setLat(addr.lat);
    setLng(addr.lng);
    setNotes(addr.notes || '');
    setIsAddingNew(true);
  };

  const handleResetForm = () => {
    setEditingId(null);
    setLabel('');
    setAddressInput('');
    setCategory('home');
    setLat(undefined);
    setLng(undefined);
    setNotes('');
    setSuggestions([]);
    setIsMapPickerOpen(false);
    setIsAddingNew(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Tafadhali weka jina la eneo (mfano: Nyumbani au Kazini)');
      return;
    }
    if (!addressInput.trim()) {
      toast.error('Tafadhali weka anwani kamili ya eneo');
      return;
    }

    try {
      const saved = await saveCustomerAddress(
        {
          id: editingId || undefined,
          label: label.trim(),
          address: addressInput.trim(),
          category,
          lat,
          lng,
          notes: notes.trim() || undefined,
        },
        userId
      );

      toast.success(editingId ? 'Anwani imerekebishwa kikamilifu! ✨' : 'Anwani imehifadhiwa kikamilifu! 📍');
      handleResetForm();
      const updated = getLocalSavedAddresses();
      setAddresses(updated);
    } catch (err) {
      toast.error('Imeshindikana kuhifadhi anwani');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Una uhakika unataka kufuta "${name}"?`)) {
      await removeCustomerAddress(id, userId);
      toast.success(`"${name}" imefutwa.`);
      setAddresses(getLocalSavedAddresses());
    }
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Maeneo Yangu (Saved Addresses)</h3>
              <p className="text-[11px] text-neutral-400 font-semibold">
                Hifadhi nyumbani, kazini na maeneo yako kwa safari za haraka
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
          {/* Top Toggle: Add new address button */}
          {!isAddingNew && (
            <button
              onClick={() => {
                handleResetForm();
                setIsAddingNew(true);
              }}
              className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all group active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Ongeza Anwani Mpya (Add New Address)
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
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-500">
                    {editingId ? 'Hariri Anwani' : 'Anwani Mpya'}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-[11px] font-bold text-neutral-400 hover:text-neutral-200"
                  >
                    Ghairi (Cancel)
                  </button>
                </div>

                {/* Category Picker */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Aina ya Eneo (Category)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {Object.entries(CATEGORY_ICONS).map(([key, cat]) => {
                      const Icon = cat.icon;
                      const isSelected = category === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setCategory(key as any);
                            if (!label || Object.values(CATEGORY_ICONS).some(c => c.label === label)) {
                              setLabel(cat.label);
                            }
                          }}
                          className={`p-2 rounded-xl flex flex-col items-center gap-1 text-[10px] font-bold border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : `${theme === 'dark' ? 'bg-neutral-800/80 border-neutral-700 text-neutral-300' : 'bg-white border-neutral-200 text-neutral-600'} hover:border-indigo-400`
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="truncate max-w-[55px]">{cat.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Label input */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                    Jina la Eneo (Mfano: Nyumbani, Ofisini Posta, Mama Salma)
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="k.m. Nyumbani Mbezi Beach"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                      theme === 'dark'
                        ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-indigo-500'
                        : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-indigo-600'
                    }`}
                  />
                </div>

                {/* Address search / input */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      Anwani Kamili (Street / Location)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                        title="Chagua eneo kwa kutumia ramani"
                      >
                        <MapPin className="w-3 h-3 text-indigo-500" />
                        Chagua kwenye Ramani
                      </button>
                      <span className="text-neutral-300 dark:text-neutral-700 text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                      >
                        <Navigation className="w-3 h-3 text-emerald-500" />
                        Tumia Eneo Nililopo
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder="Tafuta mtaa, kituo au jengo..."
                      className={`w-full pl-8 pr-28 py-2 rounded-xl text-xs font-bold border outline-none ${
                        theme === 'dark'
                          ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-indigo-500'
                          : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-indigo-600'
                      }`}
                    />
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-400" />
                    
                    {/* Action button inside the input field - exactly where the user requested */}
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isSearchingGeo && (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin mr-0.5" />
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shadow-sm ${
                          theme === 'dark'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        title="Chagua eneo hili moja kwa moja kwenye ramani"
                      >
                        <MapPin className="w-3 h-3 text-white" />
                        <span>Ramani</span>
                      </button>
                    </div>
                  </div>

                  {/* Coordinates indicator if location has GPS coords */}
                  {lat && lng && (
                    <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-500" />
                        GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                      >
                        Badili kwenye ramani
                      </button>
                    </div>
                  )}

                  {/* Geocode autocomplete dropdown */}
                  {suggestions.length > 0 && (
                    <div className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl max-h-44 overflow-y-auto ${
                      theme === 'dark' ? 'bg-[#161622] border-neutral-700' : 'bg-white border-neutral-200'
                    }`}>
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className={`w-full text-left p-2.5 border-b last:border-0 text-xs hover:bg-indigo-500/10 flex items-start gap-2 ${
                            theme === 'dark' ? 'border-neutral-800 text-neutral-200' : 'border-neutral-100 text-neutral-800'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{s.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes input */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                    Maelekezo ya Ziada (Hiari - mfano: geti jeusi mbele ya duka)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="k.m. Karibu na kanisa la KKKT, geti jeupe"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                      theme === 'dark'
                        ? 'bg-[#111118] border-neutral-700 text-white placeholder-neutral-500 focus:border-indigo-500'
                        : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-indigo-600'
                    }`}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? 'Hifadhi Mabadiliko' : 'Hifadhi Eneo Hili (Save Address)'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of Saved Addresses */}
          <div className="space-y-2.5">
            {addresses.length === 0 && !isAddingNew ? (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20">
                  <MapPin className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                  Hujasevu eneo lolote bado
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Hifadhi nyumbani, kazini au kituo chako ili uweze kuagiza teksi au usafiri kwa mbofyo 1 tu!
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setCategory('home');
                      setLabel('Nyumbani');
                      setIsAddingNew(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Home className="w-3.5 h-3.5" />
                    + Ongeza Nyumbani
                  </button>
                  <button
                    onClick={() => {
                      setCategory('work');
                      setLabel('Kazini');
                      setIsAddingNew(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    + Ongeza Kazini
                  </button>
                </div>
              </div>
            ) : (
              addresses.map((item) => {
                const catInfo = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.custom;
                const Icon = catInfo.icon;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      theme === 'dark'
                        ? 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                        : 'bg-white border-neutral-200/90 hover:border-neutral-300 shadow-2xs'
                    }`}
                  >
                    {/* Icon + details */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${catInfo.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black tracking-tight truncate">
                            {item.label}
                          </h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full border ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate mt-0.5">
                          {item.address}
                        </p>
                        {item.notes && (
                          <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500 italic mt-0.5 truncate">
                            📝 {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick 1-tap booking actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          onSelectAddress(
                            item.address,
                            item.lat && item.lng ? { lat: item.lat, lng: item.lng } : undefined,
                            'destination'
                          );
                          toast.success(`Eneo la "${item.label}" limewekwa kama unakoelekea! 🚕`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all flex items-center gap-1"
                        title="Agiza usafiri kuelekea eneo hili"
                      >
                        <Navigation className="w-3 h-3" />
                        Nenda Hapa
                      </button>

                      <button
                        onClick={() => {
                          onSelectAddress(
                            item.address,
                            item.lat && item.lng ? { lat: item.lat, lng: item.lng } : undefined,
                            'pickup'
                          );
                          toast.success(`"${item.label}" imewekwa kama mahali ulipo (Pickup)! 📍`);
                          onClose();
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold uppercase transition-all ${
                          theme === 'dark'
                            ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                            : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title="Chagua kama eneo la kuanzia safari"
                      >
                        Mahali Nilipo
                      </button>

                      <button
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                        title="Hariri anwani"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(item.id, item.label)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors"
                        title="Futa anwani"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          <span>Jumla: {addresses.length} {addresses.length === 1 ? 'eneo' : 'maeneo yaliyohifadhiwa'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold hover:opacity-80 transition-opacity"
          >
            Funga
          </button>
        </div>
      </motion.div>

      {/* Interactive Map Picker Modal */}
      <LocationPicker
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        pickerType="pickup"
        title="Chagua Eneo kwenye Ramani"
        subtitle="Gusa au buruta pini kuweka eneo kamili la anwani yako"
        initialLocation={lat && lng ? { lat, lng, address: addressInput } : undefined}
        zIndex="z-[2500]"
        onSelect={(loc) => {
          setAddressInput(loc.address);
          setLat(loc.lat);
          setLng(loc.lng);
          setIsMapPickerOpen(false);
          toast.success('Eneo limechaguliwa kutoka kwenye ramani! 📍');
        }}
      />
    </div>
  );
};
