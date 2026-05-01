import React, { createContext, useContext, useState } from 'react';

interface HeaderContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  location: string;
  setLocation: (l: string) => void;
  onLocationClick: () => void;
  setOnLocationClick: (fn: () => void) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Papo Hapo');
  const [onLocationClick, setOnLocationClick] = useState<() => void>(() => () => {});

  return (
    <HeaderContext.Provider value={{ 
      searchQuery, setSearchQuery, 
      location, setLocation, 
      onLocationClick, setOnLocationClick 
    }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
