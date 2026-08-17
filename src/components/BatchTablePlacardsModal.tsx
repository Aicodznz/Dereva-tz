import React, { useState, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { 
  Printer, 
  Download, 
  X, 
  Sparkles, 
  Utensils, 
  Wifi, 
  CheckCircle2, 
  Loader2, 
  Layers, 
  Store, 
  Eye, 
  Flame, 
  ShoppingCart,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorProfile } from '../types';

interface MiniQrProps {
  data: string;
  size?: number;
  dotsColor?: string;
  dotsType?: any;
}

const MiniQrCode: React.FC<MiniQrProps> = ({ 
  data, 
  size = 48,
  dotsColor = '#000000',
  dotsType = 'square'
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!ref.current || !active) return;
      ref.current.innerHTML = '';
      try {
        const qr = new QRCodeStyling({
          width: size * 2,
          height: size * 2,
          type: 'svg',
          data: data || 'https://agiza.co.tz',
          dotsOptions: {
            color: dotsColor || '#000000',
            type: dotsType || 'square'
          },
          backgroundOptions: {
            color: '#ffffff'
          },
          margin: 2
        });
        qr.append(ref.current);
      } catch (err) {
        console.error('MiniQrCode render error:', err);
      }
    }, 80);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data, size, dotsColor, dotsType]);

  return (
    <div 
      ref={ref} 
      className="shrink-0 flex items-center justify-center bg-white rounded-lg p-0.5 border border-neutral-100 shadow-xs [&>svg]:w-full [&>svg]:h-full [&>svg]:block [&>canvas]:w-full [&>canvas]:h-full"
      style={{ width: size + 4, height: size + 4 }}
    />
  );
};

interface BatchTablePlacardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorProfile: VendorProfile | null;
  sections: any[];
  goldMenuSince: string;
  goldPrimaryColor: string;
  goldAccentColor: string;
  goldBgColorStart: string;
  goldBgColorEnd: string;
  goldCardBgColor: string;
  goldTextColor: string;
  goldDishes: any[];
  standWifiName: string;
  standWifiPass: string;
  standPortalUrl: string;
  standSalesPhone: string;
  standSupportEmail: string;
  goldLogoUrl?: string;
  showGoldLogo?: boolean;
}

