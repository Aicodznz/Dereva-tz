import { Timestamp } from 'firebase/firestore';

export type RideStatus = 'pending' | 'accepted' | 'driver_arriving' | 'driver_arrived' | 'on_trip' | 'completed' | 'cancelled' | 'rated';

export interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
}

export interface DriverInfo {
  name: string;
  initials: string;
  plate: string;
  rating: number;
  phone: string;
  photo?: string;
}

export interface CustomerInfo {
  name: string;
  rating: number;
  avatar: string | null;
  photo?: string;
  phone?: string;
}

export interface Ride {
  id?: string;
  rideId?: string; // Duplicate for internal tracking if needed
  status: RideStatus;
  customerId: string;
  customerInfo?: CustomerInfo;
  driverId: string | null;
  pickup: LocationInfo;
  destination: LocationInfo;
  vehicleType: 'mini' | 'bajaj' | 'bike';
  fare: number;
  routeCoords: [number, number][]; // OSRM coords
  driverLocation?: { lat: number; lng: number };
  distance?: number;
  duration?: string | number;
  eta?: {
    minutes: number;
    seconds: number;
    distanceKm: number;
  };
  createdAt: Timestamp | any;
  acceptedAt: Timestamp | any | null;
  completedAt: Timestamp | any | null;
  driverInfo: DriverInfo | null;
  paymentId?: string;
}

export interface PaymentRecord {
  rideId: string;
  customerId: string;
  driverId: string;
  amount: number;
  method: 'mongike' | 'lipanamba' | 'qr';
  status: 'pending' | 'completed';
  createdAt: Timestamp | any;
}
