import React, { useState, useEffect } from 'react';
import { 
  X, Check, Search, Sparkles, Clock, CheckSquare, 
  Trash2, Smartphone, Monitor, LayoutGrid, Palette, Play,
  Tv, Film, Eye, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasWidget, WidgetDisplayStyle, ContentSourceType, DeviceTarget, BackgroundType } from '../../types/widgetCanvas';

interface EditWidgetModalProps {
  widget: CanvasWidget | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWidget: CanvasWidget) => void;
}

const AVAILABLE_SAMPLE_ITEMS = [
  { id: 'item-1', name: 'Atta & Flours', category: 'Grocery', isFeatured: true },
  { id: 'item-2', name: 'Amul Butter & Dairy', category: 'Dairy', isFeatured: true },
  { id: 'item-3', name: 'Ayurveda & Health Products', category: 'Health', isFeatured: false },
  { id: 'item-4', name: 'Backpack & Travel Bags', category: 'Accessories', isFeatured: false },
  { id: 'item-5', name: 'Balloon Decor & Party', category: 'Events', isFeatured: false },
  { id: 'item-6', name: 'Bamboo Crafts & Eco', category: 'Home', isFeatured: true },
  { id: 'item-7', name: 'Bangles & Fashion Jewelry', category: 'Beauty', isFeatured: true },
  { id: 'item-8', name: 'Base Makeup & Cosmetics', category: 'Beauty', isFeatured: true },
  { id: 'item-9', name: 'Beauty & Skincare Essentials', category: 'Beauty', isFeatured: true },
  { id: 'item-10', name: 'Bento Cakes & Bakery', category: 'Bakery', isFeatured: true },
  { id: 'item-11', name: 'Best Offers & Mega Deals', category: 'Deals', isFeatured: true },
  { id: 'item-12', name: 'Best Wishes & Gift Cards', category: 'Gifts', isFeatured: false },
  { id: 'item-13', name: 'Beverages & Soft Drinks', category: 'Drinks', isFeatured: true },
  { id: 'item-14', name: 'Biscuits & Cookies Assorted', category: 'Snacks', isFeatured: true },
  { id: 'item-15', name: 'Fresh Fruits & Greens', category: 'Grocery', isFeatured: true },
  { id: 'item-16', name: 'Cold Pressed Juices & Smoothies', category: 'Drinks', isFeatured: true },
  { id: 'item-17', name: 'Organic Spices & Masalas', category: 'Grocery', isFeatured: false },
  { id: 'item-18', name: 'Household Cleaners & Detergents', category: 'Cleaning', isFeatured: true },
];

