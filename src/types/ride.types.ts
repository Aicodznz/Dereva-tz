import { Timestamp } from 'firebase/firestore';

export type RideStatus = 'pending' | 'accepted' | 'driver_arriving' | 'on_trip' | 'completed' | 'rated';

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

export interface Ride {
  id?: string;
  rideId?: string; // Duplicate for internal tracking if needed
  status: RideStatus;
  customerId: string;
  driverId: string | null;
  pickup: LocationInfo;
  destination: LocationInfo;
  vehicleType: 'mini' | 'bajaj' | 'bike';
  fare: number;
  routeCoords: [number, number][]; // OSRM coords
  driverLocation?: { lat: number; lng: number };
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
