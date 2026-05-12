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
  enableAR: true,
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
      console.error("Error fetching business config:", error);
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
