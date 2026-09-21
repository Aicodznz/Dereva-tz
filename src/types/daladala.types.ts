export interface DaladalaStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isTerminal?: boolean;
  connections?: string[];
  zone?: string;
}

export type SeatStatus = 'available' | 'few' | 'standing' | 'full';

export interface DaladalaVehicle {
  id: string;
  plateNumber: string;
  nickname: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  capacity: number;
  seatsTaken: number;
  standingCount: number;
  seatStatus: SeatStatus;
  currentLat: number;
  currentLng: number;
  heading: number;
  speedKmH: number;
  nextStopId: string;
  nextStopName: string;
  etaMinutesToNextStop: number;
  driverName: string;
  conductorName: string;
  conductorPhone: string;
  rating: number;
  ratingCount: number;
  isOffRoute: boolean;
  offRouteReason?: string;
  lastUpdated: string;
  colorHex: string;
  vehicleModel: string;
}

export interface DaladalaRoute {
  id: string;
  routeCode: string;
  name: string;
  origin: string;
  destination: string;
  via: string;
  distanceKm: number;
  baseFareTzs: number;
  studentFareTzs: number;
  color: string;
  operatingHours: string;
  frequencyMinutes: number;
  stops: DaladalaStop[];
  pathCoordinates: [number, number][];
}

export interface TrafficReport {
  id: string;
  title: string;
  type: 'jam' | 'accident' | 'roadblock' | 'flooding' | 'police_check';
  description: string;
  locationName: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high';
  reportedAt: string;
  upvotes: number;
  affectedRoutes: string[];
}

export interface DaladalaTicket {
  id: string;
  ticketNumber: string;
  vehicleId: string;
  plateNumber: string;
  routeId: string;
  routeName: string;
  fromStop: string;
  toStop: string;
  fareTzs: number;
  passengerName: string;
  passengerPhone: string;
  paymentMethod: 'papo_wallet' | 'mpesa' | 'tigopesa' | 'airtel' | 'cash';
  paymentRef: string;
  purchasedAt: string;
  status: 'valid' | 'used' | 'expired';
  qrCodeData: string;
}

export interface AlightReminder {
  active: boolean;
  vehicleId: string;
  targetStopId: string;
  targetStopName: string;
  targetLat: number;
  targetLng: number;
  distanceRemainingM: number;
  triggered: boolean;
}

export interface FleetVehicleRecord {
  id: string;
  plateNumber: string;
  nickname: string;
  routeCode: string;
  driverName: string;
  conductorName: string;
  dailyTargetTzs: number;
  todayRevenueTzs: number;
  cashCollectedTzs: number;
  digitalCollectedTzs: number;
  fuelExpenseTzs: number;
  terminalFeeTzs: number;
  tripsCount: number;
  oilServiceKmRemaining: number;
  latraExpiryDate: string;
  insuranceExpiryDate: string;
  status: 'active' | 'in_stand' | 'maintenance' | 'offline';
}

export interface TerminalQueueInfo {
  terminalId: string;
  terminalName: string;
  lat: number;
  lng: number;
  routes: string[];
  queuedVehicles: {
    plateNumber: string;
    routeCode: string;
    destination: string;
    queuePosition: number;
    status: 'boarding' | 'next_in_line' | 'waiting';
    seatsRemaining: number;
    departureEtaMinutes: number;
  }[];
}
