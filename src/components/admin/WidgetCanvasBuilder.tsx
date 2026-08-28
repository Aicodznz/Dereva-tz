import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Copy, ArrowUp, ArrowDown, GripVertical, 
  Layers, Sparkles, ShoppingBag, Tag, Image as ImageIcon, Store,
  CheckCircle2, RefreshCw, Smartphone, Laptop, Eye, Save, RotateCcw,
  Check, LayoutGrid, CheckSquare, Grid, List, Play, Palette, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasWidget, WidgetCategoryType, WidgetDisplayStyle } from '../../types/widgetCanvas';
import { EditWidgetModal } from './EditWidgetModal';
import { toast } from 'sonner';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const INITIAL_DEMO_WIDGETS: CanvasWidget[] = [
  {
    id: 'widget-1',
    order: 1,
    type: 'CATEGORY',
    title: 'Grocery',
    subtitle: 'Fresh vegetables, fruits & daily food supplies',
    showTitleInApp: true,
    active: true,
    displayStyle: 'card_grid',
    contentSource: 'featured',
    selectedItemIds: ['item-1', 'item-2', 'item-15', 'item-17'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'CATEGORY',
    tagLayout: 'Card Grid 4×2'
  },
  {
    id: 'widget-2',
    order: 2,
    type: 'CATEGORY',
    title: 'Snacks & Drinks',
    subtitle: 'Juices, cold soda, crisps & chocolate',
    showTitleInApp: true,
    active: true,
    displayStyle: 'card_grid',
    contentSource: 'featured',
    selectedItemIds: ['item-13', 'item-14', 'item-16'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'CATEGORY',
    tagLayout: 'Card Grid 4×2'
  },
  {
    id: 'widget-3',
    order: 3,
    type: 'CATEGORY',
    title: 'Daily & Breakfast',
    subtitle: 'Milk, bread, cereals & eggs',
    showTitleInApp: true,
    active: true,
    displayStyle: 'card_grid',
    contentSource: 'recent',
    selectedItemIds: ['item-2', 'item-10'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 1,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'CATEGORY',
    tagLayout: 'Card Grid 4×1'
  },
  {
    id: 'widget-4',
    order: 4,
    type: 'PRODUCT',
    title: "Today's Offer 🎁🎉",
    subtitle: 'Special today for you with instant discount',
    showTitleInApp: true,
    active: false,
    displayStyle: 'grid',
    contentSource: 'featured',
    selectedItemIds: ['item-11'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'PRODUCT',
    tagLayout: 'Grid 4×2'
  },
  {
    id: 'widget-5',
    order: 5,
    type: 'CATEGORY',
    title: 'Beauty & Personal Care',
    subtitle: 'Soaps, perfumes, cosmetics & lotions',
    showTitleInApp: true,
    active: true,
    displayStyle: 'card_grid',
    contentSource: 'featured',
    selectedItemIds: ['item-7', 'item-8', 'item-9'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'CATEGORY',
    tagLayout: 'Card Grid 4×2'
  },
  {
    id: 'widget-6',
    order: 6,
    type: 'CATEGORY',
    title: 'Cleaning Essentials',
    subtitle: 'Detergents, floor wash & bathroom cleaners',
    showTitleInApp: true,
    active: true,
    displayStyle: 'card_grid',
    contentSource: 'recent',
    selectedItemIds: ['item-18'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 4,
    rowsCount: 1,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'CATEGORY',
    tagLayout: 'Card Grid 4×1'
  },
  {
    id: 'widget-7',
    order: 7,
    type: 'BRAND',
    title: 'Top Selling Brand',
    subtitle: 'Nivea, Azam, Mo, Vaseline & Nestle',
    showTitleInApp: true,
    active: true,
    displayStyle: 'banner',
    contentSource: 'featured',
    selectedItemIds: [],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 1,
    desktopItemsPerRow: 1,
    rowsCount: 1,
    autoScrollAnimation: true,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: false,
    tagLabel: 'BRAND',
    tagLayout: 'Banner',
    isAuto: true
  },
  {
    id: 'widget-8',
    order: 8,
    type: 'PRODUCT',
    title: 'Featured Flash Deals ⚡',
    subtitle: 'Hurry up! Low stock discounts',
    showTitleInApp: true,
    active: true,
    displayStyle: 'grid',
    contentSource: 'featured',
    selectedItemIds: ['item-1', 'item-11'],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 3,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'PRODUCT',
    tagLayout: 'Grid 3×2',
    isAuto: true
  },
  {
    id: 'widget-9',
    order: 9,
    type: 'PRODUCT',
    title: 'Trending In Your Area',
    subtitle: 'Most ordered by nearby neighbors',
    showTitleInApp: true,
    active: true,
    displayStyle: 'grid',
    contentSource: 'recent',
    selectedItemIds: [],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 2,
    desktopItemsPerRow: 3,
    rowsCount: 2,
    autoScrollAnimation: false,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'PRODUCT',
    tagLayout: 'Grid 3×2',
    isAuto: true
  },
  {
    id: 'widget-10',
    order: 10,
    type: 'PRODUCT',
    title: "Best prices you'll love 😍🔥",
    subtitle: 'Limited-time savings for families',
    showTitleInApp: true,
    active: true,
    displayStyle: 'horizontal',
    contentSource: 'featured',
    selectedItemIds: [],
    deviceTarget: 'all',
    mobileVisible: true,
    desktopVisible: true,
    mobileItemsPerRow: 1,
    desktopItemsPerRow: 1,
    rowsCount: 1,
    autoScrollAnimation: true,
    customBackgroundEnabled: false,
    backgroundType: 'solid',
    backgroundColor: '#fff0e5',
    showViewAllButton: true,
    tagLabel: 'PRODUCT',
    tagLayout: 'Horizontal 1×1',
    isAuto: true
  },
];

export const WidgetCanvasBuilder: React.FC = () => {
  const [widgets, setWidgets] = useState<CanvasWidget[]>(() => {
    const saved = localStorage.getItem('omniserve_canvas_widgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return INITIAL_DEMO_WIDGETS;
  });

  const [editingWidget, setEditingWidget] = useState<CanvasWidget | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadFromFirebase = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'page_canvas_widgets'));
        if (snap.exists() && snap.data().items) {
          setWidgets(snap.data().items);
        }
      } catch (e) {
        console.warn("Could not load widgets from firebase:", e);
      }
    };
    loadFromFirebase();
  }, []);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('omniserve_canvas_widgets', JSON.stringify(widgets));
      await setDoc(doc(db, 'config', 'page_canvas_widgets'), {
        items: widgets,
        updatedAt: new Date().toISOString()
      });
      toast.success("Page Canvas Widgets zimehifadhiwa kikamilifu!");
    } catch (err: any) {
      toast.error("Imeshindwa kuhifadhi: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm("Je, unataka kurejesha mpangilio wa awali wa widget 10 za kielelezo?")) {
      setWidgets(INITIAL_DEMO_WIDGETS);
      localStorage.setItem('omniserve_canvas_widgets', JSON.stringify(INITIAL_DEMO_WIDGETS));
      toast.success("Mpangilio umerudishwa!");
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...widgets];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    // update order
    newItems.forEach((w, idx) => { w.order = idx + 1; });
    setWidgets(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const newItems = [...widgets];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    newItems.forEach((w, idx) => { w.order = idx + 1; });
    setWidgets(newItems);
  };

  const handleToggleActive = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  const handleDuplicate = (widget: CanvasWidget) => {
    const newWidget: CanvasWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      order: widgets.length + 1,
      title: `${widget.title} (Copy)`
    };
    setWidgets([...widgets, newWidget]);
    toast.success(`Widget "${widget.title}" imenakiliwa!`);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Una uhakika unataka kufuta "${title}"?`)) {
      const remaining = widgets.filter(w => w.id !== id);
      remaining.forEach((w, idx) => { w.order = idx + 1; });
      setWidgets(remaining);
      toast.success("Widget imefutwa!");
    }
  };

  const handleAddWidgetFromPalette = (type: WidgetCategoryType, displayStyle: WidgetDisplayStyle, label: string) => {
    const newWidget: CanvasWidget = {
      id: `widget-${Date.now()}`,
      order: widgets.length + 1,
      type,
      title: `New ${label}`,
      subtitle: 'Handpicked items for quick shopping',
      showTitleInApp: true,
      active: true,
      displayStyle,
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 4,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: type,
      tagLayout: `${displayStyle.replace('_', ' ')}`
    };

    setWidgets([...widgets, newWidget]);
    toast.success(`Widget mpya ya ${label} imeongezwa kwenye canvas!`);
    setEditingWidget(newWidget);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (widget: CanvasWidget) => {
    setEditingWidget(widget);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedWidget = (updated: CanvasWidget) => {
    setWidgets(widgets.map(w => w.id === updated.id ? updated : w));
    toast.success(`Widget "${updated.title}" imesasishwa!`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[800px]">
      {/* LEFT SIDEBAR: WIDGET ELEMENTS PALETTE */}
      <div className="w-full lg:w-72 bg-neutral-950 text-white rounded-3xl p-5 border border-neutral-800 shrink-0 flex flex-col justify-between select-none">
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              WIDGET ELEMENTS
            </h3>
            <p className="text-[10px] text-neutral-400 font-medium mt-0.5">Click or drag to canvas</p>
          </div>

          {/* Product Widgets */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              PRODUCT WIDGETS
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('PRODUCT', 'grid', 'Product Grid')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-blue-400 mb-1 group-hover:scale-110 transition-transform">⊞</div>
                <p className="text-[11px] font-bold text-white">Grid</p>
                <p className="text-[9px] text-neutral-400">2-4 column grid</p>
              </button>

              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('PRODUCT', 'horizontal', 'Horizontal Scroll')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-blue-400 mb-1 group-hover:scale-110 transition-transform">▥</div>
                <p className="text-[11px] font-bold text-white">Horizontal</p>
                <p className="text-[9px] text-neutral-400">Horizontal scroll row</p>
              </button>

              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('PRODUCT', 'item_list', 'Product Item List')}
                className="col-span-2 p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-blue-400 mb-1 group-hover:scale-110 transition-transform">☰</div>
                <p className="text-[11px] font-bold text-white">Item List</p>
                <p className="text-[9px] text-neutral-400">Vertical product rows</p>
              </button>
            </div>
          </div>

          {/* Category Widgets */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              CATEGORY WIDGETS
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('CATEGORY', 'circle', 'Circle Categories')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform">● ● ●</div>
                <p className="text-[11px] font-bold text-white">Circle</p>
                <p className="text-[9px] text-neutral-400">Icon circles in row</p>
              </button>

              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('CATEGORY', 'card_grid', 'Category Card Grid')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform">⊞</div>
                <p className="text-[11px] font-bold text-white">Card Grid</p>
                <p className="text-[9px] text-neutral-400">Grid of category cards</p>
              </button>

              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('CATEGORY', 'tabs_products', 'Category Tabs')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform">日⇄</div>
                <p className="text-[11px] font-bold text-white">Tabs+Products</p>
                <p className="text-[9px] text-neutral-400">Category tabs with items</p>
              </button>

              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('CATEGORY', 'checkmark', 'Category Checklist')}
                className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer group"
              >
                <div className="text-emerald-400 mb-1 group-hover:scale-110 transition-transform">☑ ≡</div>
                <p className="text-[11px] font-bold text-white">Checkmark</p>
                <p className="text-[9px] text-neutral-400">Checklist category list</p>
              </button>
            </div>
          </div>

          {/* Brand Widgets */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              BRAND WIDGETS
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('BRAND', 'circle', 'Brand Circles')}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-center transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-white block">Circle</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('BRAND', 'card_grid', 'Brand Grid')}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-center transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-white block">Card Grid</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('BRAND', 'banner', 'Brand Banner')}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-center transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-white block">Banner</span>
              </button>
            </div>
          </div>

          {/* Store & Media Banner */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              MEDIA BANNER & STORES
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('MEDIA_BANNER', 'banner', 'Media Full Width')}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-bold text-white block">Full Width</span>
                <span className="text-[9px] text-neutral-400">Edge-to-edge</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWidgetFromPalette('STORE', 'u_shape_grid', 'U-Shape Stores')}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-bold text-white block">U-Shape Grid</span>
                <span className="text-[9px] text-neutral-400">1 large + 2 small</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-800 text-[10px] text-neutral-400 text-center">
          Papo Hapo Widget Engine v3.4
        </div>
      </div>

      {/* MAIN CANVAS: PAGE CANVAS */}
      <div className="flex-1 space-y-4">
        {/* Canvas Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">Page Canvas</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full">
                  {widgets.length} widgets
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">Drag to reorder • Click to edit layout</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Canvas'}
            </button>
          </div>
        </div>

        {/* Widgets List */}
        <div className="space-y-2.5">
          {widgets.map((widget, idx) => {
            const isCategory = widget.type === 'CATEGORY';
            const isProduct = widget.type === 'PRODUCT';
            const isBrand = widget.type === 'BRAND';

            return (
              <motion.div
                key={widget.id}
                layout
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  widget.active 
                    ? 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-900/40 border-dashed border-neutral-300 dark:border-neutral-800 opacity-60'
                }`}
              >
                {/* Left section: drag handle, number, icon, info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-neutral-300 dark:text-neutral-600 cursor-grab hover:text-neutral-500">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <span className="w-7 h-7 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {widget.order}
                  </span>

                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    isCategory ? 'bg-emerald-500/10 text-emerald-600' :
                    isProduct ? 'bg-blue-500/10 text-blue-600' :
                    isBrand ? 'bg-amber-500/10 text-amber-600' :
                    'bg-purple-500/10 text-purple-600'
                  }`}>
                    {isCategory && <ShoppingBag className="w-4 h-4" />}
                    {isProduct && <Store className="w-4 h-4" />}
                    {isBrand && <Tag className="w-4 h-4" />}
                    {!isCategory && !isProduct && !isBrand && <ImageIcon className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {widget.title || 'Untitled Widget'}
                      </h4>

                      {/* Type badge */}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        isCategory ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        isProduct ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                        isBrand ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}>
                        {widget.type}
                      </span>

                      {/* Layout badge */}
                      {widget.tagLayout && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          {widget.tagLayout}
                        </span>
                      )}

                      {/* Auto badge */}
                      {widget.isAuto && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-600 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                          Auto
                        </span>
                      )}
                    </div>

                    {widget.subtitle && (
                      <p className="text-xs text-neutral-400 truncate max-w-md mt-0.5">
                        {widget.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right controls: Up, Down, Active switch, Edit, Duplicate, Delete */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveUp(idx)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-800 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === widgets.length - 1}
                    onClick={() => handleMoveDown(idx)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-800 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Active Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer ml-1">
                    <input
                      type="checkbox"
                      checked={widget.active}
                      onChange={() => handleToggleActive(widget.id)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>

                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(widget)}
                    className="p-2 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Edit Widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Duplicate button */}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(widget)}
                    className="p-2 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Duplicate Widget"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(widget.id, widget.title)}
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Delete Widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Edit Widget Modal */}
      <EditWidgetModal
        widget={editingWidget}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingWidget(null);
        }}
        onSave={handleSaveEditedWidget}
      />
    </div>
  );
};
