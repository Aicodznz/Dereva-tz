import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Smartphone, Sparkles, Upload, Palette,
  Check, ArrowRight, Video, Image as ImageIcon, Film, Play,
  Sliders, Layers, Eye, Save, MoveHorizontal, Grid, Search,
  Bell, MapPin, ChevronRight, Wifi, Battery, ShoppingBag, 
  Utensils, Pill, Package, Car, Scissors, Ticket, Printer, Bus,
  Home, RefreshCw, Radio
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppModule, QuickAccessCard, GlobalAppModulesSettings } from '../../types/widgetCanvas';
import { toast } from 'sonner';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const INITIAL_MODULES: AppModule[] = [
  {
    id: 'module-grocery',
    name: 'Grocery',
    featureVertical: 'grocery',
    iconUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    gradientDirection: 'to bottom',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#047857',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qc-1', title: 'Fresh Veggies', type: 'category', link: '/category/veg', iconUrl: '🥦', active: true },
      { id: 'qc-2', title: 'Milk & Dairy', type: 'category', link: '/category/dairy', iconUrl: '🥛', active: true },
      { id: 'qc-3', title: 'Snacks & Soda', type: 'category', link: '/category/snacks', iconUrl: '🍿', active: true },
      { id: 'qc-4', title: 'Flours & Grain', type: 'category', link: '/category/flour', iconUrl: '🌾', active: true },
      { id: 'qc-5', title: 'Mega Deals 50%', type: 'custom', link: '/deals', iconUrl: '🔥', active: true }
    ]
  },
  {
    id: 'module-food',
    name: 'Food',
    featureVertical: 'food',
    iconUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#ea580c',
    secondaryColor: '#f97316',
    gradientDirection: 'to bottom right',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#c2410c',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qf-1', title: 'Pizza & Pasta', type: 'category', link: '/food/pizza', iconUrl: '🍕', active: true },
      { id: 'qf-2', title: 'Burgers & Fries', type: 'category', link: '/food/burgers', iconUrl: '🍔', active: true },
      { id: 'qf-3', title: 'Biryani & Rice', type: 'category', link: '/food/rice', iconUrl: '🍚', active: true },
      { id: 'qf-4', title: 'BBQ & Nyama', type: 'category', link: '/food/bbq', iconUrl: '🍖', active: true },
    ]
  },
  {
    id: 'module-pharmacy',
    name: 'Pharmacy',
    featureVertical: 'pharmacy',
    iconUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#0284c7',
    secondaryColor: '#38bdf8',
    gradientDirection: 'to bottom',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#0369a1',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qp-1', title: 'Prescription Upload', type: 'custom', link: '/rx-upload', iconUrl: '💊', active: true },
      { id: 'qp-2', title: 'Baby Care', type: 'category', link: '/baby', iconUrl: '🍼', active: true },
      { id: 'qp-3', title: 'First Aid Kit', type: 'category', link: '/first-aid', iconUrl: '🩹', active: true },
    ]
  },
  {
    id: 'module-ramadan',
    name: 'Ramadan Special',
    featureVertical: 'grocery',
    iconUrl: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#7c3aed',
    secondaryColor: '#a855f7',
    gradientDirection: 'to right',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#6d28d9',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qr-1', title: 'Dates & Tambi', type: 'category', link: '/dates', iconUrl: '🌴', active: true },
      { id: 'qr-2', title: 'Iftar Packages', type: 'custom', link: '/iftar', iconUrl: '🌙', active: true },
      { id: 'qr-3', title: 'Halal Meat', type: 'category', link: '/halal', iconUrl: '🥩', active: true },
    ]
  },
  {
    id: 'module-ride',
    name: 'PapoRide',
    featureVertical: 'taxi',
    iconUrl: 'https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'solid',
    primaryColor: '#0f172a',
    secondaryColor: '#1e293b',
    gradientDirection: 'to bottom',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#0f172a',
    horizontalScrollLayout: false,
    quickCards: [
      { id: 'qrd-1', title: 'Gari (Taxi)', type: 'custom', link: '/taxi', iconUrl: '🚗', active: true },
      { id: 'qrd-2', title: 'Bajaji 3-Wheeler', type: 'custom', link: '/bajaj', iconUrl: '🛺', active: true },
      { id: 'qrd-3', title: 'Boda Express', type: 'custom', link: '/boda', iconUrl: '🏍️', active: true },
    ]
  },
  {
    id: 'module-send',
    name: 'PapoSend',
    featureVertical: 'parcel',
    iconUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#b91c1c',
    secondaryColor: '#ef4444',
    gradientDirection: 'to bottom right',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#991b1b',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qs-1', title: 'Nyaraka & Barua', type: 'custom', link: '/parcel-doc', iconUrl: '📄', active: true },
      { id: 'qs-2', title: 'Vifurushi & Boksi', type: 'custom', link: '/parcel-box', iconUrl: '📦', active: true },
      { id: 'qs-3', title: 'House Shifting 🚚', type: 'custom', link: '/house-moving', iconUrl: '🚛', active: true },
    ]
  },
  {
    id: 'module-print',
    name: 'PapoPrint',
    featureVertical: 'print',
    iconUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#4f46e5',
    secondaryColor: '#6366f1',
    gradientDirection: 'to bottom',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#4338ca',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qpr-1', title: 'Document Print', type: 'custom', link: '/print', iconUrl: '🖨️', active: true },
      { id: 'qpr-2', title: 'Binding & Spiral', type: 'custom', link: '/print', iconUrl: '📚', active: true },
      { id: 'qpr-3', title: 'Stickers & Labels', type: 'custom', link: '/print', iconUrl: '🏷️', active: true },
    ]
  },
  {
    id: 'module-events',
    name: 'PapoTicket',
    featureVertical: 'events',
    iconUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=120&q=80',
    active: true,
    headerBgType: 'gradient_2_color',
    primaryColor: '#09090b',
    secondaryColor: '#27272a',
    gradientDirection: 'to bottom',
    cardsBgMediaType: 'none',
    cardsBgMediaUrl: '',
    stickyHeaderPinnedColor: '#18181b',
    horizontalScrollLayout: true,
    quickCards: [
      { id: 'qe-1', title: 'Matamasha & Concerts', type: 'custom', link: '/events', iconUrl: '🎤', active: true },
      { id: 'qe-2', title: 'Mechi za Mpira', type: 'custom', link: '/events', iconUrl: '⚽', active: true },
      { id: 'qe-3', title: 'Semina & Mikutano', type: 'custom', link: '/events', iconUrl: '💼', active: true },
    ]
  }
];