export const BatchTablePlacardsModal: React.FC<BatchTablePlacardsModalProps> = ({
  isOpen,
  onClose,
  vendorProfile,
  sections,
  goldMenuSince,
  goldPrimaryColor,
  goldAccentColor,
  goldBgColorStart,
  goldBgColorEnd,
  goldCardBgColor,
  goldTextColor,
  goldDishes,
  standWifiName,
  standWifiPass,
  standPortalUrl,
  standSalesPhone,
  standSupportEmail,
  goldLogoUrl,
  showGoldLogo = true
}) => {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [customRangeCount, setCustomRangeCount] = useState<number>(() => Math.max(sections.length, 10));

  // Determine list of tables to generate
  const allTables = React.useMemo(() => {
    if (sections && sections.length > 0) {
      return sections.map(s => ({
        id: s.id,
        number: s.number || '01',
        capacity: s.capacity || 4,
        area: s.area || 'indoor'
      }));
    }
    // Fallback: Generate sequential tables 1..customRangeCount
    return Array.from({ length: customRangeCount }, (_, i) => ({
      id: `gen-table-${i + 1}`,
      number: `${i + 1}`,
      capacity: 4,
      area: 'dining'
    }));
  }, [sections, customRangeCount]);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedTables(allTables.map(t => t.number));
    }
  }, [isOpen, allTables]);

  if (!isOpen) return null;

  const toggleSelectTable = (tblNum: string) => {
    setSelectedTables(prev => 
      prev.includes(tblNum) ? prev.filter(n => n !== tblNum) : [...prev, tblNum]
    );
  };

  const selectAll = () => {
    setSelectedTables(allTables.map(t => t.number));
  };

  const deselectAll = () => {
    setSelectedTables([]);
  };

  const handlePrintAll = () => {
    window.print();
  };

  const handleDownloadAllZip = async () => {
    if (selectedTables.length === 0) {
      toast.error('Tafadhali chagua angalau meza moja ya kupakua.');
      return;
    }

    setIsGeneratingZip(true);
    setZipProgress(5);
    const toastId = toast.loading(`Inatengeneza picha za meza ${selectedTables.length} (ZIP)...`, {
      style: { background: '#000', color: '#fff' }
    });

    try {
      const zip = new JSZip();
      const folder = zip.folder(`Mabango_Meza_${(vendorProfile?.businessName || 'Mgahawa').replace(/\s+/g, '_')}`);

      const total = selectedTables.length;
      let completed = 0;

      for (const tblNum of selectedTables) {
        const placardEl = document.getElementById(`placard-card-${tblNum}`);
        if (placardEl) {
          // Wait for any images inside
          const imgElements = Array.from(placardEl.querySelectorAll('img'));
          await Promise.all(
            imgElements.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 800);
              });
            })
          );

          try {
            const dataUrl = await toPng(placardEl, {
              quality: 0.98,
              pixelRatio: 2.5,
              skipFonts: true,
              cacheBust: false
            });
            const base64Data = dataUrl.split(',')[1];
            folder?.file(`Bango_Stand_Meza_${tblNum}.png`, base64Data, { base64: true });
          } catch (err) {
            console.warn(`Failed to capture placard for table ${tblNum}`, err);
          }
        }
        completed++;
        setZipProgress(Math.round((completed / total) * 90));
      }

      setZipProgress(95);
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Mabango_Meza_Zote_${(vendorProfile?.businessName || 'Mgahawa').replace(/\s+/g, '_')}.zip`;
      link.click();
      URL.revokeObjectURL(downloadUrl);

      toast.success(`ZIP ya mabango ya meza ${selectedTables.length} imepakuliwa!`, { id: toastId });
    } catch (error) {
      console.error('Batch zip generation failed:', error);
      toast.error('Hitilafu wakati wa kuunda faili la ZIP. Jaribu kuchapisha (Print) moja kwa moja.', { id: toastId });
    } finally {
      setIsGeneratingZip(false);
      setZipProgress(0);
    }
  };

  const primaryDish = goldDishes && goldDishes.length > 0 ? goldDishes[0] : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar (Hidden during actual print) */}
      <div className="no-print bg-neutral-950 border-b border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                Pakua / Chapisha Mabango ya Meza Zote
              </h2>
              <Badge className="bg-amber-500 text-black font-black text-[9px] uppercase px-2">
                Batch PDF & ZIP
              </Badge>
            </div>
            <p className="text-xs text-neutral-400">
              Mabango {selectedTables.length} kati ya {allTables.length} yamechaguliwa kwa ajili ya {vendorProfile?.businessName || 'Duka'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="border-white/10 bg-white/5 text-neutral-300 hover:text-white text-xs font-bold"
          >
            Chagua Zote ({allTables.length})
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAll}
            className="border-white/10 bg-white/5 text-neutral-400 hover:text-white text-xs font-bold"
          >
            Acha Zote
          </Button>

          <Button
            type="button"
            onClick={handleDownloadAllZip}
            disabled={isGeneratingZip || selectedTables.length === 0}
            className="bg-amber-600 hover:bg-amber-500 text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-amber-950/50 cursor-pointer"
          >
            {isGeneratingZip ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-black" />
                Inatengeneza {zipProgress}%...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Pakua ZIP ({selectedTables.length})
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handlePrintAll}
            disabled={selectedTables.length === 0}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-110 text-white font-black uppercase text-xs tracking-wider shadow-xl shadow-orange-950/50 cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            Chapa / PDF (Print All)
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Scrollable Placards Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
        {/* Print Stylesheet for Multi-page Print */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .placard-print-page {
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 auto !important;
              padding: 20px 0 !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              height: 100vh !important;
              background: #000 !important;
            }
          }
        `}} />

        <div className="max-w-7xl mx-auto">
          {/* Instructions Banner */}
          <div className="no-print mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300 uppercase tracking-wide">
                Vidokezo vya Uchapishaji (Print Guidelines):
              </p>
              <p className="text-neutral-300 mt-0.5">
                Ukibonyeza <strong>"Chapa / PDF (Print All)"</strong>, kila meza itatokea kwenye ukurasa wake yenyewe (Page 1: Meza #1, Page 2: Meza #2...). Kwenye print settings chagua <em>"Save as PDF"</em> au chagua rangi kamili <em>"Background graphics: Enabled"</em>.
              </p>
            </div>
          </div>

          {/* Grid of Placards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center">
            {allTables.map((table) => {
              const isSelected = selectedTables.includes(table.number);
              const storeUrl = `${window.location.origin}/table/${vendorProfile?.id || ''}/${table.number}`;
              const dishQrUrl = primaryDish ? `${window.location.origin}/product/${primaryDish.id}?table=${table.number}` : storeUrl;

              return (
                <div 
                  key={table.id}
                  className={`placard-print-page relative flex flex-col items-center transition-all ${
                    isSelected ? 'opacity-100' : 'no-print opacity-30 grayscale'
                  }`}
                >
                  {/* Selection Checkbox (No-Print) */}
                  <div className="no-print absolute -top-3 left-4 z-40">
                    <button
                      type="button"
                      onClick={() => toggleSelectTable(table.number)}
                      className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-amber-500 text-black ring-2 ring-amber-400' 
                          : 'bg-neutral-800 text-neutral-400 border border-white/10'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-neutral-500'}`} />
                      Meza #{table.number} {isSelected ? '(Imechaguliwa)' : '(Imeachwa)'}
                    </button>
                  </div>

                  {/* Placard Container */}
                  <div
                    id={`placard-card-${table.number}`}
                    className="w-[360px] sm:w-[380px] rounded-[2.5rem] overflow-hidden relative shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-2 text-amber-100 p-4 sm:p-5 mt-4"
                    style={{
                      background: `radial-gradient(ellipse at top, ${goldBgColorStart} 0%, ${goldCardBgColor} 45%, ${goldBgColorEnd} 100%)`,
                      borderColor: `${goldPrimaryColor}b3`,
                      boxShadow: `0 0 35px ${goldAccentColor}26`,
                    }}
                  >
                    {/* Background Ambiance Glow */}
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 50% 0%, ${goldAccentColor}2e 0%, transparent 60%)`,
                      }}
                    ></div>

                    {/* Top Hanging Boards with Ropes */}
                    <div className="relative z-20 flex items-start justify-between mb-1 px-1">
                      {/* Left Hanging Sign: Fresh Tasty Healthy */}
                      <div className="flex flex-col items-center">
                        <div className="flex justify-between w-8 h-3 px-1">
                          <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                          <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                          <p className="text-[7.5px] font-serif italic leading-tight" style={{ color: goldTextColor }}>Fresh</p>
                          <p className="text-[7.5px] font-bold text-amber-100 leading-tight">Tasty ♡</p>
                          <p className="text-[7px] leading-tight" style={{ color: goldPrimaryColor }}>Healthy</p>
                        </div>
                      </div>

                      {/* Center Crest / Vendor Logo */}
                      <div className="flex flex-col items-center justify-center -mt-1 relative z-30">
                        {showGoldLogo && (goldLogoUrl || vendorProfile?.logoUrl) ? (
                          <div 
                            className="w-13 h-13 rounded-full flex items-center justify-center relative p-1 border-2 shadow-xl overflow-hidden bg-black/70"
                            style={{
                              borderColor: goldPrimaryColor,
                              boxShadow: `0 0 20px ${goldAccentColor}80, inset 0 0 12px rgba(0,0,0,0.8)`,
                            }}
                          >
                            <img 
                              src={goldLogoUrl || vendorProfile?.logoUrl || ''} 
                              alt="Logo" 
                              className="w-full h-full object-contain rounded-full drop-shadow-md"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-13 h-13 rounded-full flex flex-col items-center justify-center relative p-1 border-2 shadow-lg"
                            style={{
                              background: `linear-gradient(to bottom, ${goldBgColorStart}, #0d0905, ${goldCardBgColor})`,
                              borderColor: goldPrimaryColor,
                              boxShadow: `0 0 16px ${goldAccentColor}66`,
                            }}
                          >
                            <div className="text-[5.5px] font-black uppercase tracking-widest text-center leading-none" style={{ color: goldTextColor }}>
                              {vendorProfile?.businessName?.slice(0, 10) || 'RESTAURANT'}
                            </div>
                            <div className="text-[4.5px] font-mono tracking-tighter mb-0.5" style={{ color: `${goldTextColor}cc` }}>
                              {goldMenuSince || 'SINCE 2023'}
                            </div>
                            <div className="flex items-center justify-center gap-1 my-0.5">
                              <Utensils className="w-3 h-3" style={{ color: goldPrimaryColor }} />
                              <Flame className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
                            </div>
                            <div className="text-[5px]" style={{ color: goldPrimaryColor }}>★ ⚜ ★</div>
                          </div>
                        )}
                      </div>

                      {/* Right Hanging Sign: Karibu Sana */}
                      <div className="flex flex-col items-center">
                        <div className="flex justify-between w-8 h-3 px-1">
                          <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                          <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${goldPrimaryColor}, #78350f)` }}></div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-[#2b170c] border border-[#78350f] shadow-md text-center">
                          <p className="text-[7.5px] font-black uppercase tracking-wider text-amber-100 leading-tight">KARIBU</p>
                          <p className="text-[7.5px] font-black uppercase tracking-wider leading-tight" style={{ color: goldTextColor }}>SANA!</p>
                          <p className="text-[7px] leading-tight">❤️</p>
                        </div>
                      </div>
                    </div>

                    {/* Brand Name Title Banner */}
                    <div className="text-center my-2 relative z-20">
                      <h1 
                        className="text-lg sm:text-xl font-black uppercase tracking-tight font-sans drop-shadow-md leading-none truncate px-2"
                        style={{
                          background: `linear-gradient(to bottom, #ffffff 0%, ${goldTextColor} 50%, ${goldPrimaryColor} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.8))`,
                        }}
                      >
                        {vendorProfile?.businessName || 'MGAHAWA WA DHAHABU'}
                      </h1>

                      {/* Tagline / Ribbon */}
                      <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-full border border-amber-600/30 bg-black/40 shadow-inner">
                        <span className="text-[6px]" style={{ color: goldPrimaryColor }}>✦</span>
                        <span className="text-[7px] font-black uppercase tracking-[0.15em] text-neutral-300">
                          DELICIOUS FOOD • GREAT TASTE • HAPPY YOU
                        </span>
                        <span className="text-[6px]" style={{ color: goldPrimaryColor }}>✦</span>
                      </div>
                    </div>

                    {/* Featured Dish Card (with its QR) */}
                    {primaryDish && (
                      <div 
                        className="my-2 p-2.5 rounded-2xl border relative z-20 shadow-xl overflow-hidden flex items-center justify-between gap-2.5"
                        style={{
                          background: `linear-gradient(135deg, ${goldCardBgColor}cc, #0a0603ee)`,
                          borderColor: `${goldPrimaryColor}59`,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative w-12 h-12 rounded-full p-0.5 shrink-0" style={{ background: `linear-gradient(to bottom, #ef4444, ${goldPrimaryColor})` }}>
                            <img 
                              src={primaryDish.imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'} 
                              alt={primaryDish.name} 
                              className="w-full h-full rounded-full object-cover"
                              crossOrigin="anonymous"
                            />
                            <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[5.5px] font-black uppercase px-1 py-0.2 rounded-full shadow-xs">
                              BEST SELLER
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-white uppercase truncate">{primaryDish.name}</p>
                            <p className="text-[9px] font-black" style={{ color: goldTextColor }}>
                              TSH {primaryDish.price?.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* QR for Dish */}
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="p-1 bg-white rounded-lg shadow-sm border border-amber-500/40">
                            <MiniQrCode data={dishQrUrl} size={38} />
                          </div>
                          <span className="text-[5.5px] font-black uppercase tracking-tighter text-amber-300 mt-0.5">
                            SCAN TO ORDER
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Main Table QR Entrance Box */}
                    <div 
                      className="my-2.5 p-3.5 rounded-2xl border relative z-20 shadow-2xl flex items-center justify-between gap-3"
                      style={{
                        background: `linear-gradient(to right, #090604, ${goldCardBgColor}, #090604)`,
                        borderColor: `${goldPrimaryColor}80`,
                        boxShadow: `0 0 25px ${goldAccentColor}26`,
                      }}
                    >
                      <div className="shrink-0 flex items-center justify-center p-1.5 bg-white rounded-2xl shadow-xl">
                        <MiniQrCode data={storeUrl} size={62} />
                      </div>

                      <div className="flex-1 text-center space-y-1">
                        <p className="text-[8px] font-serif italic text-amber-200 tracking-wider">INGIA KWENYE</p>
                        <p 
                          className="text-base font-black uppercase tracking-wider leading-none"
                          style={{ color: goldTextColor }}
                        >
                          DUKA / MENYU
                        </p>
                        <div className="inline-block bg-red-600 text-white text-[6.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md">
                          CHANGANUA KWA SIMU YAKO
                        </div>
                        <p className="text-[5.5px] text-neutral-400 uppercase font-mono tracking-tighter">
                          FUNGUA DUKA KAMILI & PATA BIDHAA ZOTE!
                        </p>
                      </div>

                      <div className="w-10 h-10 rounded-full border border-amber-500/40 bg-black/60 flex flex-col items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4 text-amber-400" />
                        <span className="text-[4.5px] font-bold text-neutral-400 uppercase">EASY BUY</span>
                      </div>
                    </div>

                    {/* Guest WiFi Ribbon */}
                    {standWifiName && (
                      <div 
                        className="my-2 px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs"
                        style={{
                          background: 'rgba(0,0,0,0.6)',
                          borderColor: `${goldPrimaryColor}40`,
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3 h-3 text-amber-400" />
                          <div>
                            <span className="text-[6.5px] font-black uppercase tracking-wider block text-amber-300">GUEST WI-FI</span>
                            <span className="text-[7.5px] font-mono font-bold text-white leading-none">{standWifiName}</span>
                          </div>
                        </div>
                        {standWifiPass && (
                          <div className="text-right">
                            <span className="text-[6px] font-black text-neutral-400 uppercase tracking-widest block">PASSWORD</span>
                            <span className="text-[7.5px] font-mono font-bold text-amber-200">{standWifiPass}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Table Details: Table Number & Seating */}
                    <div className="grid grid-cols-3 gap-1.5 my-2">
                      <div 
                        className="p-2 rounded-xl border text-center flex flex-col items-center justify-center"
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          borderColor: `${goldPrimaryColor}50`,
                        }}
                      >
                        <div className="flex items-center gap-1 text-[6.5px] font-black uppercase text-amber-400">
                          <Utensils className="w-2.5 h-2.5" /> SECTION
                        </div>
                        <p className="text-sm font-black text-white mt-0.5">#{table.number}</p>
                      </div>

                      <div 
                        className="p-2 rounded-xl border text-center flex flex-col items-center justify-center"
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          borderColor: `${goldPrimaryColor}50`,
                        }}
                      >
                        <div className="flex items-center gap-1 text-[6.5px] font-black uppercase text-amber-400">
                          SEATING
                        </div>
                        <p className="text-xs font-black text-white mt-0.5">👥 {table.capacity} VITI</p>
                      </div>

                      <div 
                        className="p-1.5 rounded-xl border flex flex-col justify-center text-[5.5px] text-neutral-300 space-y-0.5"
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          borderColor: `${goldPrimaryColor}50`,
                        }}
                      >
                        <p className="font-bold text-amber-300 text-[6px] uppercase">MAALUMU YETU</p>
                        <p>☑ Ladha Halisi</p>
                        <p>☑ Huduma Bora</p>
                        <p>☑ Wateja wa Furaha ❤️</p>
                      </div>
                    </div>

                    {/* Footer Credentials */}
                    <div 
                      className="pt-2 border-t flex items-center justify-between text-[6px] text-neutral-400 font-mono tracking-tighter"
                      style={{ borderColor: `${goldPrimaryColor}33` }}
                    >
                      <div>
                        <span>PORTAL: </span>
                        <span className="text-white font-bold">{standPortalUrl || 'WWW.AGIZA.CO.TZ'}</span>
                      </div>
                      <div className="text-right">
                        <span>PHONE: </span>
                        <span className="text-amber-200 font-bold">{standSalesPhone || '+255 7XX XXX XXX'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
