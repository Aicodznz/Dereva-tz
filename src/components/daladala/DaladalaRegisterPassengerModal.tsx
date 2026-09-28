import React, { useState } from 'react';
import { DaladalaVehicle, DaladalaRoute, DaladalaPassengerRecord } from '../../types/daladala.types';
import { 
  Users, 
  X, 
  CheckCircle2, 
  Bus, 
  MapPin, 
  Phone, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Printer, 
  Send, 
  UserPlus,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaRegisterPassengerModalProps {
  vehicles: DaladalaVehicle[];
  routes: DaladalaRoute[];
  selectedVehicleId?: string | null;
  onClose: () => void;
  onRegisterPassenger: (newPassenger: DaladalaPassengerRecord) => void;
}

export default function DaladalaRegisterPassengerModal({
  vehicles,
  routes,
  selectedVehicleId,
  onClose,
  onRegisterPassenger,
}: DaladalaRegisterPassengerModalProps) {
  const [vehicleId, setVehicleId] = useState<string>(
    selectedVehicleId || vehicles[0]?.id || ''
  );
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [seatType, setSeatType] = useState<'seat' | 'standing'>('seat');
  const [seatNumber, setSeatNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'tigopesa' | 'airtel' | 'papo_wallet'>('cash');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');

  // Currently chosen vehicle & route
  const currentVehicle = vehicles.find((v) => v.id === vehicleId) || vehicles[0];
  const currentRoute = routes.find((r) => r.id === currentVehicle?.routeId) || routes[0];

  const [boardingStop, setBoardingStop] = useState<string>(
    currentRoute?.stops[0]?.name || 'Stendi ya Mwanzo'
  );
  const [destinationStop, setDestinationStop] = useState<string>(
    currentRoute?.stops[currentRoute.stops.length - 1]?.name || 'Stendi ya Mwisho'
  );
  const [fareTzs, setFareTzs] = useState<number>(currentRoute?.baseFareTzs || 600);

  // Success ticket preview state
  const [completedRecord, setCompletedRecord] = useState<DaladalaPassengerRecord | null>(null);

  // When vehicle changes, update stops & fare
  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const veh = vehicles.find((v) => v.id === newVehId);
    const r = routes.find((rt) => rt.id === veh?.routeId);
    if (r) {
      if (r.stops.length > 0) {
        setBoardingStop(r.stops[0].name);
        setDestinationStop(r.stops[r.stops.length - 1]?.name || r.stops[0].name);
      }
      setFareTzs(r.baseFareTzs || 600);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!passengerName.trim()) {
      toast.error('Tafadhali jaza jina la abiria (au weka "Abiria wa Kawaida")');
      return;
    }

    const ticketCode = `DL-${currentVehicle?.routeCode || 'DAR'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowTime = new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

    const newRecord: DaladalaPassengerRecord = {
      id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      vehicleId: currentVehicle?.id || 'dala_01',
      plateNumber: currentVehicle?.plateNumber || 'T 000 AAA',
      routeCode: currentVehicle?.routeCode || 'DL-01',
      routeName: currentRoute?.name || currentVehicle?.routeName || 'Ruti ya Daladala',
      passengerName: passengerName.trim(),
      passengerPhone: passengerPhone.trim() || 'Hajatoa simu',
      boardingStop,
      destinationStop,
      fareTzs: Number(fareTzs) || 600,
      paymentMethod,
      paymentStatus,
      seatType,
      seatNumber: seatType === 'seat' ? (seatNumber.trim() || undefined) : undefined,
      boardedAt: nowTime,
      ticketCode,
    };

    onRegisterPassenger(newRecord);
    setCompletedRecord(newRecord);
    toast.success(`Abiria ${newRecord.passengerName} amesajiliwa kwenye ${newRecord.plateNumber}! Tiketi: ${ticketCode}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  Sajili Abiria Kwenye Chombo
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Manifest & Tiketi
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Orodhesha abiria aliyepanda, weka nauli na toa tiketi ya safari.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View 1: Success Digital Ticket Card */}
        {completedRecord ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-black text-base text-emerald-900 dark:text-emerald-200">
                Usajili wa Abiria Umekamilika!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Tiketi na nafasi vimehifadhiwa kwenye orodha ya abiria (manifest) ya chombo.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-dashed border-neutral-300 dark:border-neutral-700 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="font-sans font-bold text-neutral-500">Namba ya Tiketi</span>
                <span className="font-black text-sm text-blue-600 dark:text-blue-400">{completedRecord.ticketCode}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-neutral-700 dark:text-neutral-300">
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Gari / Daladala</span>
                  <strong>{completedRecord.plateNumber}</strong> ({completedRecord.routeCode})
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Abiria</span>
                  <strong>{completedRecord.passengerName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Kupandia</span>
                  <span>{completedRecord.boardingStop}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Kushukia</span>
                  <span>{completedRecord.destinationStop}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Aina ya Nafasi</span>
                  <span>{completedRecord.seatType === 'seat' ? `Kiti cha Kukaa ${completedRecord.seatNumber ? `#${completedRecord.seatNumber}` : ''}` : 'Msimamo (Standing)'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-sans block">Hali ya Malipo</span>
                  <span className="text-emerald-600 font-bold uppercase">{completedRecord.paymentStatus} ({completedRecord.paymentMethod})</span>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex justify-between items-center text-sm font-sans font-black">
                <span>Jumla ya Nauli:</span>
                <span className="text-emerald-600">TSh {completedRecord.fareTzs.toLocaleString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  toast.success(`Ujumbe wa SMS ya tiketi umetumwa kwa ${completedRecord.passengerPhone}!`);
                }}
                className="py-2.5 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5 text-blue-600" />
                <span>Tuma SMS ya Tiketi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Reset form to add another passenger
                  setPassengerName('');
                  setPassengerPhone('');
                  setSeatNumber('');
                  setCompletedRecord(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sajili Abiria Mwingine</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-center text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Funga Dirisha
            </button>
          </div>
        ) : (
          /* View 2: Registration Form */
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Chagua Chombo cha Daladala */}
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bus className="w-3.5 h-3.5 text-blue-600" />
                  Chagua Daladala / Chombo *
                </span>
                {currentVehicle && (
                  <span className="text-[11px] font-normal text-neutral-500">
                    Nafasi: <strong className="text-emerald-600">{currentVehicle.capacity - currentVehicle.seatsTaken}</strong> wazi / {currentVehicle.capacity}
                  </span>
                )}
              </label>
              <select
                value={vehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} • {v.routeCode} ({v.nickname}) — {v.capacity - v.seatsTaken} viti wazi
                  </option>
                ))}
              </select>
            </div>

            {/* Passenger Name & Quick Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-neutral-800 dark:text-neutral-200">
                  Jina la Abiria *
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPassengerName('Abiria wa Kawaida')}
                    className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[10px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 font-bold"
                  >
                    + Kawaida
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassengerName('Mwanafunzi');
                      setFareTzs(currentRoute?.studentFareTzs || 200);
                    }}
                    className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-[10px] text-blue-700 dark:text-blue-300 hover:bg-blue-200 font-bold"
                  >
                    + Mwanafunzi (TSh 200)
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                placeholder="k.m. Amina Juma au Mteja wa Kawaida"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Passenger Phone & Seat Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Namba ya Simu (Hiari - ya SMS)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="tel"
                    placeholder="07XX XXX XXX"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Aina ya Nafasi
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSeatType('seat')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      seatType === 'seat'
                        ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span>🪑 Kiti</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeatType('standing')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      seatType === 'standing'
                        ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span>🚶 Msimamo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Boarding and Destination Stops */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Kituo cha Kupandia (Boarding)
                </label>
                <select
                  value={boardingStop}
                  onChange={(e) => setBoardingStop(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {currentRoute?.stops?.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.name} {stop.isTerminal ? '(Stendi Kuu)' : ''}
                    </option>
                  )) || <option value="Kituo cha Kwanza">Kituo cha Kwanza</option>}
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Kituo cha Kushukia (Drop-off)
                </label>
                <select
                  value={destinationStop}
                  onChange={(e) => setDestinationStop(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {currentRoute?.stops?.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.name} {stop.isTerminal ? '(Mwisho wa Ruti)' : ''}
                    </option>
                  )) || <option value="Kituo cha Mwisho">Kituo cha Mwisho</option>}
                </select>
              </div>
            </div>

            {/* Fare & Quick Fare Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-neutral-800 dark:text-neutral-200">
                  Nauli ya Safari (TSh) *
                </label>
                <div className="flex items-center gap-1">
                  {[400, 500, 600, 750, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFareTzs(amt)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        fareTzs === amt
                          ? 'bg-blue-600 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                required
                min="100"
                step="50"
                value={fareTzs}
                onChange={(e) => setFareTzs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-black text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Payment Method & Payment Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Njia ya Malipo
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">💵 Fedha Taslimu (Cash)</option>
                  <option value="mpesa">📱 Vodacom M-Pesa</option>
                  <option value="tigopesa">📱 Tigo Pesa</option>
                  <option value="airtel">📱 Airtel Money</option>
                  <option value="papo_wallet">💳 Papo Wallet</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                  Hali ya Malipo
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="paid">✅ Imelipwa (Paid)</option>
                  <option value="pending">⏳ Haijalipwa (Pending / Atalipa)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                Ghairi
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black shadow-lg shadow-blue-500/25 flex items-center gap-2 transition active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sajili Abiria & Kata Tiketi</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
