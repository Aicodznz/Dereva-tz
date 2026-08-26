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
  appLogo: 'https://cdn-icons-png.flaticon.com/512/5717/5717387.png',
  splashText: 'Usafiri wa Haraka, Salama na Uhakika',
  splashColor: '#0c0c0e',
  splashSlides: [
    {
      id: "slide_1",
      title: "Karibu Papo Hapo!",
      description: "App bora zaidi ya huduma za usafiri wa haraka na uwasilishaji mizigo/chakula papo hapo.",
      imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?auto=format&fit=crop&w=600&q=80",
      color: "#0c0c0e",
      titleColor: "#ffffff",
      descColor: "#9ca3af"
    },
    {
      id: "slide_2",
      title: "Usafiri na Ubebaji Mizigo",
      description: "Chagua Gari, Bajaji au Pikipiki kulingana na mahitaji yako na ujionee safari isiyo na kelele.",
      imageUrl: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=600&q=80",
      color: "#0a1a0f",
      titleColor: "#ffffff",
      descColor: "#9ca3af"
    },
    {
      id: "slide_3",
      title: "Ulinzi na Usalama",
      description: "Madereva wetu wote wamehakikiwa vizuri na kupitishwa na mfumo ili kukuhakikishia usalama 100%.",
      imageUrl: "https://images.unsplash.com/photo-1494959764136-6be9eb3c261e?auto=format&fit=crop&w=600&q=80",
      color: "#0b161e",
      titleColor: "#ffffff",
      descColor: "#9ca3af"
    }
  ],
  enableAppDownload: true,
  apkDownloadUrl: '',
  playStoreUrl: 'https://play.google.com',
  appStoreUrl: 'https://apps.apple.com',
  vehicles: {
    mini: {
      id: "mini",
      name: "Gari",
      price: 2800,
      sub: "Max 4 Siti",
      image: "🚗",
      imageType: "emoji",
      imageUrl: "",
      mapMarkerUrl: ""
    },
    bajaj: {
      id: "bajaj",
      name: "Bajaji",
      price: 1500,
      sub: "3 Siti",
      image: "🛺",
      imageType: "emoji",
      imageUrl: "",
      mapMarkerUrl: ""
    },
    bike: {
      id: "bike",
      name: "Pikipiki",
      price: 800,
      sub: "Usafiri Salama",
      image: "🏍️",
      imageType: "emoji",
      imageUrl: "",
      mapMarkerUrl: ""
    },
    rental: {
      id: "rental",
      name: "Kukodi Gari",
      price: 45000,
      sub: "Kukodi Gari / Siku",
      image: "🔑🚗",
      imageType: "emoji",
      imageUrl: "",
      mapMarkerUrl: ""
    }
  }
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
