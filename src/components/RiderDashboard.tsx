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
import RiderAppSettings from './rider/RiderAppSettings';
import RiderProfileDetails from './rider/RiderProfileDetails';
import RiderSubscription from './rider/RiderSubscription';
import RiderIncentive from './rider/RiderIncentive';
import RiderReferral from './rider/RiderReferral';
import RiderSupportTicket from './rider/RiderSupportTicket';
import RiderChatStaff from './rider/RiderChatStaff';
import RiderPrivacyPolicy from './rider/RiderPrivacyPolicy';
import RiderLanguage from './rider/RiderLanguage';

type NavTab = 'home' | 'performance' | 'rides' | 'settings' | 'wallet' | 'docs' | 'vehicle' | 'bank' | 'app-settings' | 'profile' | 'subscription' | 'incentive' | 'referral' | 'ticket' | 'chat' | 'privacy' | 'lang';

export default function RiderDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [prevTab, setPrevTab] = useState<NavTab>('home');
  const [notificationsCount, setNotificationsCount] = useState(3);
  const [isNavVisible, setIsNavVisible] = useState(true);

  // Handle nested navigation
  const handleSettingsNavigate = (view: string) => {
    if (view === 'wallet') setActiveTab('wallet');
    if (view === 'docs') setActiveTab('docs');
    if (view === 'vehicle') setActiveTab('vehicle');
    if (view === 'bank') setActiveTab('bank');
    if (view === 'app-settings') setActiveTab('app-settings');
    if (view === 'profile') setActiveTab('profile');
    if (view === 'subscription') setActiveTab('subscription');
    if (view === 'incentive') setActiveTab('incentive');
    if (view === 'referral') setActiveTab('referral');
    if (view === 'ticket') setActiveTab('ticket');
    if (view === 'chat') setActiveTab('chat');
    if (view === 'privacy') setActiveTab('privacy');
    if (view === 'lang') setActiveTab('lang');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <RiderHome onNavVisibilityChange={setIsNavVisible} onProfileClick={() => setActiveTab('settings')} />;
      case 'performance':
        return <RiderStats />;
      case 'rides':
        return <RiderRides />;
      case 'settings':
        return <RiderSettings onNavigate={handleSettingsNavigate} onBack={() => setActiveTab('home')} />;
      case 'wallet':
        return <RiderWallet onBack={() => setActiveTab('settings')} />;
      case 'docs':
        return <RiderRegistrationDetails initialTab="docs" onBack={() => setActiveTab('settings')} />;
      case 'vehicle':
        return <RiderRegistrationDetails initialTab="vehicle" onBack={() => setActiveTab('settings')} />;
      case 'bank':
        return <RiderRegistrationDetails initialTab="bank" onBack={() => setActiveTab('settings')} />;
      case 'app-settings':
        return <RiderAppSettings onBack={() => setActiveTab('settings')} />;
      case 'profile':
        return <RiderProfileDetails onBack={() => setActiveTab('settings')} />;
      case 'subscription':
        return <RiderSubscription onBack={() => setActiveTab('settings')} />;
      case 'incentive':
        return <RiderIncentive onBack={() => setActiveTab('settings')} />;
      case 'referral':
        return <RiderReferral onBack={() => setActiveTab('settings')} />;
      case 'ticket':
        return <RiderSupportTicket onBack={() => setActiveTab('settings')} />;
      case 'chat':
        return <RiderChatStaff onBack={() => setActiveTab('settings')} />;
      case 'privacy':
        return <RiderPrivacyPolicy onBack={() => setActiveTab('settings')} />;
      case 'lang':
        return <RiderLanguage onBack={() => setActiveTab('settings')} />;
      default:
        return <RiderHome onProfileClick={() => setActiveTab('settings')} />;
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
    </div>
  );
}
