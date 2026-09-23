import React, { useState } from 'react';
import { 
  Smartphone, Tablet, Laptop, Monitor, X, ExternalLink, 
  ShoppingBag, Star, Plus, ChevronRight, Eye, RefreshCw, 
  Sparkles, Heart, Search, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasWidget } from '../../types/widgetCanvas';

interface WebsiteLivePreviewProps {
  widgets: CanvasWidget[];
  activeChannel: string;
  isOpen: boolean;
  onClose: () => void;
  onEditWidget?: (widget: CanvasWidget) => void;
}

type DeviceMode = 'mobile_sm' | 'mobile_lg' | 'tablet' | 'laptop' | 'desktop';

const DEVICE_CONFIGS: Record<DeviceMode, { name: string; width: string; icon: any; screenW: number }> = {
  mobile_sm: { name: 'Mobile (375px)', width: 'max-w-[375px]', icon: Smartphone, screenW: 375 },
  mobile_lg: { name: 'Mobile L (425px)', width: 'max-w-[425px]', icon: Smartphone, screenW: 425 },
  tablet: { name: 'Tablet (768px)', width: 'max-w-[768px]', icon: Tablet, screenW: 768 },
  laptop: { name: 'Laptop (1024px)', width: 'max-w-[1024px]', icon: Laptop, screenW: 1024 },
  desktop: { name: 'Desktop (100% Fluid)', width: 'max-w-full', icon: Monitor, screenW: 1440 },
};

