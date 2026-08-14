import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Printer, Share2, X, Download, ShieldCheck, MapPin, Calendar, Clock, CreditCard } from 'lucide-react';
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
  if (!isOpen || !ride) return null;

  const fare = Number(ride.fare) || 0;
  const originalFare = Number((ride as any).originalFare) || fare;
  const discountAmount = Number((ride as any).discountAmount) || 0;
  const distanceKm = Number(ride.distance) || 3.5;
  const durationMins = Number(ride.duration) || 12;
  
  // Calculate breakdown
  const baseFare = Math.min(1500, Math.round(fare * 0.3));
  const distanceCost = Math.round(fare - baseFare - (fare * 0.18));
  const vatAmount = Math.round(fare * 0.18);

  const receiptNo = `PH-${(ride.id || 'TRIP').slice(0, 6).toUpperCase()}-${new Date().getFullYear()}`;
  const formattedDate = new Date().toLocaleDateString('sw-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString('sw-TZ', {
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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const text = `Risiti ya Safari Papo Hapo TZ:\nNamba: ${receiptNo}\nKutoka: ${ride.pickup.address}\nKwenda: ${ride.destination.address}\nJumla: TZS ${fare.toLocaleString()}\nMalipo: ${paymentMethodLabel}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Risiti ya Safari - Papo Hapo TZ',
          text,
        });
      } catch {
        // User dismissed
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Maelezo ya risiti yamenakiliwa!');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          className="w-full max-w-md bg-white text-neutral-900 rounded-[32px] shadow-2xl overflow-hidden my-auto border border-neutral-200 print:m-0 print:border-none print:shadow-none"
        >
          {/* Top Decorative Receipt Header */}
          <div className="bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 text-white p-6 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xs">
                  PH
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">PAPO HAPO TANZANIA</h3>
                  <p className="text-[9px] text-neutral-400">Risiti Rasmi ya Safari ya Kidijitali</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors print:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Number Badge */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-neutral-400 text-[9px] block">NAMBA YA RISITI</span>
                <span className="font-mono font-bold text-indigo-300">{receiptNo}</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400 text-[9px] block">TAREHE NA MUDA</span>
                <span className="font-bold">{formattedDate} • {formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Receipt Body */}
          <div className="p-6 space-y-5 bg-neutral-50/50">
            {/* Status & Total Amount Header */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Jumla Iliyolipwa</span>
                <h2 className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                  TZS {fare.toLocaleString()}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>IMELIPWA</span>
              </div>
            </div>

            {/* Journey Route */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block">Njia ya Safari</span>
              
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-bold">KUTOKA (PICKUP):</p>
                  <p className="text-xs font-bold text-neutral-800 truncate">{ride.pickup.address}</p>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-neutral-200 ml-2 h-3" />

              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-bold">KWENDA (DESTINATION):</p>
                  <p className="text-xs font-bold text-neutral-800 truncate">{ride.destination.address}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-bold">
                <span>Umbali: {distanceKm.toFixed(1)} km</span>
                <span>Muda: ~{durationMins} dakika</span>
              </div>
            </div>

            {/* Driver & Vehicle Info */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xl">
                  {ride.vehicleType === 'bike' ? '🏍️' : ride.vehicleType === 'bajaj' ? '🛺' : '🚗'}
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-neutral-900">
                    {ride.driverInfo?.name || 'Dereva Swahili'}
                  </h4>
                  <p className="text-[10px] text-neutral-500 font-semibold">
                    {ride.driverInfo?.vehicle?.model || 'Toyota IST'} • {ride.driverInfo?.vehicle?.color || 'Nyeupe'}
                  </p>
                </div>
              </div>
              <div className="bg-amber-400 text-neutral-950 px-2 py-0.5 rounded font-mono font-black text-[10px] border border-amber-500 shadow-xs">
                TZ {ride.driverInfo?.vehicle?.plate || 'T 842 DKP'}
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block">Mchanganuo wa Bei (Breakdown)</span>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Nauli ya Msingi (Base Fare)</span>
                <span>TZS {baseFare.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Gharama ya Umbali na Muda ({distanceKm.toFixed(1)} km)</span>
                <span>TZS {distanceCost.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-neutral-600 font-semibold">
                <span>Kodi ya Ongezeko la Thamani (VAT 18%)</span>
                <span>TZS {vatAmount.toLocaleString()}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-bold">
                  <span>Punguzo la Pointi (Loyalty Discount)</span>
                  <span>- TZS {discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-neutral-900">Jumla Kuu (Total)</span>
                <span className="text-sm font-black font-mono text-indigo-600">TZS {fare.toLocaleString()}</span>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500">
                <span>Njia ya Malipo:</span>
                <span className="font-bold text-neutral-800">{paymentMethodLabel}</span>
              </div>
            </div>

            {/* Footer Trust & Actions */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Risiti hii imethibitishwa kielektroniki na Papo Hapo Tanzania</span>
            </div>

            {/* Action Buttons (Print & Share) */}
            <div className="grid grid-cols-2 gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="h-11 rounded-2xl border border-neutral-300 bg-white hover:bg-neutral-100 active:scale-95 transition-all text-xs font-black uppercase text-neutral-700 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Chapisha / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-xs font-black uppercase text-white flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Shiriki Risiti</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
