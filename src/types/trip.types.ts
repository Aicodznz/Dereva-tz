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
  vehicleType: 'mini' | 'bajaj' | 'bike';
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
}
