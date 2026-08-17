import React from 'react';
import { 
  Bell, 
  Receipt, 
  GlassWater, 
  Sparkles, 
  Utensils, 
  MessageSquare, 
  CheckCircle2, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Clock, 
  UserCheck, 
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WaiterCall } from '../types';

interface WaiterCallsPanelProps {
  calls: WaiterCall[];
  onAcknowledge: (callId: string) => void;
  onResolve: (callId: string) => void;
  onDelete: (callId: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const WaiterCallsPanel: React.FC<WaiterCallsPanelProps> = ({
  calls,
  onAcknowledge,
  onResolve,
  onDelete,
  soundEnabled,
  onToggleSound
}) => {
  const getCallTypeDetails = (type: string) => {
    switch (type) {
      case 'bill':
        return { label: 'Omba Bili / Risiti', icon: Receipt, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'water':
        return { label: 'Maji Safi ya Kunywa', icon: GlassWater, color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'napkins':
        return { label: 'Vitambaa / Vyombo', icon: Utensils, color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'clean':
        return { label: 'Kusafisha Meza', icon: Sparkles, color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'custom':
        return { label: 'Ujumbe Maalumu', icon: MessageSquare, color: 'bg-neutral-700/50 text-neutral-200 border-neutral-600' };
      case 'waiter':
      default:
        return { label: 'Muite Mhudumu', icon: Bell, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
  };

  const getTimeAgo = (date: any) => {
    if (!date) return 'Sasa hivi';
    const timestamp = date?.toDate ? date.toDate().getTime() : (typeof date === 'number' ? date : new Date(date).getTime());
    if (isNaN(timestamp)) return 'Sasa hivi';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s zilizopita`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `Dakika ${mins} zilizopita`;
    const hrs = Math.floor(mins / 60);
    return `Masaa ${hrs} yaliyopita`;
  };

  const pendingCalls = calls.filter(c => c.status === 'pending');
  const attendingCalls = calls.filter(c => c.status === 'attending');

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                Kengele za Mhudumu Mezani (Waiter Calls)
              </h3>
              {pendingCalls.length > 0 && (
                <Badge className="bg-red-600 text-white font-black text-[10px] uppercase px-2 animate-pulse">
                  {pendingCalls.length} Mpya
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-400 font-medium">
              Maombi ya wateja waliopo mezani (Bili, Maji, Vitambaa & Mhudumu)
            </p>
          </div>
        </div>

        {/* Audio Toggle */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleSound}
            className={`border-neutral-700 h-9 px-3 text-xs font-bold rounded-xl transition-all ${
              soundEnabled 
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 mr-1.5 text-amber-400" />
                Sauti ya Kengele Imewashwa
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 mr-1.5 text-neutral-500" />
                Sauti ya Kengele Imezimwa
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content list */}
      {calls.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
          <p className="text-xs font-black uppercase tracking-wider text-neutral-300">
            Hakuna kengele inayosubiri kwa sasa
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Wateja wanapopiga kengele au kuomba bili kutoka mezani, zitatokea hapa papo hapo pamoja na sauti.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <AnimatePresence mode="popLayout">
            {calls.map((call) => {
              const details = getCallTypeDetails(call.requestType);
              const IconComp = details.icon;
              const isPending = call.status === 'pending';

              return (
                <motion.div
                  key={call.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-4 rounded-2xl border relative flex flex-col justify-between gap-3 shadow-lg transition-all ${
                    isPending 
                      ? 'bg-gradient-to-br from-amber-950/40 to-neutral-900 border-amber-500/60 ring-1 ring-amber-500/30' 
                      : 'bg-neutral-950/80 border-neutral-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-sm">
                        MEZA #{call.tableNumber}
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 ${details.color}`}>
                        <IconComp className="w-3 h-3" />
                        {details.label}
                      </div>
                    </div>

                    <span className="text-[10px] text-neutral-400 flex items-center gap-1 shrink-0 font-medium">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      {getTimeAgo(call.createdAt)}
                    </span>
                  </div>

                  {call.customNote && (
                    <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 text-xs text-neutral-300 italic">
                      "{call.customNote}"
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <div className="text-[10px] text-neutral-400 font-bold">
                      {isPending ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          Inasubiri mhudumu...
                        </span>
                      ) : (
                        <span className="text-blue-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          Mhudumu anashughulikia
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => call.id && onAcknowledge(call.id)}
                          className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded-xl cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Nipo Njiani
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => call.id && onResolve(call.id)}
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Kamilisha
                      </Button>

                      <button
                        type="button"
                        onClick={() => call.id && onDelete(call.id)}
                        className="w-8 h-8 rounded-xl bg-neutral-800 hover:bg-red-600/30 text-neutral-400 hover:text-red-300 flex items-center justify-center transition-colors cursor-pointer"
                        title="Futa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
