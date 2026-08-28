import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, FileText, Upload, CheckCircle2, ShieldCheck, 
  Clock, MapPin, Sparkles, ChevronRight, ArrowLeft, Trash2, 
  Layers, Palette, BookOpen, Scissors, ShoppingBag, Plus, Minus,
  Truck, Store, AlertCircle, Eye, Download, Phone, Check, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { toast } from 'sonner';

interface UploadedDoc {
  id: string;
  name: string;
  size: string;
  pageCount: number;
  type: string;
  previewUrl?: string;
}

interface StationeryItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

const STATIONERY_ITEMS: StationeryItem[] = [
  { id: 'box-file', name: 'Box File (Ofisi & Nyaraka)', price: 4500, category: 'Faili', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&fit=crop' },
  { id: 'spring-file', name: 'Folder / Spring File', price: 1500, category: 'Faili', image: 'https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?w=300&fit=crop' },
  { id: 'pilot-pens', name: 'Pilot Ball Pen (Pakiti ya 3)', price: 2500, category: 'Kalamu', image: 'https://images.unsplash.com/photo-1585336261026-7f415c8df115?w=300&fit=crop' },
  { id: 'highlighter', name: 'Highlighters (Rangi 4)', price: 3500, category: 'Kalamu', image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=300&fit=crop' },
  { id: 'notebook', name: 'Counter Book / Daftari A4', price: 3000, category: 'Daftari', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=300&fit=crop' },
  { id: 'envelopes', name: 'Bahasha za Khaki A4 (Pakiti)', price: 2000, category: 'Bahasha', image: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=300&fit=crop' }
];

export const PrintService: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files state
  const [files, setFiles] = useState<UploadedDoc[]>([
    {
      id: 'demo-1',
      name: 'Ripoti_ya_Mradi_2026.pdf',
      size: '2.4 MB',
      pageCount: 14,
      type: 'application/pdf'
    }
  ]);

  // Print Configuration
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [paperSize, setPaperSize] = useState<'a4' | 'a3' | 'glossy' | 'card'>('a4');
  const [printSides, setPrintSides] = useState<'single' | 'double'>('single');
  const [binding, setBinding] = useState<'none' | 'staple' | 'spiral' | 'hardcover' | 'lamination'>('none');
  const [copies, setCopies] = useState<number>(1);
  const [customPages, setCustomPages] = useState<string>('Zote');

  // Stationery Cart
  const [stationeryCart, setStationeryCart] = useState<Record<string, number>>({});

  // Delivery details
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('Masaki, Haile Selassie Rd, Dar es Salaam');
  const [phone, setPhone] = useState('0755 123 456');
  const [instructions, setInstructions] = useState('');

  // Order Submission & Live Tracking State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const newFiles: UploadedDoc[] = Array.from(e.target.files).map((f, idx) => {
      const estimatedPages = f.type.includes('image') ? 1 : Math.floor(Math.random() * 8) + 3;
      return {
        id: `file-${Date.now()}-${idx}`,
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
        pageCount: estimatedPages,
        type: f.type,
        previewUrl: f.type.includes('image') ? URL.createObjectURL(f) : undefined
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`Nyaraka ${newFiles.length} zimepakiwa kikamilifu! 📄`);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast.info("Faili limeondolewa.");
  };

  // Pricing calculations
  const totalPages = files.reduce((acc, f) => acc + f.pageCount, 0);
  
  const getPagePrice = () => {
    let base = colorMode === 'color' ? 400 : 100;
    if (paperSize === 'a3') base *= 2;
    if (paperSize === 'glossy') base += 500;
    if (paperSize === 'card') base += 300;
    if (printSides === 'double') base = Math.round(base * 0.85); // 15% discount for 2-sided
    return base;
  };

  const getBindingPrice = () => {
    switch (binding) {
      case 'spiral': return 2500;
      case 'hardcover': return 12000;
      case 'lamination': return 1500 * (totalPages > 0 ? totalPages : 1);
      default: return 0;
    }
  };

  const printSubtotal = (totalPages * getPagePrice() + getBindingPrice()) * copies;
  
  const stationerySubtotal = Object.entries(stationeryCart).reduce((sum, [itemId, qty]) => {
    const item = STATIONERY_ITEMS.find(s => s.id === itemId);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const deliveryFee = deliveryType === 'delivery' ? 3000 : 0;
  const grandTotal = printSubtotal + stationerySubtotal + deliveryFee;

  const handleOrderSubmit = () => {
    if (files.length === 0) {
      toast.error("Tafadhali pakia angalau faili moja la ku-print!");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const newOrder = {
        id: `PRINT-${Math.floor(100000 + Math.random() * 900000)}`,
        filesCount: files.length,
        totalPages: totalPages * copies,
        colorMode,
        paperSize,
        binding,
        copies,
        deliveryType,
        deliveryAddress,
        phone,
        total: grandTotal,
        status: 'printing', // 'received' | 'printing' | 'binding' | 'dispatch' | 'delivered'
        createdAt: new Date().toLocaleTimeString()
      };
      setActiveOrder(newOrder);
      toast.success("Oda yako ya PapoPrint imepokelewa! 🖨️✨");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white pb-32">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5">
                PapoPrint
                <span className="text-[9px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Stationery & Print
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-neutral-500 font-bold">Kuchapa nyaraka, lamination, binding & vifaa vya ofisi</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 animate-bounce" />
            <span>Kasi ya 30min</span>
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Banner */}
        <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-700 text-white p-6 shadow-xl shadow-blue-500/10">
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider mb-2">
              🖨️ HUDUMA YA UHAKIKA YA STATIONERY
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Tuma Nyaraka Yako, Tukuchapie & Kukuletea Mlangoni!
            </h2>
            <p className="text-xs text-blue-100 font-medium mt-1.5">
              PDF, Word, Picha au Vitabu. Chagua rangi, binding au lamination, rider atakuletea popote ulipo jijini.
            </p>
          </div>
          <Printer className="absolute -right-6 -bottom-6 w-44 h-44 text-white/10 pointer-events-none" />
        </div>

        {/* 1. Document Upload Section */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                1
              </span>
              <div>
                <h3 className="text-sm font-black tracking-tight">Pakia Faili / Nyaraka (Upload)</h3>
                <p className="text-[11px] text-neutral-500 font-bold">PDF, Word (.docx), PowerPoint, au Picha</p>
              </div>
            </div>
            <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-xl">
              {files.length} Faili {totalPages > 0 ? `(${totalPages} Kurasa)` : ''}
            </span>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
            className="hidden" 
          />

          {/* Drag & Drop Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-neutral-50/50 dark:bg-neutral-950/40 group active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-black text-neutral-800 dark:text-neutral-200">
              Bonyeza au Buruta faili hapa kupakia
            </p>
            <p className="text-[10.5px] text-neutral-400 font-bold mt-0.5">
              Inasaidia PDF, Microsoft Word, PPT, JPG & PNG (Hadi 50MB)
            </p>
          </div>

          {/* Uploaded Files Queue */}
          {files.length > 0 && (
            <div className="space-y-2 pt-2">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate text-neutral-800 dark:text-neutral-200">{file.name}</p>
                      <p className="text-[10px] text-neutral-500 font-bold flex items-center gap-2 mt-0.5">
                        <span>{file.size}</span>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-black">{file.pageCount} Kurasa</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(file.id)}
                    className="w-8 h-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Print Configuration Matrix */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
              2
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight">Mipangilio ya Kuchapa (Print Specs)</h3>
              <p className="text-[11px] text-neutral-500 font-bold">Chagua rangi, ukubwa wa karatasi na binding</p>
            </div>
          </div>

          {/* Color Mode */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">Aina ya Rangi (Color Mode)</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setColorMode('bw')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  colorMode === 'bw'
                    ? 'border-neutral-950 dark:border-white bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black shadow-md'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div>
                  <p className="text-xs font-black flex items-center gap-1.5">
                    <span>Nyeusi & Nyeupe (B&W)</span>
                  </p>
                  <p className="text-[10px] opacity-70 mt-0.5">TZS 100 kwa ukurasa</p>
                </div>
                {colorMode === 'bw' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setColorMode('color')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  colorMode === 'color'
                    ? 'border-indigo-600 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div>
                  <p className="text-xs font-black flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Rangi Kamili (Full HD)</span>
                  </p>
                  <p className="text-[10px] opacity-80 mt-0.5">TZS 400 kwa ukurasa</p>
                </div>
                {colorMode === 'color' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </button>
            </div>
          </div>

          {/* Paper Size & Material */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">Aina ya Karatasi</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'a4', name: 'A4 Kawaida (80gsm)', tag: 'Standard' },
                { id: 'card', name: 'A4 Nene (120gsm)', tag: '+TZS 300' },
                { id: 'glossy', name: 'Glossy / Photo', tag: '+TZS 500' },
                { id: 'a3', name: 'A3 Kubwa (Poster)', tag: '2x Price' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaperSize(p.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paperSize === p.id 
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black' 
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold'
                  }`}
                >
                  <p className="text-xs">{p.name}</p>
                  <span className="text-[9px] opacity-70 block mt-0.5">{p.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Binding & Finishing */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">Binding & Lamination</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'none', label: 'Hakuna / Stapled', price: 'Bure', icon: Layers },
                { id: 'spiral', label: 'Spiral Wire Binding', price: '+TZS 2,500', icon: BookOpen },
                { id: 'hardcover', label: 'Hardcover (Thesis)', price: '+TZS 12,000', icon: BookOpen },
                { id: 'lamination', label: 'Plastiki (Lamination)', price: '+TZS 1,500/pg', icon: ShieldCheck }
              ].map((b) => {
                const BIcon = b.icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBinding(b.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      binding === b.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <BIcon className="w-4 h-4 mb-1.5 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-black">{b.label}</p>
                    <p className="text-[10px] text-neutral-500 font-bold">{b.price}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copies Stepper */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p className="text-xs font-black">Idadi ya Nakala (Copies)</p>
              <p className="text-[10px] text-neutral-400 font-bold">Unahitaji vitabu/nakala ngapi?</p>
            </div>
            <div className="flex items-center gap-3 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setCopies(Math.max(1, copies - 1))}
                className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center font-black active:scale-95 shadow-sm"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-black w-6 text-center">{copies}</span>
              <button
                type="button"
                onClick={() => setCopies(copies + 1)}
                className="w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center font-black active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Add-on Stationery Store */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                3
              </span>
              <div>
                <h3 className="text-sm font-black tracking-tight">Ongeza Vifaa vya Stationery (Add-ons)</h3>
                <p className="text-[11px] text-neutral-500 font-bold">Faili, Kalamu, Daftari na Bahasha</p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">
              Optional
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STATIONERY_ITEMS.map((item) => {
              const qty = stationeryCart[item.id] || 0;
              return (
                <div 
                  key={item.id}
                  className="p-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col justify-between"
                >
                  <div className="h-20 rounded-xl overflow-hidden mb-2">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black line-clamp-1">{item.name}</h4>
                    <p className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      TZS {item.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-neutral-200/50 dark:border-neutral-800 flex items-center justify-between">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => setStationeryCart(prev => ({ ...prev, [item.id]: 1 }))}
                        className="w-full py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-transform"
                      >
                        <Plus className="w-3 h-3" /> Ongeza
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between bg-white dark:bg-neutral-800 rounded-xl p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const newQ = qty - 1;
                            setStationeryCart(prev => {
                              const updated = { ...prev };
                              if (newQ <= 0) delete updated[item.id];
                              else updated[item.id] = newQ;
                              return updated;
                            });
                          }}
                          className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center font-black text-xs"
                        >
                          -
                        </button>
                        <span className="text-xs font-black">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setStationeryCart(prev => ({ ...prev, [item.id]: qty + 1 }))}
                          className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center font-black text-xs"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Delivery Method & Destination */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm">
              4
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight">Njia ya Kupokea (Delivery / Pickup)</h3>
              <p className="text-[11px] text-neutral-500 font-bold">Leta mlangoni au chukua dukani</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                deliveryType === 'delivery'
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <Truck className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-black">Lete Mlangoni (Doorstep)</p>
              <p className="text-[10px] text-neutral-500 font-bold">+TZS 3,000 (Rider Express)</p>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                deliveryType === 'pickup'
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <Store className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-black">Chukua Dukani (Self-Pickup)</p>
              <p className="text-[10px] text-neutral-500 font-bold">Bure (Kwenye Stationery)</p>
            </button>
          </div>

          {deliveryType === 'delivery' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Anwani ya Kuletewa</label>
                <div className="flex items-center gap-2 mt-1 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-2xl">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Weka anwani kamili ya ofisi au nyumba..."
                    className="w-full bg-transparent border-none focus:outline-none text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Namba ya Simu</label>
                <div className="flex items-center gap-2 mt-1 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-2xl">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="w-full bg-transparent border-none focus:outline-none text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Summary & Instant Checkout Sticky Bar */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">Muhtasari wa Gharama</h3>
            <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
              Papo Hapo Verified
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-300">
              <span>Kuchapa ({totalPages * copies} kurasa • {colorMode === 'bw' ? 'B&W' : 'Color'})</span>
              <span className="font-bold">TZS {(totalPages * getPagePrice() * copies).toLocaleString()}</span>
            </div>
            {getBindingPrice() > 0 && (
              <div className="flex justify-between text-neutral-300">
                <span>Binding / Lamination</span>
                <span className="font-bold">TZS {(getBindingPrice() * copies).toLocaleString()}</span>
              </div>
            )}
            {stationerySubtotal > 0 && (
              <div className="flex justify-between text-neutral-300">
                <span>Vifaa vya Stationery ({Object.values(stationeryCart).reduce((a, b) => a + b, 0)} items)</span>
                <span className="font-bold">TZS {stationerySubtotal.toLocaleString()}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-neutral-300">
                <span>Usafirishaji wa Rider (Express Doorstep)</span>
                <span className="font-bold">TZS {deliveryFee.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Jumla Kuu</p>
              <p className="text-2xl font-black text-white">TZS {grandTotal.toLocaleString()}</p>
            </div>

            <button
              type="button"
              onClick={handleOrderSubmit}
              disabled={isSubmitting || files.length === 0}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Inatuma Oda...</span>
                </>
              ) : (
                <>
                  <span>Agiza Kuchapa Sasa</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Order Tracker Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-6 max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Printer className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Oda Imethibitishwa: {activeOrder.id}
              </span>
              <h3 className="text-xl font-black mt-2">Nyaraka Zinaanza Kuchapwa!</h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                Mashine ya kisasa ya stationery inachapa kurasa zako {activeOrder.totalPages}. Utapokea ujumbe punde tu rider anapoanza safari.
              </p>
            </div>

            {/* Tracking Steps */}
            <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl p-4 text-left space-y-3 border border-neutral-200/50 dark:border-neutral-700/50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black">✓</span>
                <p className="text-xs font-black">Oda na Faili Zimepokewa</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black animate-spin">⟳</span>
                <p className="text-xs font-black text-blue-600 dark:text-blue-400">Inachapwa na Kufungashwa ({activeOrder.binding !== 'none' ? activeOrder.binding : 'Standard'})</p>
              </div>
              <div className="flex items-center gap-3 opacity-40">
                <span className="w-6 h-6 rounded-full bg-neutral-300 dark:bg-neutral-600 text-neutral-800 flex items-center justify-center text-xs font-black">3</span>
                <p className="text-xs font-bold">Rider Kusafirisha ({activeOrder.deliveryType === 'delivery' ? activeOrder.deliveryAddress : 'Pickup Dukani'})</p>
              </div>
            </div>

            <button
              onClick={() => setActiveOrder(null)}
              className="w-full py-3.5 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider"
            >
              Sawa, Nimeelewa
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PrintService;
