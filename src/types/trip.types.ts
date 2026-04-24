import { FieldValue, Timestamp } from 'firebase/firestore';

export type RideStatus = 'pending' | 'accepted' | 'driver_arrived' | 'on_trip' | 'completed' | 'cancelled';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TripLocation extends LatLng {
  address: string;
}

export interface DriverInfo {
  name: string;
  phone: string;
  photo: string;
  vehicle: {
    model: string;
    plate: string;
    color: string;
  };
  rating: number;
  id: string;
}

export interface Ride {
  id: string;
  status: RideStatus;
  customerId: string;
  driverId?: string;
  pickup: TripLocation;
  destination: TripLocation;
  vehicleType: 'mini' | 'bajaj' | 'bike';
  fare: number;
  routeCoords?: LatLng[];
  driverLocation?: LatLng;
  driverInfo?: DriverInfo;
  createdAt: Timestamp | FieldValue;
  expiresAt: Timestamp | FieldValue;
  acceptedAt?: Timestamp | FieldValue;
  arrivedAt?: Timestamp | FieldValue;
  startedAt?: Timestamp | FieldValue;
  completedAt?: Timestamp | FieldValue;
  rating?: number;
  feedback?: string[];
  rated?: boolean;
}
