import React from 'react';
import { 
  User, Wallet, Settings, LayoutGrid, Shield, MessageSquare, 
  HelpCircle, Share2, LogOut, ChevronRight, Calculator,
  BookOpen, Car, Building2, Trash2, Milestone, Languages, ArrowLeft,
  Users, Sparkles, Flame
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { motion } from 'motion/react';

const menuGroups = [
  {
    title: "Account & Profile",
    items: [
      { icon: User, name: "My Profile", action: "profile", color: "text-blue-500", bg: "bg-blue-50" },
      { icon: Wallet, name: "My Wallet & Malipo", action: "wallet", color: "text-emerald-500", bg: "bg-emerald-50" },
      { icon: LayoutGrid, name: "App Settings", action: "app-settings", color: "text-orange-500", bg: "bg-orange-50" }
    ]
  },
  {
    title: "Business, Vifurushi & Mikopo",
    items: [
      { icon: Flame, name: "Vifurushi vya Safari (PapoPass 0%)", action: "subscription", color: "text-amber-500", bg: "bg-amber-50" },
      { icon: Users, name: "Dhamana ya SACCO / Chama", action: "sacco", color: "text-blue-600", bg: "bg-blue-50" },
      { icon: Sparkles, name: "AI Alama & Kikomo cha Deni", action: "aicredit", color: "text-purple-500", bg: "bg-purple-50" },
      { icon: Flame, name: "Vivutio & Bonasi za Kazi (Quests)", action: "incentive", color: "text-amber-500", bg: "bg-amber-50" },
      { icon: Share2, name: "Alika Madereva (Referral)", action: "referral", color: "text-cyan-500", bg: "bg-cyan-50" }
    ]
  },
  {
    title: "Registration Details",
    items: [
      { icon: BookOpen, name: "Document Details", action: "docs", color: "text-amber-500", bg: "bg-amber-50" },
      { icon: Car, name: "Vehicle Details", action: "vehicle", color: "text-indigo-500", bg: "bg-indigo-50" },
      { icon: Building2, name: "Bank Details", action: "bank", color: "text-slate-500", bg: "bg-slate-50" }
    ]
  },
  {
    title: "Support & Legal",
    items: [
      { icon: HelpCircle, name: "Support Ticket", action: "ticket", color: "text-rose-500", bg: "bg-rose-50" },
      { icon: MessageSquare, name: "Chat with Staff", action: "chat", color: "text-emerald-500", bg: "bg-emerald-50" },
      { icon: Shield, name: "Privacy Policy", action: "privacy", color: "text-neutral-500", bg: "bg-neutral-50" },
      { icon: Languages, name: "Select Language", action: "lang", color: "text-blue-600", bg: "bg-blue-50" }
    ]
  }
];

export default function RiderSettings({ onNavigate, onBack }: { onNavigate: (view: string) => void; onBack?: () => void }) {
  const { logout, profile } = useAuth();

  return (
    <div className="h-full overflow-y-auto p-4 pb-28 space-y-4 max-w-2xl mx-auto">
      {/* Top Bar with Back option */}
      {onBack && (
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
            title="Rudi kwenye Ramani"
          >
             <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[8px] font-black uppercase text-neutral-400 tracking-[0.2em] leading-none block mb-0.5">WASIFU WA DEREVA</span>
            <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 leading-none">Mipangilio & Taarifa</span>
          </div>
        </div>
      )}

      {/* Header Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-[1.8rem] p-4 text-white relative overflow-hidden group shadow-md"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-105 transition-transform">
           <Settings className="w-16 h-16" />
        </div>
        
        <div className="relative z-10 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl border border-emerald-500 p-0.5 relative overflow-hidden shadow-md">
              <img 
                src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email || 'driver'}`} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-xl" 
              />
           </div>
           <div>
              <h1 className="text-lg font-black italic uppercase tracking-tighter leading-none mb-1">{profile?.displayName || 'Moses'}</h1>
              <p className="text-[9px] font-black uppercase text-neutral-400 tracking-wider leading-none mb-2">{profile?.email}</p>
              <div className="flex items-center gap-1.5">
                 <span className="bg-emerald-600 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">Driver ID: 8219</span>
                 <span className="bg-white/10 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full">Verified ✓</span>
              </div>
           </div>
        </div>
      </motion.div>

      {/* Menu Groups */}
      <div className="space-y-3.5">
        {menuGroups.map((group, gIdx) => (
          <div key={group.title} className="space-y-1">
            <h3 className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">{group.title}</h3>
            <div className="bg-white dark:bg-neutral-900 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800/80 p-0.5 divide-y divide-neutral-100 dark:divide-neutral-800/40 shadow-sm overflow-hidden">
              {group.items.map((item, iIdx) => (
                <motion.button
                  key={item.name}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => onNavigate(item.action)}
                  className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-all group first:rounded-t-[1.3rem] last:rounded-b-[1.3rem]"
                >
                  <div className="flex items-center gap-3">
                     <div className={`w-8 h-8 rounded-lg ${item.bg} dark:bg-neutral-800 flex items-center justify-center transition-transform group-hover:scale-105`}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                     </div>
                     <span className="font-bold text-xs text-neutral-800 dark:text-neutral-200">{item.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-emerald-500 transition-colors" />
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={logout}
          className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 group text-left"
        >
          <div className="flex items-center gap-2.5 text-red-600">
             <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs">Logout</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-300" />
        </button>

        <button className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-dashed border-red-200 dark:border-red-900/30 group text-left">
          <div className="flex items-center gap-2.5 text-red-400">
             <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-[8px] uppercase tracking-wider">Delete Account</span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-200" />
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[8px] font-black uppercase text-neutral-300 tracking-widest pt-2">
        Papo Hapo Driver App v2.4.1 (Stable)
      </p>
    </div>
  );
}
