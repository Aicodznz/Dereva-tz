import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Copy, ArrowUp, ArrowDown, GripVertical, 
  Sparkles, ShoppingBag, Tag, Image as ImageIcon, Store,
  Save, RotateCcw, LayoutGrid, ExternalLink, Eye, Box,
  CheckCircle2, ChevronRight, Layers, Smartphone, Laptop,
  HelpCircle, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CanvasWidget, WidgetCategoryType, WidgetDisplayStyle } from '../../types/widgetCanvas';
import { EditWidgetModal } from './EditWidgetModal';
import { WebsiteLivePreview } from './WebsiteLivePreview';
import { WebsiteBuilderAiCopilot } from './WebsiteBuilderAiCopilot';
import { toast } from 'sonner';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export const CHANNELS = [
  { id: 'grocery', name: 'Grocery' },
  { id: 'ramadan', name: 'Ramadam' },
  { id: 'food', name: 'Food' },
  { id: 'fresh', name: 'Fresh' },
  { id: 'ecommerce', name: 'Ecommerce' },
  { id: 'pharmacy', name: 'Pharmacy' },
  { id: 'gift', name: 'Gift' },
  { id: 'noon', name: 'Noon' },
  { id: 'demo', name: 'demo' },
];

// Presets for the 9 channels
const CHANNEL_PRESETS: Record<string, CanvasWidget[]> = {
  grocery: [
    {
      id: 'gw-1',
      order: 1,
      type: 'PRODUCT',
      title: '🔥 Trending Products',
      subtitle: 'Popular items trending right now across town',
      showTitleInApp: true,
      active: true,
      displayStyle: 'grid',
      contentSource: 'featured',
      selectedItemIds: ['item-1', 'item-2', 'item-15', 'item-16'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 6,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Grid'
    },
    {
      id: 'gw-2',
      order: 2,
      type: 'CATEGORY',
      title: 'Snacks',
      subtitle: 'Delicious Bites & Refreshing Sips',
      showTitleInApp: true,
      active: true,
      displayStyle: 'card_grid',
      contentSource: 'featured',
      selectedItemIds: ['item-13', 'item-14'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 7,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'CATEGORY',
      tagLayout: 'Card Grid'
    },
    {
      id: 'gw-3',
      order: 3,
      type: 'CATEGORY',
      title: 'Grocery',
      subtitle: 'Shop Smart, Live Better',
      showTitleInApp: true,
      active: true,
      displayStyle: 'card_grid',
      contentSource: 'featured',
      selectedItemIds: ['item-1', 'item-15'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 7,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'CATEGORY',
      tagLayout: 'Card Grid'
    },
    {
      id: 'gw-4',
      order: 4,
      type: 'CATEGORY',
      title: 'Beauty & Personal Care',
      subtitle: 'Essential skincare, hair & bath essentials',
      showTitleInApp: true,
      active: true,
      displayStyle: 'card_grid',
      contentSource: 'featured',
      selectedItemIds: ['item-7', 'item-8', 'item-9'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 7,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'CATEGORY',
      tagLayout: 'Card Grid'
    },
    {
      id: 'gw-5',
      order: 5,
      type: 'PRODUCT',
      title: "Best prices you'll love! 🔥",
      subtitle: 'Limited time saving deals & discounts',
      showTitleInApp: true,
      active: true,
      displayStyle: 'horizontal',
      contentSource: 'featured',
      selectedItemIds: ['item-11'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 5,
      rowsCount: 1,
      autoScrollAnimation: true,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Horizontal'
    },
    {
      id: 'gw-6',
      order: 6,
      type: 'PRODUCT',
      title: 'New Grocery Arrivals ✨',
      subtitle: 'Just landed in stock for quick delivery',
      showTitleInApp: true,
      active: true,
      displayStyle: 'grid',
      contentSource: 'recent',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 6,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Grid'
    },
    {
      id: 'gw-7',
      order: 7,
      type: 'PRODUCT',
      title: 'Amul Collection 🧈',
      subtitle: 'Milk, Butter, Cheese & More',
      showTitleInApp: true,
      active: true,
      displayStyle: 'card_grid',
      contentSource: 'custom',
      selectedItemIds: ['item-2'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 5,
      rowsCount: 1,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Large Card'
    },
    {
      id: 'gw-8',
      order: 8,
      type: 'CATEGORY',
      title: 'Browse by Category 🔍',
      subtitle: 'Browse Products by Category',
      showTitleInApp: true,
      active: true,
      displayStyle: 'tabs_products',
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 5,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'CATEGORY',
      tagLayout: 'Tabs+Products'
    },
    {
      id: 'gw-9',
      order: 9,
      type: 'PRODUCT',
      title: 'Customer Favorites ⭐⭐⭐⭐',
      subtitle: 'Handpicked Just for You',
      showTitleInApp: true,
      active: true,
      displayStyle: 'grid',
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 7,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Grid'
    },
  ],
  ramadan: [
    {
      id: 'rw-1',
      order: 1,
      type: 'MEDIA_BANNER',
      title: 'Ramadan Kareem Specials 🌙',
      subtitle: 'Punguzo la Iftar, Tende na Vyakula vya Daku',
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
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#1e1b4b',
      showViewAllButton: false,
      tagLabel: 'BANNER',
      tagLayout: 'Full Width'
    },
    {
      id: 'rw-2',
      order: 2,
      type: 'PRODUCT',
      title: 'Iftar & Suhur Essentials 🥣',
      subtitle: 'Tende safi, Maziwa, Juisi asilia na Vyakula vya Futari',
      showTitleInApp: true,
      active: true,
      displayStyle: 'horizontal',
      contentSource: 'featured',
      selectedItemIds: ['item-15', 'item-16'],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 2,
      desktopItemsPerRow: 5,
      rowsCount: 1,
      autoScrollAnimation: true,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'PRODUCT',
      tagLayout: 'Horizontal'
    },
    {
      id: 'rw-3',
      order: 3,
      type: 'CATEGORY',
      title: 'Vitafunwa vya Futari 🥐',
      subtitle: 'Sambusa, Bajia, Chapati & Supu',
      showTitleInApp: true,
      active: true,
      displayStyle: 'card_grid',
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 6,
      rowsCount: 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: 'CATEGORY',
      tagLayout: 'Card Grid'
    },
    {
      id: 'rw-4',
      order: 4,
      type: 'BRAND',
      title: 'Top Ramadan Brands 🏷️',
      subtitle: 'Azam, Bakhresa, Amul, Mo Extra & Sayona',
      showTitleInApp: true,
      active: true,
      displayStyle: 'circle',
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: 3,
      desktopItemsPerRow: 6,
      rowsCount: 1,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: false,
      tagLabel: 'BRAND',
      tagLayout: 'Circle Logos'
    }
  ]
};

export const WidgetCanvasBuilder: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<string>('grocery');
  const [widgets, setWidgets] = useState<CanvasWidget[]>(() => {
    const saved = localStorage.getItem(`omniserve_canvas_widgets_grocery`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return CHANNEL_PRESETS.grocery;
  });

  const [editingWidget, setEditingWidget] = useState<CanvasWidget | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load widgets when channel switches
  useEffect(() => {
    const loadChannelData = async () => {
      // 1. Try local storage
      const localKey = `omniserve_canvas_widgets_${activeChannel}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWidgets(parsed);
            return;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      // 2. Try Firebase
      try {
        const snap = await getDoc(doc(db, 'config', `page_canvas_widgets_${activeChannel}`));
        if (snap.exists() && snap.data().items) {
          setWidgets(snap.data().items);
          return;
        }
      } catch (e) {
        console.warn(`Could not load widgets from firebase for ${activeChannel}:`, e);
      }

      // 3. Fallback to preset or generic
      const fallback = CHANNEL_PRESETS[activeChannel] || CHANNEL_PRESETS.grocery;
      setWidgets(fallback);
    };

    loadChannelData();
  }, [activeChannel]);

  // Save All handler
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const localKey = `omniserve_canvas_widgets_${activeChannel}`;
      localStorage.setItem(localKey, JSON.stringify(widgets));
      
      // Also save to generic key for customer home sync
      if (activeChannel === 'grocery') {
        localStorage.setItem('omniserve_canvas_widgets', JSON.stringify(widgets));
      }

      await setDoc(doc(db, 'config', `page_canvas_widgets_${activeChannel}`), {
        items: widgets,
        channel: activeChannel,
        updatedAt: new Date().toISOString()
      });
      
      toast.success(`Mpangilio wa "${activeChannel.toUpperCase()}" umehifadhiwa kikamilifu!`);
    } catch (err: any) {
      toast.error("Imeshindwa kuhifadhi: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset handler
  const handleResetToDefault = () => {
    const preset = CHANNEL_PRESETS[activeChannel] || CHANNEL_PRESETS.grocery;
    if (confirm(`Je, unataka kurejesha mpangilio wa awali wa "${activeChannel}"?`)) {
      setWidgets(preset);
      localStorage.setItem(`omniserve_canvas_widgets_${activeChannel}`, JSON.stringify(preset));
      toast.success("Mpangilio umerudishwa!");
    }
  };

  // Move up/down
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...widgets];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
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

  // Native Drag and Drop Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    // Check if dragging palette item
    const paletteData = e.dataTransfer.getData('application/json');
    if (paletteData) {
      try {
        const item = JSON.parse(paletteData);
        handleAddWidgetFromPalette(item.type, item.displayStyle, item.label, targetIndex);
        return;
      } catch (err) {
        console.warn(err);
      }
    }

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const updated = [...widgets];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    updated.forEach((w, idx) => { w.order = idx + 1; });
    setWidgets(updated);
    setDraggedIndex(null);
    toast.success(`Nafasi ya "${moved.title}" imebadilishwa!`);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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

  const handleAddWidgetFromPalette = (
    type: WidgetCategoryType, 
    displayStyle: WidgetDisplayStyle, 
    label: string,
    insertAtIndex?: number
  ) => {
    const isBanner = type === 'MEDIA_BANNER';
    const isCategory = type === 'CATEGORY';
    const isBrand = type === 'BRAND';
    const isStore = type === 'STORE';

    const newWidget: CanvasWidget = {
      id: `widget-${Date.now()}`,
      order: widgets.length + 1,
      type,
      title: `New ${label}`,
      subtitle: isBanner ? 'Punguzo maalum kwa wateja wote' : 'Handpicked items for quick shopping',
      showTitleInApp: true,
      active: true,
      displayStyle,
      contentSource: 'featured',
      selectedItemIds: [],
      deviceTarget: 'all',
      mobileVisible: true,
      desktopVisible: true,
      mobileItemsPerRow: isBanner ? 1 : 2,
      desktopItemsPerRow: isBanner ? 1 : (isCategory ? 6 : (isBrand ? 6 : 6)),
      rowsCount: isBanner ? 1 : 2,
      autoScrollAnimation: false,
      customBackgroundEnabled: false,
      backgroundType: 'solid',
      backgroundColor: '#fff0e5',
      showViewAllButton: true,
      tagLabel: type,
      tagLayout: label
    };

    let updatedList: CanvasWidget[];
    if (typeof insertAtIndex === 'number') {
      updatedList = [...widgets];
      updatedList.splice(insertAtIndex, 0, newWidget);
      updatedList.forEach((w, idx) => { w.order = idx + 1; });
    } else {
      updatedList = [...widgets, newWidget];
    }

    setWidgets(updatedList);
    toast.success(`Widget ya ${label} imeongezwa!`);
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

  const handleApplyAiWidgets = (newWidgets: CanvasWidget[]) => {
    setWidgets(newWidgets);
  };

  return (
    <div className="flex flex-col bg-[#0b0f19] text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* 1. TOP HEADER BAR: Channel Tabs & Global Controls */}
      <div className="bg-[#0f172a] border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left Title + Icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            Website Builder
          </h1>
        </div>

        {/* Center: Channel Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {ch.name}
              </button>
            );
          })}
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* AI Copilot Button */}
          <button
            type="button"
            onClick={() => setIsAiCopilotOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>AI Msaidizi</span>
          </button>

          {/* Live Preview Button */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            <span>Preview Site</span>
          </button>

          {/* Widgets Count Badge */}
          <span className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400">
            {widgets.length} widgets
          </span>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Inahifadhi...' : 'Save Canvas'}</span>
          </button>
        </div>
      </div>

      {/* 2. BODY LAYOUT: Left Sidebar + Center Canvas */}
      <div className="flex flex-col lg:flex-row min-h-[750px]">
        
        {/* LEFT SIDEBAR: WEBSITE LAYOUT WIDGETS */}
        <div className="w-full lg:w-72 bg-[#0d1424] border-r border-slate-800/80 p-5 shrink-0 flex flex-col justify-between select-none">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                WEBSITE LAYOUT WIDGETS
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Click to add to canvas</p>
            </div>

            {/* PRODUCT WIDGETS */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                PRODUCT WIDGETS
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'PRODUCT', displayStyle: 'grid', label: 'Grid' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('PRODUCT', 'grid', 'Grid (2-6 Cols)')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Grid (2-6 Cols)</p>
                    <p className="text-[10px] text-slate-400 truncate">Responsive product...</p>
                  </div>
                </button>

                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'PRODUCT', displayStyle: 'horizontal', label: 'Horizontal' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('PRODUCT', 'horizontal', 'Horizontal Row')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Horizontal Row</p>
                    <p className="text-[10px] text-slate-400 truncate">Swipeable product...</p>
                  </div>
                </button>

                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'PRODUCT', displayStyle: 'item_list', label: 'Item List' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('PRODUCT', 'item_list', 'Item List')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="text-base font-black">☰</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Item List</p>
                    <p className="text-[10px] text-slate-400 truncate">2-column desktop...</p>
                  </div>
                </button>
              </div>
            </div>

            {/* CATEGORY WIDGETS */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                CATEGORY WIDGETS
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'CATEGORY', displayStyle: 'circle', label: 'Circle Row' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('CATEGORY', 'circle', 'Circle Row')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-xs font-black">
                    ● ● ●
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Circle Row</p>
                    <p className="text-[10px] text-slate-400 truncate">Icon circles row</p>
                  </div>
                </button>

                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'CATEGORY', displayStyle: 'card_grid', label: 'Category Grid' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('CATEGORY', 'card_grid', 'Category Grid')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Category Grid</p>
                    <p className="text-[10px] text-slate-400 truncate">2-6 column categor...</p>
                  </div>
                </button>

                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'CATEGORY', displayStyle: 'tabs_products', label: 'Tabs + Items' }));
                  }}
                  onClick={() => handleAddWidgetFromPalette('CATEGORY', 'tabs_products', 'Tabs + Items')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-xs font-black">
                    日⇄
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Tabs + Items</p>
                    <p className="text-[10px] text-slate-400 truncate">Category tabs with i...</p>
                  </div>
                </button>
              </div>
            </div>

            {/* BRAND WIDGETS */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                BRAND WIDGETS
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('BRAND', 'circle', 'Circle Logos')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Circle Logos</p>
                    <p className="text-[10px] text-slate-400 truncate">Circular brand logos</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('BRAND', 'card_grid', 'Brand Grid')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Brand Grid</p>
                    <p className="text-[10px] text-slate-400 truncate">Grid of brand logos</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('BRAND', 'banner', 'Brand Strip')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="w-4 h-2 bg-amber-400 rounded-xs" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Brand Strip</p>
                    <p className="text-[10px] text-slate-400 truncate">Full-width brand ba...</p>
                  </div>
                </button>
              </div>
            </div>

            {/* WEBSITE BANNERS */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                WEBSITE BANNERS
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('MEDIA_BANNER', 'banner', 'Full Width Banner')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Full Width</p>
                    <p className="text-[10px] text-slate-400 truncate">Edge-to-edge web...</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('MEDIA_BANNER', 'banner', 'Container Banner')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="w-3.5 h-3.5 border border-purple-400 rounded-xs" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Container</p>
                    <p className="text-[10px] text-slate-400 truncate">Padded layout bann...</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('MEDIA_BANNER', 'banner', 'Rounded Banner')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <span className="w-3.5 h-3.5 border border-purple-400 rounded-lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Rounded</p>
                    <p className="text-[10px] text-slate-400 truncate">Rounded corners b...</p>
                  </div>
                </button>
              </div>
            </div>

            {/* STORE WIDGETS */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                STORE WIDGETS
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('STORE', 'u_shape_grid', 'Store Grid')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Store Grid</p>
                    <p className="text-[10px] text-slate-400 truncate">2-5 column store grid</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddWidgetFromPalette('STORE', 'horizontal_scroll', 'Horizontal Row')}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">Horizontal Row</p>
                    <p className="text-[10px] text-slate-400 truncate">Swipeable store row</p>
                  </div>
                </button>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            Papo Hapo No-Code Engine v4.0
          </div>
        </div>

        {/* CENTER: WEBSITE HOME CANVAS */}
        <div className="flex-1 p-4 sm:p-6 space-y-4 bg-[#0a0e1a] overflow-y-auto">
          
          {/* Canvas Subheader */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="text-slate-400">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white">
                Website Home Canvas
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-950/60 text-indigo-300 border border-indigo-700/50">
                {widgets.length} widgets
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Drag handles to reorder • Click widget to edit grid columns & styles
            </p>
          </div>

          {/* Reorderable Widgets List */}
          <div className="space-y-2">
            {widgets.map((widget, idx) => {
              const isCategory = widget.type === 'CATEGORY';
              const isProduct = widget.type === 'PRODUCT';
              const isBrand = widget.type === 'BRAND';
              const isBanner = widget.type === 'MEDIA_BANNER';
              const isStore = widget.type === 'STORE';

              const isDragging = draggedIndex === idx;
              const isTargetOver = dragOverIndex === idx;

              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                    isDragging
                      ? 'opacity-40 border-dashed border-indigo-500 bg-indigo-950/30'
                      : isTargetOver
                        ? 'border-indigo-400 bg-indigo-950/40 shadow-lg scale-[1.01]'
                        : widget.active
                          ? 'bg-[#111726] border-slate-800 hover:border-slate-700 shadow-sm'
                          : 'bg-[#0e1320] border-dashed border-slate-800/80 opacity-50'
                  }`}
                >
                  {/* Left items: Grip, Number, Icon, Title, Badges, Subtitle */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    
                    {/* Drag Handle */}
                    <div className="text-slate-500 hover:text-slate-200 cursor-grab active:cursor-grabbing p-0.5">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Sequential Number */}
                    <span className="w-6 h-6 rounded-lg bg-slate-800/90 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Type Visual Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isProduct ? 'bg-blue-500/10 text-blue-400' :
                      isCategory ? 'bg-emerald-500/10 text-emerald-400' :
                      isBrand ? 'bg-amber-500/10 text-amber-400' :
                      isBanner ? 'bg-purple-500/10 text-purple-400' :
                      'bg-orange-500/10 text-orange-400'
                    }`}>
                      {isProduct && <Box className="w-4 h-4" />}
                      {isCategory && <ShoppingBag className="w-4 h-4" />}
                      {isBrand && <Tag className="w-4 h-4" />}
                      {isBanner && <ImageIcon className="w-4 h-4" />}
                      {isStore && <Store className="w-4 h-4" />}
                    </div>

                    {/* Details Column */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 
                          onClick={() => handleOpenEdit(widget)}
                          className="text-xs sm:text-sm font-bold text-white hover:text-indigo-400 cursor-pointer transition-colors truncate"
                        >
                          {widget.title}
                        </h3>

                        {/* Type Badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          isProduct ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' :
                          isCategory ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' :
                          isBrand ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' :
                          isBanner ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50' :
                          'bg-orange-900/60 text-orange-300 border border-orange-700/50'
                        }`}>
                          {widget.type}
                        </span>

                        {/* Display Style Sub-badge */}
                        {widget.tagLayout && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {widget.tagLayout}
                          </span>
                        )}

                        {/* Responsive Column Indicator Badge */}
                        <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-indigo-950/50 text-indigo-300 border border-indigo-800/40">
                          Mobile: {widget.mobileItemsPerRow || 2} cols | Laptop: {widget.desktopItemsPerRow || 6} cols
                        </span>
                      </div>

                      {widget.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xl mt-0.5">
                          {widget.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Up, Down, Active switch, Edit, Duplicate, Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    
                    {/* Move Up/Down */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === widgets.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Active Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer ml-1">
                      <input
                        type="checkbox"
                        checked={widget.active}
                        onChange={() => handleToggleActive(widget.id)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(widget)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Widget"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate Button */}
                    <button
                      type="button"
                      onClick={() => handleDuplicate(widget)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Duplicate Widget"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(widget.id, widget.title)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Delete Widget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action bar */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Channel Defaults
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Open Live Responsive Preview
            </button>
          </div>
        </div>

      </div>

      {/* 3. EDIT WIDGET MODAL */}
      <EditWidgetModal
        widget={editingWidget}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingWidget(null);
        }}
        onSave={handleSaveEditedWidget}
      />

      {/* 4. REAL-TIME RESPONSIVE PREVIEW MODAL */}
      <WebsiteLivePreview
        widgets={widgets}
        activeChannel={activeChannel}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onEditWidget={(w) => {
          setIsPreviewOpen(false);
          handleOpenEdit(w);
        }}
      />

      {/* 5. AI WEBSITE ARCHITECT COPILOT */}
      <WebsiteBuilderAiCopilot
        isOpen={isAiCopilotOpen}
        onClose={() => setIsAiCopilotOpen(false)}
        activeChannel={activeChannel}
        currentWidgets={widgets}
        onApplyWidgets={handleApplyAiWidgets}
      />

    </div>
  );
};
