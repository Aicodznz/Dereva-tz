import React, { useState } from 'react';
import { 
  FleetVehicleRecord, 
  DaladalaPassengerRecord 
} from '../../types/daladala.types';
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  TrendingUp, 
  Banknote, 
  Fuel, 
  Building2, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Printer,
  Sparkles,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaDailyOwnerReportModalProps {
  vehicle?: FleetVehicleRecord | null;
  fleetRecords?: FleetVehicleRecord[];
  passengers?: DaladalaPassengerRecord[];
  ownerPhone?: string;
  ownerName?: string;
  onClose: () => void;
}

export default function DaladalaDailyOwnerReportModal({
  vehicle,
  fleetRecords = [],
  passengers = [],
  ownerPhone = '+255754123456',
  ownerName = 'Mzee Juma Rashidi Mwinyi',
  onClose,
}: DaladalaDailyOwnerReportModalProps) {
  const [selectedPlate, setSelectedPlate] = useState<string>(
    vehicle ? vehicle.plateNumber : (fleetRecords[0]?.plateNumber || '')
  );
  const [targetPhone, setTargetPhone] = useState<string>(ownerPhone);
  const [customAllowance, setCustomAllowance] = useState<number>(20000); // Posho ya Dereva & Konda
  const [copied, setCopied] = useState(false);

  // Find active record
  const currentRecord = fleetRecords.find(f => f.plateNumber === selectedPlate) || vehicle || fleetRecords[0];

  // Derived financial metrics
  const cashAmount = currentRecord?.cashCollectedTzs ?? 85000;
  const digitalAmount = currentRecord?.digitalCollectedTzs ?? 65000;
  const totalGrossRevenue = currentRecord?.todayRevenueTzs || (cashAmount + digitalAmount);
  const fuelExpense = currentRecord?.fuelExpenseTzs ?? 45000;
  const terminalFee = currentRecord?.terminalFeeTzs ?? 10000;
  const crewAllowance = customAllowance;
  const totalExpenses = fuelExpense + terminalFee + crewAllowance;
  const netProfit = totalGrossRevenue - totalExpenses;
  const dailyTarget = currentRecord?.dailyTargetTzs ?? 120000;
  const targetAchieved = totalGrossRevenue >= dailyTarget;
  const targetPercent = Math.min(100, Math.round((totalGrossRevenue / Math.max(1, dailyTarget)) * 100));

  // Passengers for this vehicle
  const vehiclePassengers = passengers.filter(
    p => p.plateNumber.toLowerCase().replace(/\s+/g, '') === (currentRecord?.plateNumber || '').toLowerCase().replace(/\s+/g, '')
  );
  const passengerCount = vehiclePassengers.length > 0 ? vehiclePassengers.length : (currentRecord?.tripsCount ? currentRecord.tripsCount * 28 : 194);

  // Current date & time formatting
  const todayDateStr = new Date().toLocaleDateString('sw-TZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const todayTimeStr = new Date().toLocaleTimeString('sw-TZ', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Generate WhatsApp message string
  const generateWhatsAppMessage = () => {
    return `🚌 *RIPOTI YA HESABU YA LEO - PAPODALADALA*
📅 *Tarehe:* ${todayDateStr} | ${todayTimeStr}
👑 *Tajiri:* ${ownerName}
🚘 *Chombo:* ${currentRecord?.plateNumber} (${currentRecord?.nickname || 'Daladala'})
🛣️ *Ruti:* ${currentRecord?.routeCode || 'Mwenge - Posta'}
👤 *Dereva:* ${currentRecord?.driverName || 'Athumani Juma'}
🎫 *Kondakta:* ${currentRecord?.conductorName || 'Kassim Salum'}
🔄 *Safari Zilizopigwa:* ${currentRecord?.tripsCount || 8} Trips
👥 *Jumla ya Abiria:* ${passengerCount}

━━━━━━━━━━━━━━━━━━━
💰 *MAKUSANYO YA NAULI:*
• Taslimu (Cash): TSh ${cashAmount.toLocaleString()}
• Simu (M-Pesa / Tigo): TSh ${digitalAmount.toLocaleString()}
👉 *Jumla Kuu ya Mapato:* *TSh ${totalGrossRevenue.toLocaleString()}*

━━━━━━━━━━━━━━━━━━━
⛽ *MATUMIZI YA UENDESHAJI:*
• Mafuta (Dizeli): -TSh ${fuelExpense.toLocaleString()}
• Ushuru wa Stendi: -TSh ${terminalFee.toLocaleString()}
• Posho ya Dereva & Konda: -TSh ${crewAllowance.toLocaleString()}
👉 *Jumla ya Matumizi:* -TSh ${totalExpenses.toLocaleString()}

━━━━━━━━━━━━━━━━━━━
🏆 *FAIDA HALISI YA TAJIRI (NET PROFIT):*
*TSh ${netProfit.toLocaleString()}*
🎯 *Lengo la Siku:* TSh ${dailyTarget.toLocaleString()} (${targetPercent}% - ${targetAchieved ? '✅ Limefikiwa' : '⚠️ Bado'})

━━━━━━━━━━━━━━━━━━━
_Imetolewa kiotomatiki na Mfumo wa PapoDaladala Dar es Salaam._`;
  };

  // Action: Open WhatsApp
  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, '_blank');
    toast.success('Ripoti inatumwa kwenye WhatsApp ya Tajiri!');
  };

  // Action: Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopied(true);
    toast.success('Ripoti ya hesabu imenakiliwa!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Action: Print report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Ripoti ya Hesabu ya Tajiri
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 text-[10px] font-black uppercase">
                  Leo Usiku
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium">
                Muhtasari wa Makusanyo, Mafuta, na Faida Halisi (Net Profit)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Vehicle Switcher Bar (if fleet has multiple buses) */}
          {fleetRecords.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                Chagua Chombo Kinachotolewa Hesabu:
              </label>
              <div className="flex flex-wrap gap-2">
                {fleetRecords.map((f) => (
                  <button
                    key={f.plateNumber}
                    onClick={() => setSelectedPlate(f.plateNumber)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedPlate === f.plateNumber
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    <span>{f.plateNumber}</span>
                    <span className="opacity-75 text-[10px]">({f.nickname})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vehicle & Shift Snapshot Card */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 font-black text-xs">
                  {currentRecord?.plateNumber || 'T 392 DKR'}
                </span>
                <span className="font-bold text-neutral-700 dark:text-neutral-300">
                  {currentRecord?.nickname || 'Mnyama'} • Ruti {currentRecord?.routeCode || '102'}
                </span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400">
                Dereva: <strong className="text-neutral-800 dark:text-neutral-200">{currentRecord?.driverName || 'Athumani Juma'}</strong> • Konda: <strong className="text-neutral-800 dark:text-neutral-200">{currentRecord?.conductorName || 'Kassim Salum'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-neutral-600 dark:text-neutral-300 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200 dark:border-neutral-700">
              <div>
                <span className="block text-[10px] text-neutral-400 uppercase font-bold">Safari (Trips)</span>
                <span className="text-sm font-black">{currentRecord?.tripsCount || 8} Ruti</span>
              </div>
              <div>
                <span className="block text-[10px] text-neutral-400 uppercase font-bold">Abiria Waliobebwa</span>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400">{passengerCount}</span>
              </div>
            </div>
          </div>

          {/* Big Net Profit Showcase */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-2 border-emerald-500/40 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Faida Halisi ya Tajiri Leo (Net Profit)
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight mt-1">
                  TSh {netProfit.toLocaleString()}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Baada ya kutoa mafuta yote, ushuru wa stendi na posho za wafanyakazi.
                </p>
              </div>

              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-flex items-center gap-1 ${
                  targetAchieved
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  {targetAchieved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {targetPercent}% ya Lengo
                </span>
                <span className="block text-[10px] text-neutral-400 font-bold mt-1">
                  Lengo: TSh {dailyTarget.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Target progress bar */}
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden mt-4">
              <div
                className={`h-full transition-all duration-500 ${
                  targetAchieved ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${targetPercent}%` }}
              />
            </div>
          </div>

          {/* Detailed Financial Breakdown Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Column 1: Gross Collections */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Banknote className="w-4 h-4" />
                <span>1. Makusanyo ya Nauli (Gross)</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-500">Taslimu (Cash Mkononi):</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    TSh {cashAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-500">Simu (M-Pesa / Tigo Pesa):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    TSh {digitalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 font-black text-sm">
                  <span>Jumla ya Mapato:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    TSh {totalGrossRevenue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Operational Expenses */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                <Fuel className="w-4 h-4" />
                <span>2. Matumizi ya Barabarani</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-500">Mafuta ya Dizeli:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -TSh {fuelExpense.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-500">Ushuru wa Stendi:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -TSh {terminalFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500">Posho ya Dereva/Konda:</span>
                  </div>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -TSh {crewAllowance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 font-black text-sm">
                  <span>Jumla ya Matumizi:</span>
                  <span className="text-rose-600 dark:text-rose-400">
                    -TSh {totalExpenses.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recipient Phone input for WhatsApp */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
            <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Namba ya WhatsApp ya Tajiri:
              </span>
              <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                (Imejazwa kiotomatiki)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="+255 754 123 456"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-neutral-500 hidden sm:inline">
                {ownerName}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Imenakiliwa!' : 'Nakili Ripoti'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              title="Chapisha Ripoti"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Chapisha</span>
            </button>
          </div>

          <button
            onClick={handleSendWhatsApp}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Tuma Ripoti WhatsApp ya Tajiri</span>
          </button>
        </div>

      </div>
    </div>
  );
}
