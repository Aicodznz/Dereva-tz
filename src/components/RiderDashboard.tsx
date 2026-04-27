import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Home, BarChart2, Briefcase, Settings, 
  MapPin, Shield, CheckCircle, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// New Sub-components
import RiderHome from './rider/RiderHome';
import RiderStats from './rider/RiderStats';
import RiderRides from './rider/RiderRides';
import RiderSettings from './rider/RiderSettings';
import RiderWallet from './rider/RiderWallet';
import RiderRegistrationDetails from './rider/RiderRegistrationDetails';

type NavTab = 'home' | 'performance' | 'rides' | 'settings' | 'wallet' | 'docs' | 'vehicle' | 'bank';

export default function RiderDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [prevTab, setPrevTab] = useState<NavTab>('home');
  const [notificationsCount, setNotificationsCount] = useState(3);

  // Handle nested navigation
  const handleSettingsNavigate = (view: string) => {
    if (view === 'wallet') setActiveTab('wallet');
    if (view === 'docs') setActiveTab('docs');
    if (view === 'vehicle') setActiveTab('vehicle');
    if (view === 'bank') setActiveTab('bank');
    // Add other routes as needed
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <RiderHome />;
      case 'performance':
        return <RiderStats />;
      case 'rides':
        return <RiderRides />;
      case 'settings':
        return <RiderSettings onNavigate={handleSettingsNavigate} />;
      case 'wallet':
        return <RiderWallet onBack={() => setActiveTab('settings')} />;
      case 'docs':
        return <RiderRegistrationDetails initialTab="docs" onBack={() => setActiveTab('settings')} />;
      case 'vehicle':
        return <RiderRegistrationDetails initialTab="vehicle" onBack={() => setActiveTab('settings')} />;
      case 'bank':
        return <RiderRegistrationDetails initialTab="bank" onBack={() => setActiveTab('settings')} />;
      default:
        return <RiderHome />;
    }
  };

  const navItems = [
    { id: 'performance', icon: BarChart2, label: 'Stats' },
    { id: 'rides', icon: Briefcase, label: 'Rides' },
    { id: 'home', icon: Home, label: 'Home', isMain: true },
    { id: 'wallet', icon: Bell, label: 'Alerts', badge: notificationsCount },
    { id: 'settings', icon: Settings, label: 'Profile' }
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 relative flex flex-col h-screen overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modern Bottom Tab Bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-white/20 dark:border-neutral-800/50 h-20 rounded-[2.5rem] shadow-2xl flex items-center justify-around px-2 relative">
            {/* Active Indicator Background */}
            <motion.div 
              layoutId="nav-glow"
              className="absolute w-12 h-1 bg-emerald-500 rounded-full -top-0.5"
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ 
                left: `calc(${(navItems.findIndex(item => item.id === activeTab)) * 20}% + 10% - 24px)` 
              }}
            />

            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setPrevTab(activeTab);
                  setActiveTab(item.id as NavTab);
                }}
                className={`relative flex flex-col items-center justify-center transition-all duration-300 ${
                  activeTab === item.id ? 'text-emerald-600 scale-110' : 'text-neutral-400'
                } ${item.isMain ? '-mt-12' : ''}`}
              >
                {item.isMain ? (
                  <div className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center border-4 border-white dark:border-neutral-900 ${
                    activeTab === item.id ? 'bg-emerald-600 text-white shadow-emerald-500/40' : 'bg-neutral-900 text-white dark:bg-neutral-800'
                  }`}>
                    <item.icon className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="p-2 relative">
                    <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    {item.badge && item.badge > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {!item.isMain && (
                   <span className={`text-[8px] font-black uppercase tracking-widest mt-1 ${
                     activeTab === item.id ? 'opacity-100' : 'opacity-0'
                   } transition-opacity`}>
                      {item.label}
                   </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
