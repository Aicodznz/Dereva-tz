import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCodeStyling from 'qr-code-styling';
import { 
  MapPin, Compass, QrCode, Save, Sparkles, Store, Scissors, 
  Coffee, Gift, Heart, Star, Download, Printer, Upload, CheckCircle2,
  Route, Layers, Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Leaflet default icon fix
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface VendorMapQRSetupProps {
  vendorProfile: any;
}

const AR_ICONS_LIST = [
  { id: 'store', label: 'Duka / Store', icon: Store },
  { id: 'scissors', label: 'Saluni / Salon', icon: Scissors },
  { id: 'coffee', label: 'Kahawa / Café', icon: Coffee },
  { id: 'gift', label: 'Zawadi / Gift', icon: Gift },
  { id: 'heart', label: 'Kipenzi / Heart', icon: Heart },
  { id: 'star', label: 'Nyota / Star', icon: Star },
  { id: 'mappin', label: 'Kigingi / Pin', icon: MapPin },
];

const COLORS_LIST = [
  { id: 'orange', value: '#ea580c', label: 'Orange' },
  { id: 'red', value: '#dc2626', label: 'Red' },
  { id: 'green', value: '#16a34a', label: 'Green' },
  { id: 'blue', value: '#2563eb', label: 'Blue' },
  { id: 'purple', value: '#9333ea', label: 'Purple' },
  { id: 'yellow', value: '#ca8a04', label: 'Yellow' },
  { id: 'pink', value: '#db2777', label: 'Pink' },
];

export default function VendorMapQRSetup({ vendorProfile }: VendorMapQRSetupProps) {
  const [lat, setLat] = useState<number>(vendorProfile?.location?.lat || -6.7924);
  const [lng, setLng] = useState<number>(vendorProfile?.location?.lng || 39.2083);
  const [arDirections, setArDirections] = useState<string>(vendorProfile?.arDirections || '');
  const [arIcon, setArIcon] = useState<string>(vendorProfile?.arIcon || 'store');
  const [arColor, setArColor] = useState<string>(vendorProfile?.arColor || '#ea580c');
  const [arImageUrl, setArImageUrl] = useState<string>(vendorProfile?.arImageUrl || '');
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('satellite');
  
  const [isSaving, setIsSaving] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrCodeInstance, setQrCodeInstance] = useState<QRCodeStyling | null>(null);

  // Generate deep link
  const qrLinkData = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?ar_vendor_id=${vendorProfile?.id}`;
  }, [vendorProfile?.id]);

  // Leaflet marker handlers
  function DraggableMarker() {
    const markerRef = useRef<any>(null);
    const eventHandlers = useMemo(
      () => ({
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const pos = marker.getLatLng();
            setLat(pos.lat);
            setLng(pos.lng);
          }
        },
      }),
      [],
    );
    return (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        position={[lat, lng]}
        icon={DefaultIcon}
        ref={markerRef}
      />
    );
  }

  function MapEvents() {
    useMapEvents({
      click(e) {
        setLat(e.latlng.lat);
        setLng(e.latlng.lng);
      }
    });
    return null;
  }

  // Draw & update QR Code
  useEffect(() => {
    if (typeof window === 'undefined' || !qrRef.current) return;
    try {
      qrRef.current.innerHTML = '';
      
      const qr = new QRCodeStyling({
        width: 260,
        height: 260,
        type: 'svg',
        data: qrLinkData || 'https://papo-hapo.com',
        dotsOptions: {
          color: arColor || '#ea580c',
          type: 'extra-rounded'
        },
        backgroundOptions: {
          color: '#ffffff'
        },
        cornersSquareOptions: {
          color: arColor || '#ea580c',
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: '#0f172a',
          type: 'dot'
        },
        imageOptions: {
          crossOrigin: 'anonymous',
          margin: 6,
          imageSize: 0.4
        },
        image: vendorProfile?.logoUrl || undefined,
        margin: 8
      });

      qr.append(qrRef.current);
      setQrCodeInstance(qr);
    } catch (err) {
      console.error('Error styling QR Code:', err);
    }
  }, [qrLinkData, arColor, vendorProfile?.logoUrl]);

  // Handle Save
  const handleSaveConfig = async () => {
    if (!vendorProfile?.id) return;
    setIsSaving(true);
    try {
      const ref = doc(db, 'vendors', vendorProfile.id);
      await updateDoc(ref, {
        location: { lat, lng },
        arDirections,
        arIcon,
        arColor,
        arImageUrl
      });
      toast.success('Ramani na AR vimehifadhiwa kikamilifu!');
    } catch (err: any) {
      console.error('Error updating AR/Map setting:', err);
      toast.error('Imeshindwa kuhifadhi taarifa: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Download QR
  const downloadQRCode = () => {
    if (!qrCodeInstance) return;
    qrCodeInstance.download({ name: `${vendorProfile?.businessName || 'store'}_AR_QR`, extension: 'png' });
    toast.success('QR Code imepakuliwa kikamilifu!');
  };

  // Handle Print Stand
  const printQRStand = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>AR Navigation QR Stand - ${vendorProfile?.businessName}</title>
          <style>
            @page {
              size: auto;
              margin: 10mm;
            }
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              text-align: center;
              padding: 10px;
              margin: 0;
              color: #0f172a;
              background-color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container {
              max-width: 440px;
              width: 100%;
              margin: auto;
              background: white;
              padding: 35px 25px;
              border-radius: 30px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.03);
              border: 4px solid ${arColor};
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .header-badge {
              display: inline-block;
              background-color: ${arColor}15;
              color: ${arColor};
              padding: 8px 18px;
              border-radius: 30px;
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 20px;
            }
            h1 {
              font-size: 28px;
              font-weight: 900;
              margin: 0 0 8px 0;
              text-transform: uppercase;
              letter-spacing: -1px;
              word-wrap: break-word;
            }
            p.sub {
              font-size: 13px;
              color: #64748b;
              margin: 0 0 30px 0;
              font-weight: 500;
              line-height: 1.5;
            }
            .qr-holder {
              display: inline-block;
              background: white;
              padding: 15px;
              border-radius: 24px;
              border: 2px solid #f1f5f9;
              box-shadow: 0 10px 20px rgba(0,0,0,0.01);
              margin-bottom: 30px;
            }
            .qr-holder svg {
              display: block;
              max-width: 100%;
              height: auto;
            }
            .footer-banner {
              background-color: #0f172a;
              color: white;
              padding: 15px;
              border-radius: 16px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            @media print {
              html, body {
                height: 99%;
              }
              body {
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                border-radius: 24px;
                box-shadow: none !important;
                border: 4px solid ${arColor} !important;
                margin: auto !important;
                max-height: 98vh;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-badge">Augmented Reality (AR) Maps</div>
            <h1>${vendorProfile?.businessName}</h1>
            <p class="sub">Scan QR Code hii kwa kutumia kamera ya simu kufika hapa kirahisi kwa kutumia AR!</p>
            <div class="qr-holder" id="print-qr"></div>
            <div class="footer-banner">PAPO HAPO SUPER APP NAVIGATION</div>
          </div>
          <script>
            // Clone the SVG from the parent window
            const parentSvg = window.opener.document.querySelector("#qr-canvas-holder svg").cloneNode(true);
            parentSvg.setAttribute("width", "260");
            parentSvg.setAttribute("height", "260");
            document.getElementById("print-qr").appendChild(parentSvg);
            
            // Auto-trigger print
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <Store className="w-6 h-6 text-orange-500 animate-pulse" />
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-neutral-900 dark:text-white leading-none">Ramani & AR Setup ya Duka</h2>
          <p className="text-xs text-neutral-500 mt-1">Sanidi eneo lako halisi na maelekezo ya kamera ya AR kwa wateja wanaokuja dukani kwako</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 text-left font-sans">
          
          {/* LEFT COLUMN: Map & Fields */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Step 1: Map Location Picker */}
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                      Step 1
                    </span>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2 uppercase tracking-tight">Kuweka Eneo kwenye Ramani</h3>
                    <p className="text-xs text-neutral-500 mt-1">Chagua eneo duka lako lilipo kwa kubonyeza kwenye ramani au kuburuta kigingi chekundu.</p>
                  </div>
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl shrink-0">
                    <MapPin className="w-6 h-6 text-orange-600" />
                  </div>
                </div>

                {/* Geographic coordinates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Latitude</label>
                    <Input 
                      type="number" 
                      value={lat} 
                      onChange={(e) => setLat(Number(e.target.value))}
                      className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Longitude</label>
                    <Input 
                      type="number" 
                      value={lng} 
                      onChange={(e) => setLng(Number(e.target.value))}
                      className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-xl font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Map Canvas */}
                <div className="h-80 w-full rounded-[2rem] overflow-hidden border border-neutral-200 dark:border-neutral-800 relative z-10">
                  {/* Floating Map Style Selector */}
                  <div className="absolute top-4 left-4 z-[1000] bg-white/90 dark:bg-neutral-900/95 backdrop-blur-md px-1.5 py-1.5 rounded-xl flex items-center gap-1 shadow-lg border border-neutral-200/50 dark:border-neutral-800/50">
                    <button 
                      type="button"
                      onClick={() => setMapType('standard')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mapType === 'standard' ? 'bg-orange-600 text-white shadow-md' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                    >
                      Kawaida (Map)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setMapType('satellite')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mapType === 'satellite' ? 'bg-orange-600 text-white shadow-md' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                    >
                      Satelaiti (Satellite)
                    </button>
                  </div>

                  <MapContainer 
                    center={[lat, lng]} 
                    zoom={16} 
                    className="w-full h-full"
                  >
                    <TileLayer
                      url={mapType === 'satellite' 
                        ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                      }
                      subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                      maxZoom={22}
                      maxNativeZoom={19}
                      attribution="&copy; Google Maps"
                    />
                    <DraggableMarker />
                    <MapEvents />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: AR Directions Setup */}
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                      Step 2
                    </span>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2 uppercase tracking-tight">AR Navigation Parameters</h3>
                    <p className="text-xs text-neutral-500 mt-1">Sanidi maelezo ya kina ya Augmented Reality yatakayoonekana kwenye kamera ya mteja wakati akija kwako.</p>
                  </div>
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl shrink-0">
                    <Compass className="w-6 h-6 text-orange-600" />
                  </div>
                </div>

                {/* Text directions */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Maelezo ya Kufika (Text Directions)</label>
                  <textarea
                    value={arDirections}
                    onChange={(e) => setArDirections(e.target.value)}
                    placeholder="Mfano: Panda ghorofa ya kwanza, duka letu lipo mlango wa tatu mkono wa kulia karibu na ngazi ya dharura."
                    className="w-full h-24 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white resize-none"
                  />
                </div>

                {/* Photo Image Url */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Picha ya Duka/Mlangoni (Storefront Image URL)</label>
                  <Input 
                    type="text" 
                    value={arImageUrl}
                    onChange={(e) => setArImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-... (Picha ya duka lako ili mteja alitambue mlangoni)"
                    className="bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 rounded-2xl h-12"
                  />
                </div>

                {/* Icon selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Chagua Alama ya AR (Floating 3D Icon)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {AR_ICONS_LIST.map((item) => {
                      const Icon = item.icon;
                      const isSelected = arIcon === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setArIcon(item.id)}
                          className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${isSelected ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500 text-orange-600 font-extrabold' : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Chagua Rangi ya Alama ya AR (Neon Glowing Color)</label>
                  <div className="flex flex-wrap gap-2.5">
                    {COLORS_LIST.map((col) => {
                      const isSelected = arColor === col.value;
                      return (
                        <button
                          key={col.id}
                          onClick={() => setArColor(col.value)}
                          style={{ backgroundColor: col.value }}
                          className={`w-10 h-10 rounded-full transition-all relative ${isSelected ? 'ring-4 ring-offset-2 ring-orange-500 dark:ring-offset-neutral-950 scale-110 shadow-lg' : 'hover:scale-105'}`}
                          title={col.label}
                        >
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-white absolute inset-0 m-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit changes button */}
                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-orange-950/20 gap-2 mt-4"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Hifadhi Maelezo & Ramani ya AR
                </Button>
              </CardContent>
            </Card>

          </div>

          {/* RIGHT COLUMN: Printable QR Code Stand & Preview */}
          <div className="lg:col-span-4 space-y-6">
            
            <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all sticky top-6">
              <CardContent className="p-8 space-y-6 flex flex-col items-center text-center">
                <div>
                  <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-full text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                    Step 3
                  </span>
                  <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-2 uppercase tracking-tight">AR Navigation QR Stand</h3>
                  <p className="text-xs text-neutral-500 mt-1">Chapa au pakua QR Code hii. Wateja wakiskani watafungua duka lako mlangoni katika hali ya AR Camera!</p>
                </div>

                {/* QR Styling Container */}
                <div 
                  id="qr-canvas-holder" 
                  className="p-5 bg-white border-2 border-neutral-100 dark:border-neutral-800 rounded-[2.5rem] shadow-inner flex items-center justify-center [&>svg]:rounded-2xl [&>canvas]:rounded-2xl shrink-0"
                >
                  <div ref={qrRef} className="shrink-0" />
                </div>

                {/* Meta label */}
                <div className="w-full p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 block mb-1">Target link</span>
                  <span className="text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-400 break-all">{qrLinkData}</span>
                </div>

                {/* Action Buttons */}
                <div className="w-full space-y-3">
                  <Button
                    onClick={downloadQRCode}
                    variant="outline"
                    className="w-full h-12 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-950 rounded-xl text-xs font-bold uppercase tracking-wider gap-2 shadow-xs text-neutral-800 dark:text-neutral-200"
                  >
                    <Download className="w-4 h-4" /> Download PNG
                  </Button>
                  <Button
                    onClick={printQRStand}
                    className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-widest gap-2 shadow-lg"
                  >
                    <Printer className="w-4 h-4" /> Chapa QR Table Stand
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
    </div>
  );
}
