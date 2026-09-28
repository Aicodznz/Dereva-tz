import React, { useState } from 'react';
import { DaladalaRoute, DaladalaVehicle, FleetVehicleRecord, DaladalaCrewMember, DaladalaStop } from '../../types/daladala.types';
import { 
  Bus, 
  X, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Calendar, 
  FileText,
  DollarSign,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';

interface DaladalaRegisterVehicleModalProps {
  routes: DaladalaRoute[];
  crewMembers?: DaladalaCrewMember[];
  onClose: () => void;
  onAddVehicle: (newVehicle: DaladalaVehicle, newFleetRecord: FleetVehicleRecord) => void;
}

export default function DaladalaRegisterVehicleModal({
  routes,
  crewMembers = [],
  onClose,
  onAddVehicle,
}: DaladalaRegisterVehicleModalProps) {
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleNickname, setNewVehicleNickname] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('Toyota Coaster (30 Seater)');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState('30');
  const [newVehicleRouteId, setNewVehicleRouteId] = useState(routes[0]?.id || 'route_morogoro_rd');
  const [newVehicleDriverName, setNewVehicleDriverName] = useState('');
  const [newVehicleConductorName, setNewVehicleConductorName] = useState('');
  const [newVehicleConductorPhone, setNewVehicleConductorPhone] = useState('');
  const [newVehicleTargetTzs, setNewVehicleTargetTzs] = useState('140000');
  const [newVehicleColor, setNewVehicleColor] = useState('#2563eb');
  const [latraLicenseNumber, setLatraLicenseNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newVehiclePlate.trim() || !newVehicleNickname.trim()) {
      toast.error('Tafadhali jaza namba ya usajili wa gari na jina la utani!');
      return;
    }

    const selectedRoute = routes.find((r) => r.id === newVehicleRouteId) || routes[0];
    const plate = newVehiclePlate.toUpperCase().trim();
    const capacityNum = parseInt(newVehicleCapacity, 10) || 30;
    const targetNum = parseInt(newVehicleTargetTzs, 10) || 140000;

    const firstStop: DaladalaStop = selectedRoute?.stops[0] || { id: 'stop_01', lat: -6.8140, lng: 39.2450, name: 'Stendi Kuu' };
    const secondStop = selectedRoute?.stops[1] || { id: 'stop_02', lat: -6.8160, lng: 39.2500, name: 'Kituo cha Mbele' };

    const newVehicle: DaladalaVehicle = {
      id: `daladala_${Date.now()}`,
      plateNumber: plate,
      nickname: newVehicleNickname.trim(),
      routeId: selectedRoute?.id || 'route_morogoro_rd',
      routeCode: selectedRoute?.routeCode || 'DL-01',
      routeName: selectedRoute?.name || 'Ruti Mpya',
      capacity: capacityNum,
      seatsTaken: 0,
      standingCount: 0,
      seatStatus: 'available',
      currentLat: firstStop.lat,
      currentLng: firstStop.lng,
      heading: 90,
      speedKmH: 0,
      nextStopId: firstStop.id || 'stop_01',
      nextStopName: secondStop.name,
      etaMinutesToNextStop: 2,
      driverName: newVehicleDriverName.trim() || 'Dereva Mteule',
      conductorName: newVehicleConductorName.trim() || 'Kondakta Mteule',
      conductorPhone: newVehicleConductorPhone.trim() || '0700 000 000',
      rating: 5.0,
      ratingCount: 1,
      isOffRoute: false,
      lastUpdated: 'Muda huu',
      colorHex: newVehicleColor,
      vehicleModel: newVehicleModel,
    };

    const newFleetRecord: FleetVehicleRecord = {
      id: `fleet_${Date.now()}`,
      plateNumber: plate,
      nickname: newVehicleNickname.trim(),
      routeCode: selectedRoute?.routeCode || 'DL-01',
      driverName: newVehicleDriverName.trim() || 'Dereva Mteule',
      conductorName: newVehicleConductorName.trim() || 'Kondakta Mteule',
      dailyTargetTzs: targetNum,
      todayRevenueTzs: 0,
      cashCollectedTzs: 0,
      digitalCollectedTzs: 0,
      fuelExpenseTzs: 0,
      terminalFeeTzs: 3000,
      tripsCount: 0,
      oilServiceKmRemaining: 4500,
      latraExpiryDate: '2026-12-31',
      insuranceExpiryDate: '2026-11-30',
      status: 'active',
    };

    onAddVehicle(newVehicle, newFleetRecord);
    toast.success(`🎉 Chombo ${plate} ("${newVehicleNickname}") kimesajiliwa vizuri na kuwekwa kazini!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base text-neutral-900 dark:text-white">
                  Sajili Chombo Chako (Daladala Mpya)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase">
                  LATRA Verified
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Weka chombo chako hewani kwenye GPS, panga ruti, dereva na uone dasibodi ya hesabu.
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

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Plate Number & Nickname */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Namba ya Usajili (Plate No.) *
              </label>
              <input
                type="text"
                required
                placeholder="k.m. T 842 EEB"
                value={newVehiclePlate}
                onChange={(e) => setNewVehiclePlate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono uppercase font-black tracking-wide focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Jina la Utani (Nickname) *
              </label>
              <input
                type="text"
                required
                placeholder='k.m. "Mwendo Kasi" au "Simba"'
                value={newVehicleNickname}
                onChange={(e) => setNewVehicleNickname(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Model & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Aina ya Gari (Model)
              </label>
              <select
                value={newVehicleModel}
                onChange={(e) => setNewVehicleModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="Toyota Coaster (30 Seater)">Toyota Coaster (30 Seater)</option>
                <option value="Isuzu Journey (26 Seater)">Isuzu Journey (26 Seater)</option>
                <option value="Mitsubishi Rosa (28 Seater)">Mitsubishi Rosa (28 Seater)</option>
                <option value="Toyota Hiace / Commuter (16 Seater)">Toyota Hiace (16 Seater)</option>
                <option value="Scania Minibus (35 Seater)">Scania Minibus (35 Seater)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Idadi ya Viti vya Kukaa (Capacity)
              </label>
              <input
                type="number"
                min="12"
                max="65"
                value={newVehicleCapacity}
                onChange={(e) => setNewVehicleCapacity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Route Assignment */}
          <div>
            <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
              Ruti Ambayo Gari Litafanya Kazi *
            </label>
            <select
              value={newVehicleRouteId}
              onChange={(e) => setNewVehicleRouteId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.routeCode}] {r.name} ({r.via})
                </option>
              ))}
            </select>
          </div>

          {/* Driver & Conductor assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Jina la Dereva
              </label>
              <input
                type="text"
                placeholder="k.m. Juma Hamisi"
                value={newVehicleDriverName}
                onChange={(e) => setNewVehicleDriverName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Jina la Kondakta (Konda)
              </label>
              <input
                type="text"
                placeholder="k.m. Bakari Ally"
                value={newVehicleConductorName}
                onChange={(e) => setNewVehicleConductorName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Conductor Phone & Daily Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Simu ya Kondakta (Kupokea Nauli)
              </label>
              <input
                type="tel"
                placeholder="07XX XXX XXX"
                value={newVehicleConductorPhone}
                onChange={(e) => setNewVehicleConductorPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Lengo la Hesabu kwa Siku (TSh) *
              </label>
              <input
                type="number"
                step="5000"
                value={newVehicleTargetTzs}
                onChange={(e) => setNewVehicleTargetTzs(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-black text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* LATRA License & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Leseni ya LATRA (Road Service Permit)
              </label>
              <input
                type="text"
                placeholder="k.m. LATRA/RSP/2026/0921"
                value={latraLicenseNumber}
                onChange={(e) => setLatraLicenseNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 dark:text-neutral-200 block mb-1">
                Rangi ya Alama ya Gari Kwenye Ramani
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newVehicleColor}
                  onChange={(e) => setNewVehicleColor(e.target.value)}
                  className="w-10 h-9 p-0.5 rounded-xl border border-neutral-300 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold">{newVehicleColor}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
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
              <span>Hifadhi & Weka Kwenye Dasibodi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
