import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface SavedAddress {
  id: string;
  label: string; // e.g. "Nyumbani", "Kazini", "Gym", "Duka langu", etc.
  address: string; // Full address string
  category: 'home' | 'work' | 'gym' | 'school' | 'shop' | 'custom';
  icon?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  createdAt: number;
}

export interface FavoriteDriver {
  id: string;
  driverId?: string;
  name: string;
  phone: string;
  photo?: string;
  vehicleType: 'mini' | 'bajaj' | 'bike' | string;
  vehiclePlate: string;
  vehicleModel?: string;
  vehicleColor?: string;
  rating?: number;
  notes?: string;
  addedAt: number;
}

const STORAGE_KEY_ADDRESSES = 'paporide_customer_saved_addresses';
const STORAGE_KEY_FAVORITE_DRIVERS = 'paporide_customer_favorite_drivers';

// Default starter addresses for quick onboarding if customer has none
export const DEFAULT_PRESET_ADDRESSES: Omit<SavedAddress, 'id' | 'createdAt'>[] = [
  {
    label: 'Nyumbani',
    category: 'home',
    address: '',
    icon: 'home',
    notes: 'Makazi yangu'
  },
  {
    label: 'Kazini',
    category: 'work',
    address: '',
    icon: 'work',
    notes: 'Ofisini / Kazini'
  }
];

// --- ADDRESSES STORAGE ---

export function getLocalSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADDRESSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[customerPreferences] Error reading saved addresses:', err);
    return [];
  }
}

export function setLocalSavedAddresses(addresses: SavedAddress[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADDRESSES, JSON.stringify(addresses));
    window.dispatchEvent(new CustomEvent('paporide_addresses_updated', { detail: addresses }));
  } catch (err) {
    console.warn('[customerPreferences] Error setting saved addresses:', err);
  }
}

export async function fetchSavedAddresses(userId?: string): Promise<SavedAddress[]> {
  const localList = getLocalSavedAddresses();
  if (!userId) return localList;

  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.savedAddresses) && data.savedAddresses.length > 0) {
        // Merge with local if appropriate
        setLocalSavedAddresses(data.savedAddresses);
        return data.savedAddresses;
      }
    }
  } catch (err) {
    console.warn('[customerPreferences] Firestore fetch savedAddresses failed, fallback to local:', err);
  }
  return localList;
}

export async function saveCustomerAddress(
  addressData: Omit<SavedAddress, 'id' | 'createdAt'> & { id?: string },
  userId?: string
): Promise<SavedAddress> {
  const current = getLocalSavedAddresses();
  const addressId = addressData.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullAddress: SavedAddress = {
    ...addressData,
    id: addressId,
    createdAt: Date.now(),
  };

  const existingIdx = current.findIndex(a => a.id === addressId);
  let updated: SavedAddress[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = fullAddress;
  } else {
    updated = [fullAddress, ...current];
  }

  setLocalSavedAddresses(updated);

  if (userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { savedAddresses: updated }, { merge: true });
    } catch (err) {
      console.warn('[customerPreferences] Firestore sync savedAddress failed:', err);
    }
  }

  return fullAddress;
}

export async function removeCustomerAddress(id: string, userId?: string): Promise<void> {
  const current = getLocalSavedAddresses();
  const updated = current.filter(a => a.id !== id);
  setLocalSavedAddresses(updated);

  if (userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { savedAddresses: updated }, { merge: true });
    } catch (err) {
      console.warn('[customerPreferences] Firestore sync removeCustomerAddress failed:', err);
    }
  }
}

// --- FAVORITE DRIVERS STORAGE ---

export function getLocalFavoriteDrivers(): FavoriteDriver[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITE_DRIVERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[customerPreferences] Error reading favorite drivers:', err);
    return [];
  }
}

export function setLocalFavoriteDrivers(drivers: FavoriteDriver[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITE_DRIVERS, JSON.stringify(drivers));
    window.dispatchEvent(new CustomEvent('paporide_drivers_updated', { detail: drivers }));
  } catch (err) {
    console.warn('[customerPreferences] Error setting favorite drivers:', err);
  }
}

export async function fetchFavoriteDrivers(userId?: string): Promise<FavoriteDriver[]> {
  const localList = getLocalFavoriteDrivers();
  if (!userId) return localList;

  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.favoriteDrivers) && data.favoriteDrivers.length > 0) {
        setLocalFavoriteDrivers(data.favoriteDrivers);
        return data.favoriteDrivers;
      }
    }
  } catch (err) {
    console.warn('[customerPreferences] Firestore fetch favoriteDrivers failed, fallback to local:', err);
  }
  return localList;
}

export async function saveCustomerFavoriteDriver(
  driverData: Omit<FavoriteDriver, 'id' | 'addedAt'> & { id?: string },
  userId?: string
): Promise<FavoriteDriver> {
  const current = getLocalFavoriteDrivers();
  const driverId = driverData.id || `fav_drv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullDriver: FavoriteDriver = {
    ...driverData,
    id: driverId,
    addedAt: Date.now(),
  };

  // Check if driver already exists by id, driverId or phone
  const existingIdx = current.findIndex(
    d => d.id === driverId || (driverData.driverId && d.driverId === driverData.driverId) || (driverData.phone && d.phone === driverData.phone)
  );

  let updated: FavoriteDriver[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...fullDriver };
  } else {
    updated = [fullDriver, ...current];
  }

  setLocalFavoriteDrivers(updated);

  if (userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { favoriteDrivers: updated }, { merge: true });
    } catch (err) {
      console.warn('[customerPreferences] Firestore sync saveCustomerFavoriteDriver failed:', err);
    }
  }

  return fullDriver;
}

export async function removeCustomerFavoriteDriver(id: string, userId?: string): Promise<void> {
  const current = getLocalFavoriteDrivers();
  const updated = current.filter(d => d.id !== id && d.driverId !== id);
  setLocalFavoriteDrivers(updated);

  if (userId) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { favoriteDrivers: updated }, { merge: true });
    } catch (err) {
      console.warn('[customerPreferences] Firestore sync removeCustomerFavoriteDriver failed:', err);
    }
  }
}

export function isDriverInFavorites(identifier: string | undefined, driversList: FavoriteDriver[]): boolean {
  if (!identifier) return false;
  return driversList.some(d => d.id === identifier || d.driverId === identifier || d.phone === identifier);
}
