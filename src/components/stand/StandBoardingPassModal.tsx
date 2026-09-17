import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, QrCode, Download, Share2, CheckCircle2, 
  MapPin, ArrowRight, ShieldCheck, Car, Phone, 
  Copy, Check, AlertCircle, Sparkles, Clock, Compass
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { StandPoolingRoute, StandPassenger } from '../../services/standPoolingService';

interface StandBoardingPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: StandPoolingRoute;
  passenger: StandPassenger;
  onCancelSeat?: () => void;
}

export const StandBoardingPassModal: React.FC<StandBoardingPassModalProps> = ({
  isOpen,
  onClose,
  route,
  passenger,
  onCancelSeat
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  if (!isOpen) return null;

  const ticketCode = passenger.ticketCode || `STND-${(passenger.passengerId || '12345').slice(-5).toUpperCase()}`;
  const isBoarded = passenger.status === 'boarded';
  const seatLabel = passenger.seatNumbers || `Siti #${passenger.seats > 1 ? '1 & 2' : '1'}`;

  // QR Code Payload (compact JSON for scanner)
  const qrPayload = JSON.stringify({
    type: 'papo_stendi_ticket',
    ticketCode,
    routeId: route.id,
    passengerId: passenger.passengerId,
    passengerName: passenger.passengerName,
    seats: passenger.seats || 1,
    fare: passenger.fare,
    vehiclePlate: route.vehiclePlate || '',
    driverName: route.driverName
  });

  const handleCopyTicketCode = () => {
    navigator.clipboard.writeText(ticketCode);
    setHasCopiedCode(true);
    toast.success("Namba ya tiketi imenakiliwa!");
    setTimeout(() => setHasCopiedCode(false), 2000);
  };

  const handleDownloadTicket = async () => {
    if (!ticketRef.current) return;
    try {
      setIsDownloading(true);
      const loadingToast = toast.loading("Inatengeneza tiketi ya kidijitali...");
      await new Promise(r => setTimeout(r, 600));

      const dataUrl = await toPng(ticketRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      link.download = `PapoShare-Tiketi-${ticketCode}.png`;
      link.href = dataUrl;
      link.click();

      toast.dismiss(loadingToast);
      toast.success("Tiketi imepakuliwa kwenye simu yako!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Imeshindikana kupakua tiketi.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🎫 *TIKETI YA PAPOSHARE STENDI*\n` +
      `*Namba ya Tiketi:* ${ticketCode}\n` +
      `*Siti:* ${seatLabel}\n` +
      `*Abiria:* ${passenger.passengerName}\n` +
      `*Kutokea:* ${route.standLocation?.name}\n` +
      `*Kushukia:* ${passenger.dropoffName}\n` +
      `*Dereva:* ${route.driverName} (${route.vehiclePlate || 'Bila Namba'})\n` +
      `*Nauli:* TZS ${passenger.fare?.toLocaleString()}\n` +
      `*Hali:* ${isBoarded ? 'Amepanda Garini ✓' : 'Inasubiri Kupanda'}\n\n` +
      `_Tegex PapoShare - Safari ya Uhakika na Salama!_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[120000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-md bg-white dark:bg-[#111119] rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-neutral-950 flex items-center justify-center font-black text-xs">
              🎫
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider">Tiketi ya Kidijitali ya Stendi</h3>
              <p className="text-[9.5px] text-neutral-400">Boarding Pass • Onyesha kabla ya kupanda</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Container with Printable Ticket */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Printable Ticket Card */}
          <div
            ref={ticketRef}
            className="bg-white text-neutral-900 rounded-3xl border-2 border-neutral-200 shadow-lg overflow-hidden relative font-sans"
          >
            {/* Ticket Header Banner */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black tracking-widest uppercase">PAPOSHARE STENDI</span>
                    <span className="bg-amber-400 text-neutral-950 text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase">
                      OFFICIAL
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mt-0.5">
                    DIGITAL BOARDING PASS
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-emerald-200 uppercase font-black block">NAMBA YA TIKETI</span>
                  <span className="font-mono font-black text-xs tracking-wider bg-black/20 px-2 py-0.5 rounded text-amber-300">
                    {ticketCode}
                  </span>
                </div>
              </div>

              {/* Status Ribbon */}
              <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
                  HALI YA KUPANDA:
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  isBoarded
                    ? 'bg-emerald-400 text-neutral-950 shadow-xs'
                    : 'bg-amber-400 text-neutral-950 animate-pulse'
                }`}>
                  {isBoarded ? <CheckCircle2 className="w-3 h-3 text-neutral-950 stroke-[3]" /> : <Clock className="w-3 h-3 text-neutral-950" />}
                  <span>{isBoarded ? 'Amepanda Garini ✓' : 'Inasubiri Kupanda'}</span>
                </span>
              </div>
            </div>

            {/* Route Stations Card */}
            <div className="p-4 bg-neutral-50/90 border-b border-dashed border-neutral-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>KITUO CHA STENDI</span>
                  </p>
                  <p className="text-sm font-black text-neutral-900 mt-0.5 truncate">
                    {route.standLocation?.name || 'Stendi'}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block mt-1">
                    ⏱️ {route.departureTimeText || 'Mara tu ikijaa'}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center pt-2 shrink-0">
                  <ArrowRight className="w-5 h-5 text-neutral-400 stroke-[2.5]" />
                </div>

                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[9px] font-black text-neutral-400 uppercase tracking-wider flex items-center justify-end gap-1">
                    <span>KITUO CHA KUSHUKA</span>
                    <Compass className="w-3 h-3 text-indigo-600" />
                  </p>
                  <p className="text-sm font-black text-neutral-900 mt-0.5 truncate">
                    {passenger.dropoffName}
                  </p>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md inline-block mt-1">
                    Kushukia njiani
                  </span>
                </div>
              </div>
            </div>

            {/* Middle Section: Passenger & Seat Details */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-2xl bg-neutral-100 border border-neutral-200">
                  <span className="text-[8.5px] font-black text-neutral-500 uppercase block">SITI YAKO</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5 truncate">
                    {seatLabel}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-neutral-100 border border-neutral-200">
                  <span className="text-[8.5px] font-black text-neutral-500 uppercase block">IDADI YA VITI</span>
                  <span className="text-xs sm:text-sm font-black text-neutral-900 block mt-0.5">
                    {passenger.seats || 1} {passenger.seats > 1 ? 'Viti' : 'Kiti'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[8.5px] font-black text-emerald-700 uppercase block">NAULI</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-800 block mt-0.5">
                    TZS {passenger.fare?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Driver and Vehicle Info */}
              <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-black text-sm shrink-0">
                    {route.vehicleType === 'boda' ? '🏍️' : route.vehicleType === 'bajaj' ? '🛺' : '🚗'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-neutral-900 truncate">{route.driverName}</span>
                      {route.isVerifiedDriver && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="bg-amber-400 text-neutral-950 font-mono font-black text-[9.5px] px-1.5 py-0.2 rounded border border-amber-500">
                        {route.vehiclePlate || 'T 240 ABC'}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-bold truncate">
                        {route.vehicleModel || (route.vehicleType === 'bajaj' ? 'Bajaji' : 'Gari')}
                      </span>
                    </div>
                  </div>
                </div>

                {route.driverPhone && (
                  <a
                    href={`tel:${route.driverPhone}`}
                    className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 transition-colors"
                    title="Piga simu kwa dereva"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* QR Code Section */}
              <div className="py-2 text-center space-y-2">
                <div className="p-3 bg-white border-2 border-dashed border-neutral-300 rounded-2xl inline-block shadow-xs">
                  <QRCodeSVG
                    value={qrPayload}
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-neutral-800">
                    {isBoarded ? '✓ TIKETI IMETHIBITISHWA NA DEREVA' : 'ONYE SHA DEREVA ACHANGANUE HAPA'}
                  </p>
                  <p className="text-[9.5px] text-neutral-500 font-medium max-w-xs mx-auto">
                    {isBoarded
                      ? 'Umethibitishwa kupanda kwenye chombo hiki. Safari njema!'
                      : 'Dereva au kondakta atachanganua (scan) au kubofya tiki kabla ya wewe kuingia garini.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Ticket Tear Notch Styling */}
            <div className="bg-neutral-100 px-4 py-2 border-t border-neutral-200 text-center flex items-center justify-between text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
              <span>PapoShare Stendi • Tegex</span>
              <button
                type="button"
                onClick={handleCopyTicketCode}
                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                {hasCopiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{hasCopiedCode ? 'Imenakiliwa' : 'Nakili Namba'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleDownloadTicket}
                className="py-3 px-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pakua Tiketi</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Shiriki WhatsApp</span>
              </button>
            </div>

            {onCancelSeat && !isBoarded && (
              <button
                type="button"
                onClick={onCancelSeat}
                className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Ghairi Kiti Hiki
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StandBoardingPassModal;
