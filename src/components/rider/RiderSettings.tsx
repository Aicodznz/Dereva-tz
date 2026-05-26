import React from 'react';
import { 
  User, Wallet, Settings, LayoutGrid, Shield, MessageSquare, 
  HelpCircle, Share2, LogOut, ChevronRight, Calculator,
  BookOpen, Car, Building2, Trash2, Milestone, Languages, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { motion } from 'motion/react';

const menuGroups = [
  {
    title: "Account & Profile",
    items: [
      { icon: User, name: "My Profile", action: "profile", color: "text-blue-500", bg: "bg-blue-50" },
      { icon: Wallet, name: "My Wallet", action: "wallet", color: "text-emerald-500", bg: "bg-emerald-50" },
      { icon: LayoutGrid, name: "App Settings", action: "app-settings", color: "text-orange-500", bg: "bg-orange-50" }
    ]
  },
  {
    title: "Business & Earnings",
    items: [
      { icon: Calculator, name: "Subscription Plan", action: "subscription", color: "text-purple-500", bg: "bg-purple-50" },
      { icon: Milestone, name: "Incentive", action: "incentive", color: "text-pink-500", bg: "bg-pink-50" },
      { icon: Share2, name: "Earn Money", action: "referral", color: "text-cyan-500", bg: "bg-cyan-50" }
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
    <div className="h-full overflow-y-auto p-6 pb-36 space-y-8 max-w-2xl mx-auto">
      {/* Top Bar with Back option */}
      {onBack && (
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 shadow-sm"
            title="Rudi kwenye Ramani"
          >
             <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-[0.2em] leading-none block mb-0.5">WASIFU WA DEREVA</span>
            <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 leading-none">Mipangilio & Taarifa</span>
          </div>
        </div>
      )}

      {/* Header Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
           <Settings className="w-24 h-24" />
        </div>
        
        <div className="relative z-10 flex items-center gap-6">
           <div className="w-20 h-20 rounded-[2rem] border-2 border-emerald-500 p-1 relative overflow-hidden shadow-lg">
              <img 
                src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email}`} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-[1.5rem]" 
              />
           </div>
           <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-1">{profile?.displayName || 'Moses'}</h1>
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none mb-3">{profile?.email}</p>
              <div className="flex items-center gap-2">
                 <span className="bg-emerald-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Driver ID: 8219</span>
                 <span className="bg-white/10 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Verified ✓</span>
              </div>
           </div>
        </div>
      </motion.div>

      {/* Menu Groups */}
      <div className="space-y-10">
        {menuGroups.map((group, gIdx) => (
          <div key={group.title} className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em] px-2">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((item, iIdx) => (
                <motion.button
                  key={item.name}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate(item.action)}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl ${item.bg} dark:bg-neutral-800 flex items-center justify-center transition-transform group-hover:scale-110`}>
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                     </div>
                     <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{item.name}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-emerald-500 transition-colors" />
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="space-y-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-[1.5rem] border border-red-100 dark:border-red-900/30 group"
        >
          <div className="flex items-center gap-4 text-red-600">
             <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <LogOut className="w-5 h-5" />
             </div>
             <span className="font-bold text-sm">Logout</span>
          </div>
          <ChevronRight className="w-5 h-5 text-red-300" />
        </button>

        <button className="w-full flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-[1.5rem] border border-dashed border-red-200 dark:border-red-900/30 group">
          <div className="flex items-center gap-4 text-red-400">
             <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trash2 className="w-5 h-5" />
             </div>
             <span className="font-bold text-[10px] uppercase tracking-widest">Delete Account</span>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-200" />
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[9px] font-black uppercase text-neutral-300 tracking-widest pt-4">
        TegeX Driver App v2.4.1 (Stable)
      </p>
    </div>
  );
}
