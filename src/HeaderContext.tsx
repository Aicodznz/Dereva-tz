import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface LocationDetails {
  address: string;
  lat: number;
  lng: number;
}

interface HeaderContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  location: string;
  setLocation: (l: string) => void;
  locationDetails: LocationDetails;
  setLocationDetails: (loc: LocationDetails) => void;
  onLocationClick: () => void;
  setOnLocationClick: (fn: () => void) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

const getDefaultLocation = (): LocationDetails => {
  try {
    const saved = localStorage.getItem('omniserve_user_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        address: parsed.address || parsed.name || 'Galagaza, Kibaha Town, Pwani',
        lat: Number(parsed.lat || -6.7924),
        lng: Number(parsed.lng || 39.2083)
      };
    }
  } catch {}
  return {
    address: 'Galagaza, Kibaha Town, Pwani',
    lat: -6.7924,
    lng: 39.2083
  };
};

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationDetails, setLocationDetailsState] = useState<LocationDetails>(getDefaultLocation);
  const [location, setLocationState] = useState<string>(() => getDefaultLocation().address);
  const [onLocationClick, setOnLocationClickState] = useState<() => void>(() => () => {});

  const setLocation = useCallback((l: string) => {
    setLocationState(prev => (prev === l ? prev : l));
    setLocationDetailsState(prev => (prev.address === l ? prev : { ...prev, address: l }));
  }, []);

  const setLocationDetails = useCallback((loc: LocationDetails) => {
    setLocationDetailsState(prev => {
      if (prev.address === loc.address && prev.lat === loc.lat && prev.lng === loc.lng) return prev;
      return loc;
    });
    setLocationState(prev => (prev === loc.address ? prev : loc.address));
    try {
      localStorage.setItem('omniserve_user_location', JSON.stringify(loc));
      localStorage.setItem('omniserve_location_verified', 'true');
    } catch {}
  }, []);

  const setOnLocationClick = useCallback((fn: () => void) => {
    setOnLocationClickState(() => fn);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const updated = getDefaultLocation();
      setLocationDetailsState(updated);
      setLocationState(updated.address);
    };

    const handleCustom = (e: any) => {
      if (e?.detail) {
        const det = e.detail;
        const newLoc: LocationDetails = {
          address: det.address || det.name || 'Galagaza, Kibaha Town, Pwani',
          lat: Number(det.lat || -6.7924),
          lng: Number(det.lng || 39.2083)
        };
        setLocationDetailsState(newLoc);
        setLocationState(newLoc.address);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('omniserve_location_updated', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('omniserve_location_updated', handleCustom);
    };
  }, []);

  const contextValue = useMemo(() => ({ 
    searchQuery, setSearchQuery, 
    location, setLocation, 
    locationDetails, setLocationDetails,
    onLocationClick, setOnLocationClick 
  }), [searchQuery, location, locationDetails, onLocationClick, setLocation, setLocationDetails, setOnLocationClick]);

  return (
    <HeaderContext.Provider value={contextValue}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    const fallback = getDefaultLocation();
    return {
      searchQuery: '',
      setSearchQuery: () => {},
      location: fallback.address,
      setLocation: () => {},
      locationDetails: fallback,
      setLocationDetails: () => {},
      onLocationClick: () => {},
      setOnLocationClick: () => {}
    };
  }
  return context;
}