// Sample mock store data for live realistic rendering
const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Fresh Milk 1L', price: 2500, oldPrice: 3000, img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80', unit: '1 Litre', rating: 4.8 },
  { id: 'p2', name: 'Dar es Salaam Fresh Bread', price: 1800, oldPrice: 2000, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', unit: 'Loaf 800g', rating: 4.9 },
  { id: 'p3', name: 'Ripe Bananas (Ndizi)', price: 3500, oldPrice: 4000, img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80', unit: '1 Tenga / 12 pcs', rating: 4.7 },
  { id: 'p4', name: 'Red Apples (Maapulo)', price: 5000, oldPrice: 6500, img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80', unit: '1kg pack', rating: 4.9 },
  { id: 'p5', name: 'Basmati Rice Premium', price: 12000, oldPrice: 14500, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80', unit: '5kg Bag', rating: 5.0 },
  { id: 'p6', name: 'Pure Cooking Oil', price: 9500, oldPrice: 11000, img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80', unit: '2 Litres', rating: 4.6 },
  { id: 'p7', name: 'Cold Pressed Orange Juice', price: 4500, oldPrice: 5000, img: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=400&q=80', unit: '500ml', rating: 4.8 },
  { id: 'p8', name: 'Organic Honey (Asali ya Nyuki)', price: 15000, oldPrice: 18000, img: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80', unit: '1kg Glass Jar', rating: 5.0 },
];

const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Fresh Fruits', icon: '🍎', color: 'bg-red-50 text-red-600 dark:bg-red-950/40' },
  { id: 'c2', name: 'Vegetables', icon: '🥦', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' },
  { id: 'c3', name: 'Dairy & Eggs', icon: '🥛', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40' },
  { id: 'c4', name: 'Bakery & Bread', icon: '🥐', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40' },
  { id: 'c5', name: 'Drinks & Juices', icon: '🧃', color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40' },
  { id: 'c6', name: 'Spices & Sauces', icon: '🌶️', color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40' },
  { id: 'c7', name: 'Meat & Poultry', icon: '🥩', color: 'bg-red-50 text-red-700 dark:bg-red-950/40' },
  { id: 'c8', name: 'Snacks & Bites', icon: '🍿', color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40' },
];

const MOCK_BRANDS = [
  { id: 'b1', name: 'Amul Dairy', logo: '🧈' },
  { id: 'b2', name: 'Bakhresa Azam', logo: '🍞' },
  { id: 'b3', name: 'Brookside', logo: '🥛' },
  { id: 'b4', name: 'Mo Extra', logo: '🌾' },
  { id: 'b5', name: 'Sayona Drinks', logo: '🥤' },
  { id: 'b6', name: 'Natures Best', logo: '🍯' },
];

const MOCK_STORES = [
  { id: 's1', name: 'Shoppers Supermarket', location: 'Mlimani City Mall', time: '15-25 min', rating: 4.9, img: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80' },
  { id: 's2', name: 'Kariakoo Wholesale Fresh', location: 'Kariakoo Market', time: '20-30 min', rating: 4.8, img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80' },
  { id: 's3', name: 'Sinza Organic Butchery', location: 'Sinza Mori', time: '10-20 min', rating: 4.9, img: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=400&q=80' },
];

export const WebsiteLivePreview: React.FC<WebsiteLivePreviewProps> = ({
  widgets,
  activeChannel,
  isOpen,
  onClose,
  onEditWidget,
}) => {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('laptop');
  const [activeTabFilter, setActiveTabFilter] = useState('All');

  if (!isOpen) return null;

  const currentConfig = DEVICE_CONFIGS[deviceMode];
  const isMobile = deviceMode === 'mobile_sm' || deviceMode === 'mobile_lg';
  const isTablet = deviceMode === 'tablet';

  const activeWidgets = widgets.filter(w => w.active);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex flex-col bg-neutral-950/90 backdrop-blur-md overflow-hidden">
        {/* Top Control Bar */}
        <div className="h-16 bg-[#0f172a] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                Live Preview
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
              {activeChannel}
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-400">
              {activeWidgets.length} active widgets
            </span>
          </div>

          {/* Device Responsive Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            {(Object.keys(DEVICE_CONFIGS) as DeviceMode[]).map((mode) => {
              const cfg = DEVICE_CONFIGS[mode];
              const Icon = cfg.icon;
              const isSelected = deviceMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeviceMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={cfg.name}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{cfg.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Simulation Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start bg-[#0b0f19]">
          <div className={`w-full ${currentConfig.width} transition-all duration-300 bg-white dark:bg-[#090d16] text-neutral-900 dark:text-neutral-100 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col min-h-[90vh]`}>
            
            {/* Mock Store Header inside preview */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-neutral-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                  P
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-900 dark:text-white leading-tight">
                    PAPO HAPO • {activeChannel.toUpperCase()}
                  </h4>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Delivery 15-25 min
                  </p>
                </div>
              </div>

              {/* Mock search bar */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-400 text-xs flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5" />
                <span>Tafuta bidhaa au duka...</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative p-2 rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
                    2
                  </span>
                </div>
              </div>
            </div>

            {/* Widget Content Stream */}
            <div className="p-4 sm:p-6 space-y-8">
              {activeWidgets.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-500 mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-neutral-500">Hakuna widget inayotumika sasa</h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Washa widgets kwenye canvas au bofya "Add Widget" kwenye orodha ya kushoto ili kuanza.
                  </p>
                </div>
              ) : (
                activeWidgets.map((widget) => {
                  // Determine column count based on device mode
                  const cols = isMobile 
                    ? (widget.mobileItemsPerRow || 2) 
                    : isTablet 
                      ? Math.min(widget.desktopItemsPerRow || 4, 3) 
                      : (widget.desktopItemsPerRow || 5);

                  return (
                    <div 
                      key={widget.id}
                      className={`relative group rounded-3xl p-4 sm:p-5 transition-all ${
                        widget.customBackgroundEnabled && widget.backgroundColor
                          ? ''
                          : 'bg-neutral-50/70 dark:bg-slate-900/40 border border-neutral-200/60 dark:border-slate-800/60'
                      }`}
                      style={{
                        backgroundColor: widget.customBackgroundEnabled ? widget.backgroundColor : undefined
                      }}
                    >
                      {/* Admin Quick Tag Indicator */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5 bg-neutral-900/90 text-white text-[10px] px-2.5 py-1 rounded-xl shadow-md">
                        <span className="font-bold">{widget.type}</span>
                        <span>•</span>
                        <span>{isMobile ? `Mobile: ${widget.mobileItemsPerRow} cols` : `Laptop: ${widget.desktopItemsPerRow} cols`}</span>
                        {onEditWidget && (
                          <button
                            type="button"
                            onClick={() => onEditWidget(widget)}
                            className="ml-1 text-indigo-400 hover:text-indigo-300 font-black cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {/* Header for widget if enabled */}
                      {widget.showTitleInApp && widget.title && (
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                              {widget.title}
                            </h3>
                            {widget.subtitle && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {widget.subtitle}
                              </p>
                            )}
                          </div>
                          {widget.showViewAllButton && (
                            <button
                              type="button"
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              View All
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* CATEGORY: Circle Row */}
                      {widget.type === 'CATEGORY' && widget.displayStyle === 'circle' && (
                        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
                          {MOCK_CATEGORIES.map((cat) => (
                            <div key={cat.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group/cat">
                              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl shadow-sm transition-transform group-hover/cat:scale-105 ${cat.color}`}>
                                {cat.icon}
                              </div>
                              <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 text-center max-w-[70px] truncate">
                                {cat.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CATEGORY: Card Grid */}
                      {widget.type === 'CATEGORY' && widget.displayStyle === 'card_grid' && (
                        <div 
                          className="grid gap-2.5 sm:gap-3.5"
                          style={{
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
                          }}
                        >
                          {MOCK_CATEGORIES.slice(0, cols * (widget.rowsCount || 1)).map((cat) => (
                            <div
                              key={cat.id}
                              className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700/60 shadow-xs flex flex-col items-center text-center hover:border-indigo-500 transition-all cursor-pointer"
                            >
                              <span className="text-2xl mb-1.5">{cat.icon}</span>
                              <span className="text-xs font-black text-neutral-900 dark:text-white leading-tight">
                                {cat.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 mt-0.5">Shop now</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CATEGORY: Tabs + Products */}
                      {widget.type === 'CATEGORY' && widget.displayStyle === 'tabs_products' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {['All', 'Vyakula', 'Matunda', 'Vinywaji', 'Maziwa', 'Vitafunwa'].map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTabFilter(tab)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                                  activeTabFilter === tab
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-neutral-200/70 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300'
                                }`}
                              >
                                {tab}
                              </button>
                            ))}
                          </div>
                          <div 
                            className="grid gap-3"
                            style={{
                              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
                            }}
                          >
                            {MOCK_PRODUCTS.slice(0, cols * 2).map((prod) => (
                              <div key={prod.id} className="bg-white dark:bg-slate-800 rounded-2xl p-2.5 border border-neutral-200 dark:border-slate-700/60 shadow-xs">
                                <img src={prod.img} alt={prod.name} className="w-full h-24 sm:h-28 object-cover rounded-xl mb-2" />
                                <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{prod.name}</h4>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">TSh {prod.price.toLocaleString()}</span>
                                  <button type="button" className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* PRODUCT: Grid */}
                      {widget.type === 'PRODUCT' && (widget.displayStyle === 'grid' || !widget.displayStyle) && (
                        <div 
                          className="grid gap-3 sm:gap-4"
                          style={{
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
                          }}
                        >
                          {MOCK_PRODUCTS.slice(0, cols * (widget.rowsCount || 2)).map((prod) => (
                            <div 
                              key={prod.id} 
                              className="group/card bg-white dark:bg-slate-800/90 rounded-2xl p-2.5 sm:p-3 border border-neutral-200 dark:border-slate-700/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                            >
                              <div className="relative mb-2">
                                <img 
                                  src={prod.img} 
                                  alt={prod.name} 
                                  className="w-full h-28 sm:h-32 object-cover rounded-xl"
                                />
                                {prod.oldPrice && (
                                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black uppercase">
                                    Sale
                                  </span>
                                )}
                                <button type="button" className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/80 dark:bg-slate-900/80 text-neutral-400 hover:text-red-500">
                                  <Heart className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] text-neutral-400 font-medium block">{prod.unit}</span>
                                <h4 className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-1 group-hover/card:text-indigo-600">
                                  {prod.name}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{prod.rating}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-100 dark:border-slate-700/50">
                                <div>
                                  <span className="text-xs font-black text-neutral-900 dark:text-white block">
                                    TSh {prod.price.toLocaleString()}
                                  </span>
                                  {prod.oldPrice && (
                                    <span className="text-[10px] line-through text-neutral-400">
                                      TSh {prod.oldPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Add</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* PRODUCT: Horizontal Row */}
                      {widget.type === 'PRODUCT' && widget.displayStyle === 'horizontal' && (
                        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
                          {MOCK_PRODUCTS.map((prod) => (
                            <div 
                              key={prod.id} 
                              className="w-40 sm:w-48 shrink-0 bg-white dark:bg-slate-800 rounded-2xl p-2.5 sm:p-3 border border-neutral-200 dark:border-slate-700/60 shadow-xs flex flex-col justify-between"
                            >
                              <img src={prod.img} alt={prod.name} className="w-full h-28 object-cover rounded-xl mb-2" />
                              <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{prod.name}</h4>
                              <span className="text-[10px] text-neutral-400">{prod.unit}</span>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 dark:border-slate-700">
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">TSh {prod.price.toLocaleString()}</span>
                                <button type="button" className="p-1 rounded-lg bg-indigo-600 text-white">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* PRODUCT: Item List */}
                      {widget.type === 'PRODUCT' && widget.displayStyle === 'item_list' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {MOCK_PRODUCTS.slice(0, 4).map((prod) => (
                            <div key={prod.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-xs">
                              <img src={prod.img} alt={prod.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{prod.name}</h4>
                                <span className="text-[10px] text-neutral-400">{prod.unit}</span>
                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">TSh {prod.price.toLocaleString()}</p>
                              </div>
                              <button type="button" className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0">
                                Weka
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* MEDIA_BANNER: Full Width / Container / Rounded */}
                      {widget.type === 'MEDIA_BANNER' && (
                        <div className="relative rounded-2xl overflow-hidden min-h-[140px] sm:min-h-[180px] bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 flex items-center p-6 text-white shadow-md">
                          <div className="relative z-10 max-w-md space-y-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-neutral-950">
                              Special Offer 30% OFF
                            </span>
                            <h3 className="text-lg sm:text-2xl font-black leading-tight">
                              {widget.title || 'Super Sale Weekend'}
                            </h3>
                            <p className="text-xs text-slate-200 line-clamp-2">
                              {widget.subtitle || 'Pata bidhaa safi za nyumbani na vyakula bora kwa bei ya kiwandani papo hapo.'}
                            </p>
                            <button
                              type="button"
                              className="px-4 py-2 rounded-xl bg-white text-neutral-900 text-xs font-black hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Shop Now
                            </button>
                          </div>
                          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 bg-radial from-indigo-400/50 to-transparent pointer-events-none" />
                        </div>
                      )}

                      {/* BRAND: Circle or Grid or Strip */}
                      {widget.type === 'BRAND' && (
                        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                          {MOCK_BRANDS.map((brand) => (
                            <div 
                              key={brand.id}
                              className="p-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5 shrink-0 hover:border-amber-500 transition-all cursor-pointer"
                            >
                              <span className="text-2xl">{brand.logo}</span>
                              <div>
                                <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-tight">
                                  {brand.name}
                                </h4>
                                <span className="text-[10px] text-neutral-400">Official Store</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* STORE: Store Grid / Horizontal */}
                      {widget.type === 'STORE' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                          {MOCK_STORES.map((store) => (
                            <div 
                              key={store.id}
                              className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-neutral-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-all cursor-pointer"
                            >
                              <img src={store.img} alt={store.name} className="w-full h-28 object-cover" />
                              <div className="p-3 space-y-1">
                                <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                  {store.name}
                                </h4>
                                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                  <span>{store.location}</span>
                                  <span className="text-emerald-600 font-bold">{store.time}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer inside preview */}
            <div className="mt-auto border-t border-neutral-200 dark:border-slate-800 p-6 text-center text-xs text-neutral-400">
              <p>© 2026 Papo Hapo Super App • Powered by Papo Website Builder</p>
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};