export const EditWidgetModal: React.FC<EditWidgetModalProps> = ({
  widget,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<CanvasWidget | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    if (widget) {
      setFormData({ ...widget });
    }
  }, [widget]);

  if (!isOpen || !formData) return null;

  const totalCalculatedItems = formData.desktopItemsPerRow * formData.rowsCount;

  const filteredItems = AVAILABLE_SAMPLE_ITEMS.filter(item => 
    item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const toggleItemSelection = (id: string) => {
    const current = formData.selectedItemIds || [];
    if (current.includes(id)) {
      setFormData({
        ...formData,
        selectedItemIds: current.filter(itemId => itemId !== id)
      });
    } else {
      setFormData({
        ...formData,
        selectedItemIds: [...current, id]
      });
    }
  };

  const handleClearAllItems = () => {
    setFormData({
      ...formData,
      selectedItemIds: []
    });
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                  Edit Widget
                </h3>
                <p className="text-xs text-neutral-500 font-medium">
                  Customize layout, styling and content source for {formData.title || 'Widget'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Widget Banner Info */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  {formData.type === 'CATEGORY' ? 'Category Browse Widget' : formData.type === 'PRODUCT' ? 'Product Showcase Widget' : formData.type === 'BRAND' ? 'Brand Spotlight Widget' : 'Media & Store Widget'}
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
                  Showcase dynamic curated collections to help users quickly discover items. Optimized for high conversion, mobile gestures and smooth navigation.
                </p>
              </div>
            </div>

            {/* Widget Header Section */}
            <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-500 text-white shadow-sm">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Widget Header</h4>
                  <p className="text-xs text-neutral-500">This text appears at the top of your widget in the app</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Widget Title <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Grocery, Snacks & Drinks"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">Leave empty to hide the title</p>
                </div>

                {/* Show title switch */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
                  <div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white">Show title in app</p>
                    <p className="text-[11px] text-neutral-500">Toggle visibility on mobile screen</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.showTitleInApp}
                      onChange={(e) => setFormData({ ...formData, showTitleInApp: e.target.checked })}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Widget Subtitle <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle || ''}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="e.g., Handpicked just for you, Limited time offers"
                    maxLength={200}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">Short description shown below the title (max 200 characters)</p>
                </div>
              </div>
            </div>

            {/* Device Target Visibility */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-neutral-500" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Device Target Visibility</h4>
              </div>
              <p className="text-xs text-neutral-500 -mt-1">Select which devices will display this widget on the website</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'all', label: 'All Devices', sub: 'Mobile & Laptop', icon: '💻 📱' },
                  { id: 'mobile_only', label: 'Mobile Only', sub: 'Hide on Laptop', icon: '📱' },
                  { id: 'laptop_only', label: 'Laptop Only', sub: 'Hide on Mobile', icon: '💻' },
                ].map(device => {
                  const isSelected = formData.deviceTarget === device.id;
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, deviceTarget: device.id as DeviceTarget })}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20' 
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{device.icon}</div>
                      <p className="text-xs font-bold text-neutral-900 dark:text-white">{device.label}</p>
                      <p className="text-[10px] text-neutral-400">{device.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choose Display Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-orange-500" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Choose Display Style</h4>
              </div>
              <p className="text-xs text-neutral-500 -mt-1">Select how items will appear in the app</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'circle', label: 'Circle', icon: '○ ○ ○' },
                  { id: 'card_grid', label: 'Card Grid', icon: '⊞' },
                  { id: 'tabs_products', label: 'Tabs+Products', icon: '日⇄' },
                  { id: 'checkmark', label: 'Checkmark', icon: '🗂️' },
                ].map(style => {
                  const isSelected = formData.displayStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, displayStyle: style.id as WidgetDisplayStyle })}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 ring-2 ring-orange-500/20 font-bold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-xl text-neutral-700 dark:text-neutral-300 font-mono tracking-widest">{style.icon}</div>
                      <span className="text-xs text-neutral-800 dark:text-neutral-200">{style.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Source */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Content Source</h4>
              </div>
              <p className="text-xs text-neutral-500 -mt-1">Where should the items come from?</p>

              <div className="space-y-2.5">
                {[
                  { 
                    id: 'featured', 
                    title: 'Featured Items', 
                    desc: 'Automatically show items marked as featured', 
                    icon: Sparkles, 
                    color: 'text-purple-600 bg-purple-500/10' 
                  },
                  { 
                    id: 'recent', 
                    title: 'Recently Added', 
                    desc: 'Show newest items first (auto-updating)', 
                    icon: Clock, 
                    color: 'text-emerald-600 bg-emerald-500/10' 
                  },
                  { 
                    id: 'custom', 
                    title: 'Custom Selection', 
                    desc: 'Hand-pick specific items to display', 
                    icon: CheckSquare, 
                    color: 'text-orange-600 bg-orange-500/10' 
                  },
                ].map(source => {
                  const isSelected = formData.contentSource === source.id;
                  const Icon = source.icon;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, contentSource: source.id as ContentSourceType })}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 ring-2 ring-orange-500/20'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl ${source.color} shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{source.title}</p>
                        <p className="text-[11px] text-neutral-500">{source.desc}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If Custom Selection -> Item Multi-Selector */}
            {formData.contentSource === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-orange-500" />
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">Select Items</h4>
                  </div>
                  <span className="px-2.5 py-0.5 text-[11px] font-bold bg-orange-100 dark:bg-orange-950/50 text-orange-600 rounded-full">
                    {formData.selectedItemIds?.length || 0} selected
                  </span>
                </div>

                {/* Search in box */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search and select items..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Checklist Container */}
                <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {filteredItems.map(item => {
                    const isChecked = formData.selectedItemIds?.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50' 
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 text-orange-600 rounded border-neutral-300 focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {item.category}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-neutral-500 font-medium">
                    {formData.selectedItemIds?.length || 0} item(s) will be displayed
                  </p>
                  <button
                    type="button"
                    onClick={handleClearAllItems}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </div>
              </motion.div>
            )}

            {/* Grid Layout Settings */}
            <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 space-y-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-teal-600" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Grid Layout Settings</h4>
              </div>
              <p className="text-xs text-neutral-500 -mt-2">Configure how many items to display and their arrangement</p>

              {/* Device Target Visibility checkboxes */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={formData.mobileVisible}
                    onChange={(e) => setFormData({ ...formData, mobileVisible: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>📱 Mobile View</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={formData.desktopVisible}
                    onChange={(e) => setFormData({ ...formData, desktopVisible: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>💻 Laptop / Desktop</span>
                </label>
              </div>

              {/* Mobile items per row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">📱 Mobile Items per Row</p>
                  <span className="text-[10px] text-neutral-400">Mobile screens (&lt;768px)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData({ ...formData, mobileItemsPerRow: num })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.mobileItemsPerRow === num
                          ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500'
                          : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {num} per Row
                    </button>
                  ))}
                </div>
              </div>

              {/* Laptop / Desktop items per row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">💻 Laptop / Desktop Items per Row</p>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Desktop screens (≥768px)</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[2, 3, 4, 5, 6, 7].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData({ ...formData, desktopItemsPerRow: num })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        formData.desktopItemsPerRow === num
                          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                          : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {num} / Row
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-400">Tip: 4 to 6 items per row look best on laptops and high-resolution monitors.</p>
              </div>

              {/* Rows Count Slider */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    How Many Rows <span className="text-neutral-400 font-normal">(Total Lines)</span>
                  </span>
                  <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-black text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700">
                    {formData.rowsCount}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={formData.rowsCount}
                  onChange={(e) => setFormData({ ...formData, rowsCount: parseInt(e.target.value) || 1 })}
                  className="w-full accent-teal-600 cursor-pointer"
                />

                {/* Calculation preview */}
                <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-teal-900 dark:text-teal-200">
                      Total items displayed: <span className="text-sm font-black text-teal-700 dark:text-teal-300">{totalCalculatedItems}</span>
                    </p>
                    <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80">
                      {formData.desktopItemsPerRow} items per row × {formData.rowsCount} rows
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                  ⓘ Extra items beyond this grid will show a "View All" button
                </p>
              </div>
            </div>

            {/* Animation & Background Styling */}
            <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 space-y-4">
              {/* Auto Scroll Animation */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/50">
                <div>
                  <p className="text-xs font-bold text-sky-950 dark:text-sky-200 flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-sky-600" />
                    Enable Auto-Scroll Animation
                  </p>
                  <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 mt-1 leading-relaxed">
                    Items will automatically slide sideways every few seconds, creating an engaging carousel effect that draws attention to your content.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-sky-400/80 animate-pulse" />
                      <div className="w-6 h-6 rounded-md bg-sky-300/80 animate-pulse delay-75" />
                      <div className="w-6 h-6 rounded-md bg-sky-200/80 animate-pulse delay-150" />
                    </div>
                    <span className="text-[10px] font-mono text-sky-600">← Auto-scroll preview</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formData.autoScrollAnimation}
                    onChange={(e) => setFormData({ ...formData, autoScrollAnimation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Background Styling */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Background Styling</h4>
                </div>
                <p className="text-xs text-neutral-500 -mt-2">Customize the background behind your widget items</p>

                {/* Enable custom background switch */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
                  <div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white">Enable Custom Background</p>
                    <p className="text-[11px] text-neutral-500">Add a colorful or media background to make your widget stand out</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.customBackgroundEnabled}
                      onChange={(e) => setFormData({ ...formData, customBackgroundEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {formData.customBackgroundEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 p-4 rounded-xl bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50"
                  >
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Background Type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'solid', label: 'Solid Color' },
                        { id: 'image', label: 'Image' },
                        { id: 'gif', label: 'Animated GIF' },
                        { id: 'video', label: 'Video' },
                      ].map(bType => (
                        <button
                          key={bType.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, backgroundType: bType.id as BackgroundType })}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                            formData.backgroundType === bType.id
                              ? 'border-purple-600 bg-purple-100/80 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                          }`}
                        >
                          {bType.label}
                        </button>
                      ))}
                    </div>

                    {formData.backgroundType === 'solid' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          Pick Background Color
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={formData.backgroundColor || '#fff0e5'}
                            onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                            className="w-10 h-10 rounded-xl cursor-pointer border border-neutral-200 dark:border-neutral-700"
                          />
                          <input
                            type="text"
                            value={formData.backgroundColor || '#fff0e5'}
                            onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                            placeholder="#fff0e5"
                            className="w-36 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs font-bold"
                          />
                          <span className="text-[11px] text-neutral-400">Click color box or enter hex code</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Show View All Button switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
                <div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-white">Show "View All" Button</p>
                  <p className="text-[11px] text-neutral-500">Adds a "View All" link that takes users to the category listing page</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showViewAllButton}
                    onChange={(e) => setFormData({ ...formData, showViewAllButton: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 flex items-center justify-end gap-3 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 font-bold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
            >
              Update Widget
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
