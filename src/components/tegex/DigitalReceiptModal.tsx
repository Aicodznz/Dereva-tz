import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, Printer, Share2, X, Download, ShieldCheck, 
  MapPin, Calendar, Clock, CreditCard, MessageCircle, 
  Check, Copy, Sparkles, QrCode as QrIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Ride } from '../../types/trip.types';

interface DigitalReceiptModalProps {
  isOpen: boolean;
  ride: Ride;
  onClose: () => void;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({
  isOpen,
  ride,
  onClose,
}) => {
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen || !ride) return null;

  const fare = Number(ride.fare) || 0;
  const originalFare = Number((ride as any).originalFare) || fare;
  const discountAmount = Number((ride as any).discountAmount) || 0;
  const distanceKm = Number(ride.distance) || 3.5;
  const durationMins = Number(ride.duration) || 12;
  
  // Calculate breakdown
  const baseFare = Math.min(1500, Math.round(fare * 0.3));
  const distanceCost = Math.max(0, Math.round(fare - baseFare - (fare * 0.18)));
  const vatAmount = Math.round(fare * 0.18);

  const receiptNo = `PH-${(ride.id || 'TRIP').slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
  
  // Safe date parsing
  const rideDate = (() => {
    try {
      if ((ride as any).createdAt?.toDate) return (ride as any).createdAt.toDate();
      if ((ride as any).createdAt?.seconds) return new Date((ride as any).createdAt.seconds * 1000);
      if (ride.createdAt) return new Date(ride.createdAt);
    } catch (e) {}
    return new Date();
  })();

  const formattedDate = rideDate.toLocaleDateString('sw-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = rideDate.toLocaleTimeString('sw-TZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const paymentMethodLabel = (() => {
    const method = ride.paymentMethod || 'cash';
    if (method === 'cash') return '💵 Pesa Taslimu (Cash)';
    if (method === 'mobile_money' || method === 'mpesa') {
      const op = (ride.paymentDetails?.operator || 'mpesa').toLowerCase();
      if (op.includes('tigo')) return '📱 Tigo Pesa';
      if (op.includes('airtel')) return '📱 Airtel Money';
      if (op.includes('halo')) return '📱 HaloPesa';
      return '📱 Vodacom M-Pesa';
    }
    if (method === 'wallet') return '👛 Papo Mkoba (Wallet)';
    if (method === 'card') return '💳 Kadi ya Benki (Card)';
    return '📱 Malipo ya Kidijitali';
  })();

  const driverName = ride.driverInfo?.name || 'Dereva wa Papo Hapo';
  const vehiclePlate = ride.driverInfo?.vehicle?.plate || (ride as any).driverVehiclePlate || 'T 842 DKP';
  const vehicleModel = ride.driverInfo?.vehicle?.model || (ride as any).driverVehicleModel || (
    ride.vehicleType === 'bike' ? 'Boda Boda (Boxer 150)' : ride.vehicleType === 'bajaj' ? 'Bajaji (TVS King)' : 'Taxi (Toyota IST)'
  );

  const verificationUrl = `${window.location.origin}/verify-receipt?id=${ride.id}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!receiptCardRef.current || isDownloading) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(receiptCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Risiti-PapoHapo-${receiptNo}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Risiti imepakuliwa kwenye simu yako!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Imeshindikana kupakua risiti, tafadhali tumia kitufe cha Chapisha.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const msg = `*🧾 RISITI YA SAFARI - PAPO HAPO TANZANIA*\n` +
      `---------------------------------\n` +
      `*Namba ya Risiti:* ${receiptNo}\n` +
      `*Tarehe & Muda:* ${formattedDate}, ${formattedTime}\n` +
      `*Kutoka:* ${ride.pickup?.address || 'Eneo la Kuchukuliwa'}\n` +
      `*Kwenda:* ${ride.destination?.address || 'Eneo la Kushukia'}\n` +
      `*Umbali:* ${distanceKm.toFixed(1)} km\n` +
      `*Muda:* ~${durationMins} dakika\n` +
      `*Dereva:* ${driverName} (${vehiclePlate})\n` +
      `*Chombo:* ${vehicleModel}\n` +
      `*Njia ya Malipo:* ${paymentMethodLabel}\n` +
      `---------------------------------\n` +
      `*JUMLA ILIYOLIPWA:* TZS ${fare.toLocaleString()}\n` +
      `---------------------------------\n` +
      `_Thibitisha uhalali wa risiti hii: ${verificationUrl}_`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleShareOrCopy = async () => {
    const text = `Risiti ya Safari Papo Hapo TZ:\nNamba: ${receiptNo}\nKutoka: ${ride.pickup?.address}\nKwenda: ${ride.destination?.address}\nJumla: TZS ${fare.toLocaleString()}\nMalipo: ${paymentMethodLabel}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Risiti ya Safari - Papo Hapo TZ',
          text,
          url: verificationUrl
        });
      } catch {
        // Dismissed
      }
    } else {
      navigator.clipboard.writeText(text);
      setHasCopied(true);
      toast.success('Maelezo ya risiti yamenakiliwa!');
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          className="w-full max-w-md bg-white text-neutral-900 rounded-[32px] shadow-2xl overflow-hidden my-auto border border-neutral-200 print:m-0 print:border-none print:shadow-none flex flex-col max-h-[92vh]"
        >
          {/* Top Decorative Receipt Bar */}
          <div className="bg-gradient-to-r from-neutral-950 via-indigo-950 to-neutral-950 text-white p-5 sm:p-6 shrink-0 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-indigo-500/30">
                  PH
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">PAPO HAPO TANZANIA</h3>
                  <p className="text-[10px] text-indigo-300 font-semibold">Stakabadhi Rasmi ya Kielektroniki (E-Receipt)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors print:hidden cursor-pointer"
                title="Funga"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Number Badge */}
            <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-neutral-400 text-[9px] uppercase font-black block">NAMBA YA RISITI</span>
                <span className="font-mono font-black text-amber-300">{receiptNo}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400 text-[9px] uppercase font-black block">TAREHE NA MUDA</span>
                <span className="font-bold text-neutral-200">{formattedDate} • {formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Printable / Downloadable Receipt Body */}
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto bg-neutral-50/70" ref={receiptCardRef}>
            {/* Status & Total Amount Header */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Jumla Iliyolipwa</span>
                <h2 className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                  TZS {fare.toLocaleString()}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 font-black text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>IMELIPWA</span>
              </div>
            </div>

            {/* Journey Route & Distance */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-xs space-y-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block">Njia ya Safari</span>
              
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">KUTOKA (PICKUP):</p>
                  <p className="text-xs font-bold text-neutral-800 leading-snug">{ride.pickup?.address || 'Eneo lililorekodiwa'}</p>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-neutral-200 ml-2 h-3" />

              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">KWENDA (DESTINATION):</p>
                  <p className="text-xs font-bold text-neutral-800 leading-snug">{ride.destination?.address || 'Eneo lililofikiwa'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-600 font-bold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  Muda: ~{durationMins} dakika
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  Umbali: {distanceKm.toFixed(1)} km
                </span>
              </div>
            </div>

            {/* Driver & Vehicle Details */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xl shrink-0">
                  {ride.vehicleType === 'bike' ? '🏍️' : ride.vehicleType === 'bajaj' ? '🛺' : '🚗'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black uppercase text-neutral-900 truncate">
                    {driverName}
                  </h4>
                  <p className="text-[10.5px] text-neutral-500 font-medium truncate">
                    {vehicleModel}
                  </p>
                </div>
              </div>
              <div className="bg-amber-400 text-neutral-950 px-2 py-1 rounded-md font-mono font-black text-[10.5px] border border-amber-500 shadow-2xs shrink-0">
                {vehiclePlate}
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-xs space-y-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block">Mchanganuo wa Bei (Fare Breakdown)</span>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Nauli ya Kuanzia (Base Fare)</span>
                <span>TZS {baseFare.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Umbali na Muda ({distanceKm.toFixed(1)} km)</span>
                <span>TZS {distanceCost.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Kodi ya Ongezeko la Thamani (VAT 18%)</span>
                <span>TZS {vatAmount.toLocaleString()}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-bold">
                  <span>Punguzo la Promo / Points</span>
                  <span>- TZS {discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-neutral-900">Jumla Kuu (Total Paid)</span>
                <span className="text-base font-black font-mono text-indigo-600">TZS {fare.toLocaleString()}</span>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-600">
                <span>Njia ya Malipo:</span>
                <span className="font-bold text-neutral-900">{paymentMethodLabel}</span>
              </div>
            </div>

            {/* Verification QR Code and Legal Trust Footer */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-xs flex items-center gap-4">
              <div className="p-1.5 rounded-xl bg-neutral-50 border border-neutral-200 shrink-0">
                <QRCodeSVG
                  value={verificationUrl}
                  size={64}
                  level="M"
                />
              </div>
              <div className="text-left space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-black text-neutral-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Stakabadhi Iliyoidhinishwa</span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  Kagua au hakiki uhalali wa risiti hii kwa kamera au msomaji wa QR.
                </p>
                <span className="text-[9px] font-mono text-neutral-400 block truncate">
                  {receiptNo}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons (Download, Print, WhatsApp, Share) */}
          <div className="p-4 sm:p-5 bg-white border-t border-neutral-200/80 shrink-0 print:hidden space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloading}
                className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-xs font-black uppercase text-white flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Inapakua...' : 'Pakua Picha'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="h-11 rounded-2xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 active:scale-95 transition-all text-xs font-black uppercase text-neutral-700 flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Chapisha / PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-xs font-black uppercase text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Risiti</span>
              </button>

              <button
                type="button"
                onClick={handleShareOrCopy}
                className="h-11 rounded-2xl border border-neutral-300 bg-white hover:bg-neutral-50 active:scale-95 transition-all text-xs font-black uppercase text-neutral-700 flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span>{hasCopied ? 'Imenakiliwa!' : 'Shiriki / Nakili'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