export const AppModulesStudio: React.FC = () => {
  const [modules, setModules] = useState<AppModule[]>(() => {
    const saved = localStorage.getItem('omniserve_app_modules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return INITIAL_MODULES;
  });

  const [selectedModuleId, setSelectedModuleId] = useState<string>(INITIAL_MODULES[0].id);
  const [globalSettings, setGlobalSettings] = useState<GlobalAppModulesSettings>({
    moduleSwitcherBar: true,
    backgroundWallpapers: true,
    quickAccessCards: true,
    headerModuleIconStyle: 'style2'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('🛍️');
  const [isAddingCard, setIsAddingCard] = useState(false);

  const selectedModule = modules.find(m => m.id === selectedModuleId) || modules[0];

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'app_modules'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.modules) setModules(data.modules);
          if (data.globalSettings) setGlobalSettings(data.globalSettings);
        }
      } catch (e) {
        console.warn("Could not load app modules:", e);
      }
    };
    loadConfig();
  }, []);

  const updateSelectedModule = (updates: Partial<AppModule>) => {
    setModules(modules.map(m => m.id === selectedModule.id ? { ...m, ...updates } : m));
  };

  const handleSaveModules = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('omniserve_app_modules', JSON.stringify(modules));
      await setDoc(doc(db, 'config', 'app_modules'), {
        modules,
        globalSettings,
        updatedAt: new Date().toISOString()
      });
      toast.success("App Modules na muundo wa simu vimehifadhiwa vizuri!");
    } catch (e: any) {
      toast.error("Kosa: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewModule = () => {
    const newMod: AppModule = {
      id: `module-${Date.now()}`,
      name: 'Custom Service',
      featureVertical: 'custom',
      iconUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=120&q=80',
      active: true,
      headerBgType: 'gradient_2_color',
      primaryColor: '#0ea5e9',
      secondaryColor: '#38bdf8',
      gradientDirection: 'to bottom',
      cardsBgMediaType: 'none',
      cardsBgMediaUrl: '',
      stickyHeaderPinnedColor: '#0284c7',
      horizontalScrollLayout: true,
      quickCards: [
        { id: `qc-${Date.now()}-1`, title: 'Special Item', type: 'custom', link: '/', iconUrl: '⭐', active: true },
        { id: `qc-${Date.now()}-2`, title: 'Offers', type: 'custom', link: '/', iconUrl: '🎁', active: true }
      ]
    };
    setModules([...modules, newMod]);
    setSelectedModuleId(newMod.id);
    toast.success("Module mpya imeundwa!");
  };

  const handleDeleteModule = (id: string, name: string) => {
    if (modules.length <= 1) {
      toast.error("Huwezi kufuta module zote.");
      return;
    }
    if (confirm(`Una uhakika unataka kufuta module ya "${name}"?`)) {
      const remaining = modules.filter(m => m.id !== id);
      setModules(remaining);
      setSelectedModuleId(remaining[0].id);
      toast.success("Module imefutwa!");
    }
  };

  const handleAddQuickCard = () => {
    if (!newCardTitle.trim()) {
      toast.error("Weka jina la kadi.");
      return;
    }
    const newCard: QuickAccessCard = {
      id: `qc-${Date.now()}`,
      title: newCardTitle,
      type: 'custom',
      link: '/',
      iconUrl: newCardIcon || '🛍️',
      active: true
    };
    updateSelectedModule({
      quickCards: [...(selectedModule.quickCards || []), newCard]
    });
    setNewCardTitle('');
    setIsAddingCard(false);
    toast.success("Kadi ya mkato imeongezwa!");
  };

  const handleDeleteCard = (cardId: string) => {
    updateSelectedModule({
      quickCards: selectedModule.quickCards.filter(c => c.id !== cardId)
    });
  };

  const getGradientCss = () => {
    if (selectedModule.headerBgType === 'solid') {
      return selectedModule.primaryColor;
    }
    return `linear-gradient(${selectedModule.gradientDirection || 'to bottom'}, ${selectedModule.primaryColor}, ${selectedModule.secondaryColor})`;
  };

  return (
    <div className="space-y-6">
      {/* Top Global Bar */}
      <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">App Modules Studio</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 rounded-full">
                  {modules.length} modules
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">Customize mobile header themes, quick access shortcuts & live visual preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNewModule}
              className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Create New Module
            </button>
            <button
              type="button"
              onClick={handleSaveModules}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>

        {/* Global toggles */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 cursor-pointer">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Module Switcher Bar</span>
            <input
              type="checkbox"
              checked={globalSettings.moduleSwitcherBar}
              onChange={(e) => setGlobalSettings({ ...globalSettings, moduleSwitcherBar: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 cursor-pointer">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Background Wallpapers</span>
            <input
              type="checkbox"
              checked={globalSettings.backgroundWallpapers}
              onChange={(e) => setGlobalSettings({ ...globalSettings, backgroundWallpapers: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 cursor-pointer">
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Quick Access Cards</span>
            <input
              type="checkbox"
              checked={globalSettings.quickAccessCards}
              onChange={(e) => setGlobalSettings({ ...globalSettings, quickAccessCards: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded"
            />
          </label>

          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">Header Icon Style</span>
            <div className="flex gap-1.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setGlobalSettings({ ...globalSettings, headerModuleIconStyle: 'style1' })}
                className={`px-2 py-1 rounded-lg ${globalSettings.headerModuleIconStyle === 'style1' ? 'bg-orange-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              >
                Style 1
              </button>
              <button
                type="button"
                onClick={() => setGlobalSettings({ ...globalSettings, headerModuleIconStyle: 'style2' })}
                className={`px-2 py-1 rounded-lg ${globalSettings.headerModuleIconStyle === 'style2' ? 'bg-orange-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              >
                Style 2
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Module Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {modules.map(mod => {
            const isSelected = mod.id === selectedModuleId;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedModuleId(mod.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/20 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                }`}
              >
                <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 bg-white/20">
                  <img src={mod.iconUrl} alt={mod.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs">{mod.name}</span>
                {mod.active ? (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Area: Left Editor + Right Real-time Mobile Phone Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: MODULE VISUAL BUILDER (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: General Information */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">General Information</h4>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteModule(selectedModule.id, selectedModule.name)}
                className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Module
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Module Name
                </label>
                <input
                  type="text"
                  value={selectedModule.name}
                  onChange={(e) => updateSelectedModule({ name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Feature Vertical
                </label>
                <select
                  value={selectedModule.featureVertical}
                  onChange={(e) => updateSelectedModule({ featureVertical: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="grocery">Grocery (Maduka & Vyakula)</option>
                  <option value="food">Food Delivery (Migahawa & Fastfood)</option>
                  <option value="pharmacy">Pharmacy (Dawa & Afya)</option>
                  <option value="taxi">Taxi & Rides (PapoRide)</option>
                  <option value="parcel">Parcel & Delivery (PapoSend)</option>
                  <option value="print">Document Printing (PapoPrint)</option>
                  <option value="events">Events & Tickets (PapoTicket)</option>
                  <option value="bus">Bus Ticketing (PapoBus)</option>
                  <option value="ecommerce">Ecommerce (PapoMall)</option>
                  <option value="handyman">Handyman (PapoFix)</option>
                  <option value="rent">Rent & Stays (PapoStay)</option>
                  <option value="custom">Custom Special Module</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Module Icon Image URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 bg-neutral-100">
                    <img src={selectedModule.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="text"
                    value={selectedModule.iconUrl}
                    onChange={(e) => updateSelectedModule({ iconUrl: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="sm:col-span-2 flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white">Module Active Status</p>
                  <p className="text-[11px] text-neutral-400">Show or hide this entire service module across the app</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedModule.active}
                    onChange={(e) => updateSelectedModule({ active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Step 2: Top Header Bar Background */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 text-xs font-black flex items-center justify-center">
                2
              </span>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Top Header Bar Background</h4>
                <p className="text-xs text-neutral-400">The mobile app top header color & gradient transition</p>
              </div>
            </div>

            {/* Fill Type */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Background Fill Type</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'gradient_2_color', label: '2-Color Gradient' },
                  { id: 'solid', label: 'Solid Color' },
                  { id: 'gradient_3_color', label: '3-Color Gradient' },
                  { id: 'image', label: 'Image Header' }
                ].map(fill => (
                  <button
                    key={fill.id}
                    type="button"
                    onClick={() => updateSelectedModule({ headerBgType: fill.id as any })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      selectedModule.headerBgType === fill.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500'
                        : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'
                    }`}
                  >
                    {fill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gradient directions */}
            {selectedModule.headerBgType !== 'solid' && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Gradient Direction (8 Directions)</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {[
                    { id: 'to top', label: '↑ Top' },
                    { id: 'to bottom', label: '↓ Bottom' },
                    { id: 'to left', label: '← Left' },
                    { id: 'to right', label: '→ Right' },
                    { id: 'to top right', label: '↗' },
                    { id: 'to bottom right', label: '↘' },
                    { id: 'to bottom left', label: '↙' },
                    { id: 'to top left', label: '↖' },
                  ].map(dir => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => updateSelectedModule({ gradientDirection: dir.id })}
                      className={`p-2 rounded-xl text-[10px] font-bold border transition-all text-center ${
                        selectedModule.gradientDirection === dir.id
                          ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Primary Color (Top / Start)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedModule.primaryColor}
                    onChange={(e) => updateSelectedModule({ primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-neutral-200 dark:border-neutral-700"
                  />
                  <input
                    type="text"
                    value={selectedModule.primaryColor}
                    onChange={(e) => updateSelectedModule({ primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              {selectedModule.headerBgType !== 'solid' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Secondary Color (Bottom / End)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedModule.secondaryColor}
                      onChange={(e) => updateSelectedModule({ secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-xl cursor-pointer border border-neutral-200 dark:border-neutral-700"
                    />
                    <input
                      type="text"
                      value={selectedModule.secondaryColor}
                      onChange={(e) => updateSelectedModule({ secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Quick Access Cards & Shortcuts */}
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 text-xs font-black flex items-center justify-center">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Quick Access Cards (Shortcuts)</h4>
                  <p className="text-xs text-neutral-400">Interactive shortcut buttons placed directly below the header</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingCard(!isAddingCard)}
                className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 text-xs font-bold border border-orange-200 dark:border-orange-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add Card
              </button>
            </div>

            {/* Layout Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">Horizontal Scroll Cards Layout</p>
                <p className="text-[11px] text-neutral-400">Scrollable swipe row vs 4-column compact grid</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModule.horizontalScrollLayout}
                  onChange={(e) => updateSelectedModule({ horizontalScrollLayout: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Add Card Form */}
            {isAddingCard && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-2xl border border-orange-200 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">Card Title</label>
                    <input
                      type="text"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="e.g. Mega Deals 50%"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">Emoji/Icon</label>
                    <input
                      type="text"
                      value={newCardIcon}
                      onChange={(e) => setNewCardIcon(e.target.value)}
                      placeholder="🛍️"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-center font-bold"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCard(false)}
                    className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddQuickCard}
                    className="px-4 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold"
                  >
                    Save Card
                  </button>
                </div>
              </motion.div>
            )}

            {/* Quick cards list */}
            <div className="space-y-2">
              {selectedModule.quickCards?.map(card => (
                <div
                  key={card.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center shadow-xs">
                      {card.iconUrl}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-neutral-900 dark:text-white">{card.title}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">{card.link}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME INTERACTIVE MOBILE PHONE PREVIEW (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-[340px]">
            <div className="text-center mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                Live Smartphone Simulator
              </span>
              <p className="text-[10px] text-neutral-500">Real-time dynamic viewport preview</p>
            </div>

            {/* High-Fidelity Phone Frame */}
            <div className="relative mx-auto w-full rounded-[44px] bg-neutral-950 p-3 shadow-2xl border-[5px] border-neutral-800 ring-1 ring-neutral-700 overflow-hidden select-none">
              {/* Dynamic Island / Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-neutral-900 rounded-full z-30 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 mr-2" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
              </div>

              {/* Mobile Screen Container */}
              <div className="relative rounded-[36px] bg-neutral-100 dark:bg-neutral-950 overflow-hidden h-[620px] flex flex-col">
                {/* Status Bar */}
                <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] font-bold text-white z-20" style={{ background: selectedModule.primaryColor }}>
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5 text-white/90">
                    <Wifi className="w-3 h-3" />
                    <span className="text-[9px]">5G</span>
                    <Battery className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Top Dynamic Header Bar */}
                <div 
                  className="px-4 pt-2 pb-5 text-white transition-all duration-300"
                  style={{
                    background: getGradientCss()
                  }}
                >
                  {/* Location row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-white/90" />
                      <div>
                        <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Deliver to</p>
                        <p className="text-xs font-black truncate max-w-[170px] leading-tight flex items-center gap-1">
                          Ubungo, Dar es Salaam <ChevronRight className="w-3 h-3" />
                        </p>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>

                  {/* Search bar inside header */}
                  <div className="mt-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text"
                      readOnly
                      placeholder={`Search in ${selectedModule.name}...`}
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-white text-neutral-800 text-[11px] shadow-sm font-medium focus:outline-none"
                    />
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-500" />
                  </div>
                </div>

                {/* Module Switcher Bar in Simulator */}
                {globalSettings.moduleSwitcherBar && (
                  <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200/60 dark:border-neutral-800 px-3 py-2 flex items-center gap-2 overflow-x-hidden">
                    {modules.map(mod => {
                      const isActive = mod.id === selectedModule.id;
                      return (
                        <div
                          key={mod.id}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl shrink-0 text-[10px] font-bold transition-all ${
                            isActive
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                              : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                          }`}
                        >
                          <img src={mod.iconUrl} alt={mod.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                          {globalSettings.headerModuleIconStyle === 'style2' && (
                            <span className="truncate max-w-[50px]">{mod.name}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Phone Scroll Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-neutral-50 dark:bg-neutral-900/40">
                  {/* Quick Access Cards in Simulator */}
                  {globalSettings.quickAccessCards && selectedModule.quickCards?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Quick Shortcuts</p>
                      {selectedModule.horizontalScrollLayout ? (
                        <div className="flex items-center gap-2 overflow-x-hidden pb-1">
                          {selectedModule.quickCards.map(card => (
                            <div
                              key={card.id}
                              className="w-16 p-2 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-center shrink-0 shadow-xs flex flex-col items-center justify-center gap-1"
                            >
                              <span className="text-base">{card.iconUrl}</span>
                              <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                                {card.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                          {selectedModule.quickCards.map(card => (
                            <div
                              key={card.id}
                              className="p-2 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-center shadow-xs flex flex-col items-center justify-center gap-1"
                            >
                              <span className="text-base">{card.iconUrl}</span>
                              <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-200 truncate w-full">
                                {card.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Promo Banner Mock in Simulator */}
                  <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 p-3 text-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase">Flash 30% OFF</span>
                        <p className="text-xs font-black mt-1">Super Saving Week</p>
                        <p className="text-[9px] text-white/80">Code: PAPO30</p>
                      </div>
                      <span className="text-2xl">🎁</span>
                    </div>
                  </div>

                  {/* Category Grid Mock in Simulator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-neutral-800 dark:text-neutral-200">
                        {selectedModule.name} Categories
                      </p>
                      <span className="text-[9px] font-bold text-orange-600">View all</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'Fresh Items', icon: '🍎' },
                        { name: 'Cold Drinks', icon: '🧃' },
                        { name: 'Bakery', icon: '🍞' },
                        { name: 'Personal Care', icon: '🧴' },
                        { name: 'Cleaning', icon: '🧼' },
                        { name: 'Baby Care', icon: '🍼' }
                      ].map((cat, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-center shadow-xs flex flex-col items-center justify-center gap-1"
                        >
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-[9px] font-bold text-neutral-700 dark:text-neutral-300 truncate w-full">
                            {cat.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Home Indicator Bar */}
                <div className="py-2 bg-white dark:bg-neutral-900 border-t border-neutral-200/60 dark:border-neutral-800 flex justify-center">
                  <div className="w-24 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
