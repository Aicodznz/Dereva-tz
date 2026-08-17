import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  Receipt, 
  GlassWater, 
  Sparkles, 
  Utensils, 
  Clock, 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { WaiterCallType } from '../types';
import { playSyntheticNormal, playSyntheticImportant } from '../utils/soundAlert';

interface CallWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  initialTableNumber?: string;
  customerName?: string;
}

const CALL_OPTIONS: { id: WaiterCallType; label: string; sub: string; icon: any; color: string }[] = [
  {
    id: 'waiter',
    label: 'Mhudumu Aje Mezani',
    sub: 'Hitaji mhudumu kufika mezani kwako',
    icon: Bell,
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 'bill',
    label: 'Omba Bili / Malipo',
    sub: 'Lete risiti ya malipo na bili mezani',
    icon: Receipt,
    color: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'water',
    label: 'Maji Safi ya Kunywa',
    sub: 'Maji ya baridi au ya kawaida',
    icon: GlassWater,
    color: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'napkins',
    label: 'Vitambaa & Vyombo',
    sub: 'Vitambaa (napkins), vijiko, au uma',
    icon: Utensils,
    color: 'from-purple-500 to-indigo-600'
  },
  {
    id: 'clean',
    label: 'Kusafisha Meza',
    sub: 'Futa au safisha meza haraka',
    icon: Sparkles,
    color: 'from-rose-500 to-pink-600'
  },
  {
    id: 'custom',
    label: 'Ombi Maalumu',
    sub: 'Andika ujumbe wowote wa ziada',
    icon: MessageSquare,
    color: 'from-neutral-700 to-neutral-800'
  }
];

export const CallWaiterModal: React.FC<CallWaiterModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  initialTableNumber = '',
  customerName = ''
}) => {
  const [tableNumber, setTableNumber] = useState(initialTableNumber);
  const [selectedType, setSelectedType] = useState<WaiterCallType>('waiter');
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCall, setActiveCall] = useState<any | null>(null);

  // Sync initial table number when opened
  useEffect(() => {
    if (initialTableNumber) {
      setTableNumber(initialTableNumber);
    }
  }, [initialTableNumber]);

  // Listen for existing active calls for this table
  useEffect(() => {
    if (!vendorId || !tableNumber) {
      setActiveCall(null);
      return;
    }

    const q = query(
      collection(db, 'vendors', vendorId, 'waiter_calls'),
      where('tableNumber', '==', tableNumber)
    );

    const unsub = onSnapshot(q, (snap) => {
      const activeCalls = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((c: any) => c.status === 'pending' || c.status === 'attending');

      if (activeCalls.length > 0) {
        // Pick the latest
        setActiveCall(activeCalls[0]);
      } else {
        setActiveCall(null);
      }
    }, (err) => {
      console.warn("Waiter calls query error:", err);
    });

    return () => unsub();
  }, [vendorId, tableNumber]);

  if (!isOpen) return null;

  const handleSendCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      toast.error('Tafadhali weka nambari ya meza yako (mfano: 21 au Meza 4)');
      return;
    }

    if (!vendorId) {
      toast.error('Mgahawa haujatambuliwa.');
      return;
    }

    setIsSubmitting(true);
    try {
      const callData = {
        vendorId,
        tableNumber: tableNumber.trim().toUpperCase(),
        requestType: selectedType,
        customNote: customNote.trim() || null,
        status: 'pending',
        customerName: customerName || 'Mteja wa Mezani',
        createdAt: serverTimestamp(),
        clientTimestamp: Date.now()
      };

      // Write to vendor subcollection
      await addDoc(collection(db, 'vendors', vendorId, 'waiter_calls'), callData);
      
      // Play nice sound feedback
      playSyntheticNormal();

      toast.success(`Kengele imelia! Mhudumu amearifiwa kuhusu Meza #${tableNumber.trim()}`, {
        duration: 4000
      });
      
      setCustomNote('');
    } catch (error) {
      console.error('Call waiter error:', error);
      toast.error('Hitilafu: Imeshindwa kutuma kengele ya mhudumu. Tafadhali jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCall = async () => {
    if (!activeCall?.id || !vendorId) return;
    try {
      await updateDoc(doc(db, 'vendors', vendorId, 'waiter_calls', activeCall.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      toast.info('Ombi la mhudumu limefutwa.');
      setActiveCall(null);
    } catch (error) {
      console.error('Cancel call error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="w-full max-w-lg bg-neutral-950 border border-amber-500/30 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30 text-white shrink-0 animate-bounce">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              Muite Mhudumu Mezani
            </h3>
            <p className="text-xs text-neutral-400 font-medium">
              {vendorName} • Huduma ya Haraka Papo Hapo
            </p>
          </div>
        </div>

        {/* Active Live Call Status Banner if already calling */}
        <AnimatePresence>
          {activeCall && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 to-neutral-900 border border-amber-500/50 flex flex-col gap-3 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute inset-0"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500 relative"></div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-amber-300">
                      {activeCall.status === 'attending' 
                        ? '🏃 Mhudumu Yupo Njiani Kuja!' 
                        : '🔔 Ombi Limeshatumwa (Inasubiri Mhudumu)'}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      Meza #{activeCall.tableNumber} • {activeCall.requestType?.toUpperCase()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelCall}
                  className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-[10px] font-black uppercase rounded-lg border border-red-500/30 cursor-pointer"
                >
                  Futa Ombi
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendCall} className="space-y-5">
          {/* Table Number Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center justify-between">
              <span>Nambari ya Meza Yako (Table #)</span>
              {initialTableNumber && (
                <span className="text-amber-400 font-bold lowercase">imegunduliwa kiotomatiki</span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Mfano: 21 au Meza 4"
                className="w-full bg-black/60 border border-white/10 focus:border-amber-500 h-13 px-4 rounded-2xl text-white font-black text-base placeholder:text-neutral-600 focus:outline-none transition-all"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                MEZA
              </div>
            </div>
          </div>

          {/* Quick Choice Selection Grid */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
              Chagua Unachohitaji (Request Type):
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {CALL_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedType(opt.id)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected 
                        ? 'bg-gradient-to-br from-neutral-900 to-neutral-950 border-amber-500 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500' 
                        : 'bg-neutral-900/60 border-white/5 hover:border-white/20 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-white shadow-sm`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-neutral-200'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[9.5px] text-neutral-400 leading-tight line-clamp-1 mt-0.5">
                        {opt.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Note */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
              Ujumbe wa Ziada (Hiari):
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Mfano: Tafadhali ongeza na barafu, au tuletee pili pili..."
              className="w-full bg-black/60 border border-white/10 focus:border-amber-500 p-3 rounded-2xl text-white text-xs placeholder:text-neutral-600 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 hover:brightness-110 active:scale-[0.99] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Inatuma Kengele...
              </>
            ) : (
              <>
                <Bell className="w-5 h-5" />
                Piga Kengele kwa Mhudumu Papo Hapo
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
