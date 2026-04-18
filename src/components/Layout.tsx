import React from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, LayoutDashboard, ShoppingBag, Truck, ShieldCheck, Tag, Receipt } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, logout, signIn, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Marketplace', path: '/', icon: ShoppingBag },
    { label: 'My Orders', path: '/my-orders', icon: Receipt },
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ label: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-orange-100 selection:text-orange-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-neutral-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-orange-600/20">
              <span className="text-white font-black text-2xl italic tracking-tighter">O</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl leading-none uppercase italic tracking-tighter text-neutral-900">OmniServe</span>
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-[0.2em] mt-0.5">Super App</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                  location.pathname === item.path 
                    ? 'text-orange-600' 
                    : 'text-neutral-400 hover:text-neutral-900 hover:tracking-[0.15em]'
                }`}
              >
                <item.icon className={`w-4 h-4 ${location.pathname === item.path ? 'animate-pulse' : ''}`} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="text-right hidden sm:block hover:opacity-70 transition-opacity">
                  <p className="text-xs font-black uppercase italic text-neutral-900">{profile?.displayName}</p>
                  <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">{profile?.role}</p>
                </Link>
                <div className="h-4 w-px bg-neutral-200 hidden sm:block" />
                <Button variant="ghost" size="icon" onClick={logout} className="text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button className="bg-neutral-900 hover:bg-orange-600 text-white rounded-2xl px-8 font-black uppercase italic tracking-tighter transition-all">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation - Enhanced */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-100 px-8 py-4 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
        {[
          { label: 'Nyumbani', path: '/', icon: ShoppingBag },
          { label: 'Oda', path: '/my-orders', icon: Receipt },
          { label: 'Chat', path: '/chat', icon: Tag },
          { label: 'Akaunti', path: '/profile', icon: User },
        ].map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center gap-1.5 transition-all ${location.pathname === item.path ? 'text-orange-600 scale-110' : 'text-neutral-400'}`}
          >
            <item.icon className={`w-6 h-6 ${location.pathname === item.path ? 'animate-bounce' : ''}`} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}
      </div>

      <footer className="bg-white border-t border-neutral-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-neutral-500">© 2026 OmniServe Super App. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
