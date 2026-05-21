import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface BusinessConfig {
  name: string;
  email: string;
  phone: string;
  maintenanceMode: boolean;
  enableAR: boolean;
  [key: string]: any;
}

interface BusinessConfigContextType {
  config: BusinessConfig;
  loading: boolean;
}

const defaultConfig: BusinessConfig = {
  name: 'M-Duka Platform',
  email: 'admin@mduka.com',
  phone: '+255 700 000 000',
  maintenanceMode: false,
  enableAR: false,
  appLogo: 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
  splashText: 'Usafiri wa Haraka, Salama na Uhakika',
  splashColor: '#0c0c0e',
  enableAppDownload: true,
  apkDownloadUrl: 'https://example.com/download/app-release.apk',
  playStoreUrl: 'https://play.google.com',
  appStoreUrl: 'https://apps.apple.com',
};

const BusinessConfigContext = createContext<BusinessConfigContextType>({
  config: defaultConfig,
  loading: true,
});

export const useBusinessConfig = () => useContext(BusinessConfigContext);

export const BusinessConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BusinessConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'business'), (snap) => {
      if (snap.exists()) {
        setConfig(prev => ({ ...prev, ...snap.data() as BusinessConfig }));
      }
      setLoading(false);
    }, (error) => {
      // Gracefully handle permission errors (e.g. if rules aren't public yet)
      console.warn("Business config fetch restricted or failed, using defaults:", error.message);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <BusinessConfigContext.Provider value={{ config, loading }}>
      {children}
    </BusinessConfigContext.Provider>
  );
};
