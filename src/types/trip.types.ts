export type RideStatus = 'pending' | 'accepted' | 'driver_arriving' | 'driver_arrived' | 'on_trip' | 'completed' | 'cancelled' | 'rated';

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
  vehicleType: string;
  fare: number;
  routeCoords?: LatLng[];
  driverLocation?: LatLng;
  driverInfo?: DriverInfo;
  createdAt: string | any;
  expiresAt: string | any;
  acceptedAt?: string | any;
  arrivedAt?: string | any;
  startedAt?: string | any;
  completedAt?: string | any;
  rating?: number;
  feedback?: string[];
  rated?: boolean;
  distance: number;
  duration: number;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: 'cash' | 'online' | 'mobile_money' | 'wallet' | 'card' | 'mpesa' | string;
  paymentDetails?: any;
  pickupNote?: string;
  stops?: Array<{ id?: string; address: string; lat?: number; lng?: number; completed?: boolean }>;
  viewers?: Record<string, number>;
  isRerouting?: boolean;
  hasDeviated?: boolean;
  navigationMessage?: string;
  shareMode?: 'solo' | 'share' | 'parcel_addon';
  allowSharingConsent?: boolean;
  womenOnlySharing?: boolean;
  verifiedOnlySharing?: boolean;
  detourMinutes?: number;
  maxDetourBudgetMinutes?: number;
  sharedSavings?: number;
  originalSoloFare?: number;
  sharedSegmentKm?: number;
  sharedRidersCount?: number;
  sharedRiders?: any[];
  waypoints?: any[];
  poolStatus?: 'matching' | 'matched' | 'solo_fallback' | 'completed';
  parcelAddon?: any;
}
