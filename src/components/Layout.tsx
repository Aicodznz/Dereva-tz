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
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ label: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">O</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-neutral-900">OmniServe</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  location.pathname === item.path ? 'text-orange-600' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-neutral-900">{profile?.displayName}</p>
                  <p className="text-xs text-neutral-500 capitalize">{profile?.role}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="text-neutral-500 hover:text-red-600">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-6 py-3 flex justify-between items-center z-50">
        {[
          { label: 'Nyumbani', path: '/', icon: ShoppingBag },
          { label: 'Oda Zangu', path: '/orders', icon: Receipt },
          { label: 'Ofa', path: '/offers', icon: Tag },
          { label: 'Akaunti', path: '/profile', icon: User },
        ].map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center gap-1 ${location.pathname === item.path ? 'text-orange-600' : 'text-neutral-400'}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
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
