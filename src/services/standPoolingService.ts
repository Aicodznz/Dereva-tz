import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  runTransaction, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

export type StandPricingModel = 'custom_fixed' | 'system_km';
export type StandRouteStatus = 'boarding' | 'full' | 'started' | 'completed' | 'cancelled';
export type StandDepartureEstimate = 'when_full' | 'in_5_min' | 'in_10_min' | 'in_15_min';

export interface StandLocation {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface StandPassenger {
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  seats: number;
  fare: number;
  status: 'booked' | 'boarded' | 'dropped_off' | 'cancelled';
  bookedAt: string;
}

export interface StandPoolingRoute {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  driverPhoto?: string;
  driverRating?: number;
  isVerifiedDriver?: boolean;
  vehicleType: 'boda' | 'bajaj' | 'mini';
  vehiclePlate?: string;
  vehicleModel?: string;
  isActive: boolean;
  standLocation: StandLocation;
  destination: StandLocation;
  pricingModel: StandPricingModel;
  fixedPricePerSeat: number;
  systemFarePerSeat: number;
  totalSeats: number;
  availableSeats: number;
  occupiedSeats: number;
  passengers: StandPassenger[];
  status: StandRouteStatus;
  departureEstimate?: StandDepartureEstimate;
  departureTimeText?: string;
  departureTargetTimestamp?: number;
  driverLocation?: { lat: number; lng: number; heading?: number; updatedAt?: any };
  routeCoords?: [number, number][];
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Popular transit hubs & stands in Dar es Salaam for quick one-click selection
export const POPULAR_STANDS: StandLocation[] = [
  { name: 'Mwenge Kituo Kikuu', lat: -6.7725, lng: 39.2241, address: 'Mwenge Stand, Dar es Salaam' },
  { name: 'Makumbusho Stand', lat: -6.7820, lng: 39.2515, address: 'Makumbusho Bus Terminal' },
  { name: 'Kariakoo (Gerezani)', lat: -6.8208, lng: 39.2789, address: 'Kariakoo Market / Gerezani' },
  { name: 'Ubungo (Maji/Shekilango)', lat: -6.7933, lng: 39.2131, address: 'Ubungo Stand, Morogoro Rd' },
  { name: 'Mbezi Luis Terminal', lat: -6.7785, lng: 39.1228, address: 'Mbezi Luis Magufuli Bus Terminal' },
  { name: 'Kimara Mwisho', lat: -6.7882, lng: 39.1678, address: 'Kimara Stand, Dar es Salaam' },
  { name: 'Tegeta Nyuki / Kibaoni', lat: -6.6713, lng: 39.1912, address: 'Tegeta Stand, Bagamoyo Rd' },
  { name: 'Sinza Madukani', lat: -6.7845, lng: 39.2312, address: 'Sinza Madukani Kijiweni' },
  { name: 'Posta Mpya / Kivukoni', lat: -6.8162, lng: 39.2934, address: 'Posta Mpya & Ferry Terminal' },
  { name: 'Morocco BRT Stand', lat: -6.7842, lng: 39.2612, address: 'Morocco Junction, Kinondoni' },
  { name: 'Mbagala Rangi Tatu', lat: -6.9152, lng: 39.2731, address: 'Mbagala Rangi Tatu Terminal' },
  { name: 'Tazara / Vingunguti', lat: -6.8375, lng: 39.2395, address: 'Tazara Junction, Nyerere Rd' },
];

export const POPULAR_DESTINATIONS: StandLocation[] = [
  { name: 'Tegeta Nyuki', lat: -6.6713, lng: 39.1912, address: 'Tegeta' },
  { name: 'Posta Mpya', lat: -6.8162, lng: 39.2934, address: 'Posta CBD' },
  { name: 'Kariakoo', lat: -6.8208, lng: 39.2789, address: 'Kariakoo Market' },
  { name: 'Mbezi Luis', lat: -6.7785, lng: 39.1228, address: 'Mbezi Luis Terminal' },
  { name: 'Mwenge', lat: -6.7725, lng: 39.2241, address: 'Mwenge Hub' },
  { name: 'Kimara', lat: -6.7882, lng: 39.1678, address: 'Kimara Korogwe' },
  { name: 'Kawe Mzimuni', lat: -6.7321, lng: 39.2291, address: 'Kawe Roundabout' },
  { name: 'Masaki / Slipway', lat: -6.7533, lng: 39.2780, address: 'Masaki Peninsula' },
  { name: 'Ubungo', lat: -6.7933, lng: 39.2131, address: 'Ubungo' },
  { name: 'Sinza', lat: -6.7845, lng: 39.2312, address: 'Sinza Makaburini' },
  { name: 'Mikocheni', lat: -6.7640, lng: 39.2480, address: 'Mikocheni B' },
  { name: 'Mbagala', lat: -6.9152, lng: 39.2731, address: 'Mbagala' }
];

/**
 * Calculates physical haversine distance in kilometers between two GPS coordinates
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Calculates system km fare for a seat in PapoShare Stendi
 * Standard affordable per-seat formula for Bajaji & Mini
 */
export function calculateStandSystemKmFare(distanceKm: number, vehicleType: 'boda' | 'bajaj' | 'mini'): number {
  const dist = Math.max(1, distanceKm);
  if (vehicleType === 'boda') {
    // Boda base per seat: 1,000 + 350 per km rounded to nearest 500
    const raw = 1000 + dist * 350;
    return Math.max(1000, Math.round(raw / 500) * 500);
  } else if (vehicleType === 'bajaj') {
    // Base per seat: 1,000 + 400 per km rounded to nearest 500
    const raw = 1000 + dist * 420;
    return Math.max(1000, Math.round(raw / 500) * 500);
  } else {
    // Mini Car base per seat: 1,500 + 600 per km rounded to nearest 500
    const raw = 1500 + dist * 650;
    return Math.max(1500, Math.round(raw / 500) * 500);
  }
}

/**
 * Smart route matcher: checks if passenger's trip aligns with driver's route
 * Mwenge -> Tegeta matches passenger Mwenge -> Kawe or Mwenge -> Tegeta.
 * Mwenge -> Mbezi does NOT match passenger Mwenge -> Kariakoo.
 */
export function matchRiderToStandRoute(
  driverRoute: StandPoolingRoute,
  riderPickup: { lat: number; lng: number },
  riderDropoff: { lat: number; lng: number }
): {
  isMatch: boolean;
  distanceToStandKm: number;
  riderTripKm: number;
  calculatedPrice: number;
  matchScore: number;
} {
  const standLat = driverRoute.standLocation.lat;
  const standLng = driverRoute.standLocation.lng;
  const destLat = driverRoute.destination.lat;
  const destLng = driverRoute.destination.lng;

  // 1. Proximity of rider's pickup to the driver's stand
  const distanceToStandKm = getDistanceKm(riderPickup.lat, riderPickup.lng, standLat, standLng);

  // If rider is too far away from the stand (more than 4.5km), no practical stand walk/pickup match
  if (distanceToStandKm > 4.5) {
    return { isMatch: false, distanceToStandKm, riderTripKm: 0, calculatedPrice: 0, matchScore: 0 };
  }

  // 2. Total driver journey distance
  const driverTotalKm = getDistanceKm(standLat, standLng, destLat, destLng);
  const riderTripKm = getDistanceKm(riderPickup.lat, riderPickup.lng, riderDropoff.lat, riderDropoff.lng);

  // 3. Directional alignment check (dot product / angle vector)
  const driverVecX = destLng - standLng;
  const driverVecY = destLat - standLat;

  const riderVecX = riderDropoff.lng - riderPickup.lng;
  const riderVecY = riderDropoff.lat - riderPickup.lat;

  // Angle check: driver heading vs rider heading
  const dot = driverVecX * riderVecX + driverVecY * riderVecY;
  const magDriver = Math.sqrt(driverVecX * driverVecX + driverVecY * driverVecY);
  const magRider = Math.sqrt(riderVecX * riderVecX + riderVecY * riderVecY);

  let angleCos = 1;
  if (magDriver > 0.001 && magRider > 0.001) {
    angleCos = dot / (magDriver * magRider);
  }

  // 4. Proximity of rider dropoff to driver's destination or route
  const dropoffToDriverDestKm = getDistanceKm(riderDropoff.lat, riderDropoff.lng, destLat, destLng);

  // Match condition:
  // Either dropoff is near driver destination (within 3km) OR rider dropoff is strictly between stand and dest in direction
  const isDirectMatch = dropoffToDriverDestKm <= 3.5;
  const isAlongTheWay = (distanceToStandKm + dropoffToDriverDestKm) <= (driverTotalKm + 3.0) && angleCos >= -0.2;

  const isMatch = (isDirectMatch || isAlongTheWay) && (driverRoute.availableSeats > 0);

  // Calculate price for this rider
  let calculatedPrice = 0;
  if (driverRoute.pricingModel === 'custom_fixed') {
    calculatedPrice = driverRoute.fixedPricePerSeat;
  } else {
    calculatedPrice = calculateStandSystemKmFare(riderTripKm, driverRoute.vehicleType);
  }

  // Score: higher score = closer stand pickup and more seats available
  const matchScore = Math.max(0, 100 - (distanceToStandKm * 15) - (dropoffToDriverDestKm * 5));

  return {
    isMatch,
    distanceToStandKm,
    riderTripKm,
    calculatedPrice,
    matchScore
  };
}

/**
 * Creates or updates a Stand Pooling route for a driver in Firestore
 */
export async function createOrUpdateStandRoute(
  driverId: string, 
  routeData: Partial<StandPoolingRoute>
): Promise<string> {
  const routeRef = doc(db, 'stand_pooling_routes', driverId);
  const existingSnap = await getDoc(routeRef);

  const payload: any = {
    ...routeData,
    driverId,
    updatedAt: serverTimestamp(),
  };

  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp();
    payload.occupiedSeats = 0;
    payload.passengers = [];
  }

  await setDoc(routeRef, payload, { merge: true });
  return driverId;
}

/**
 * Real-time listener for all active stand routes currently boarding or full
 */
export function listenActiveStandRoutes(
  callback: (routes: StandPoolingRoute[]) => void
): () => void {
  const routesQuery = query(
    collection(db, 'stand_pooling_routes'),
    where('isActive', '==', true)
  );

  return onSnapshot(routesQuery, (snapshot) => {
    const list: StandPoolingRoute[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as StandPoolingRoute;
      data.id = d.id;
      list.push(data);
    });
    callback(list);
  }, (err) => {
    console.warn("Stand routes snapshot error (offline or rules):", err);
    callback([]);
  });
}

/**
 * Real-time listener for a specific driver's active stand route
 */
export function listenDriverActiveStandRoute(
  driverId: string,
  callback: (route: StandPoolingRoute | null) => void
): () => void {
  const routeRef = doc(db, 'stand_pooling_routes', driverId);
  return onSnapshot(routeRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as StandPoolingRoute;
      data.id = docSnap.id;
      callback(data);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn("Driver stand route listener error:", err);
    callback(null);
  });
}

/**
 * Reserves seat(s) using a strict Firestore transaction to prevent double booking
 */
export async function reserveStandSeatTransaction(
  routeId: string,
  passenger: StandPassenger
): Promise<{ success: boolean; message: string; remainingSeats?: number }> {
  const routeRef = doc(db, 'stand_pooling_routes', routeId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const routeSnap = await transaction.get(routeRef);
      if (!routeSnap.exists()) {
        throw new Error("Safari hii haikupatikana tena.");
      }

      const routeData = routeSnap.data() as StandPoolingRoute;

      if (!routeData.isActive) {
        throw new Error("Safari hii haiko hewani kwa sasa.");
      }

      if (routeData.status === 'started' || routeData.status === 'completed' || routeData.status === 'cancelled') {
        throw new Error(`Safari tayari imesha ${routeData.status === 'started' ? 'ondoka' : 'fungwa'}.`);
      }

      const requestedSeats = passenger.seats || 1;
      const currentAvailable = Number(routeData.availableSeats) || 0;

      if (currentAvailable < requestedSeats) {
        throw new Error("Samahani, kiti hiki kimechukuliwa. Tafadhali chagua safari nyingine.");
      }

      const newAvailable = currentAvailable - requestedSeats;
      const newOccupied = (Number(routeData.occupiedSeats) || 0) + requestedSeats;
      const updatedPassengers = [...(routeData.passengers || []), passenger];
      const newStatus = newAvailable === 0 ? 'full' : 'boarding';

      transaction.update(routeRef, {
        availableSeats: newAvailable,
        occupiedSeats: newOccupied,
        passengers: updatedPassengers,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: `Kiti kimethibitishwa kikamilifu! Viti vilivyobaki: ${newAvailable}`,
        remainingSeats: newAvailable,
      };
    });

    return result;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Imeshindikana kuhifadhi kiti. Tafadhali jaribu tena.",
    };
  }
}

/**
 * Driver updates trip status: 'boarding' | 'started' | 'completed' | 'cancelled'
 */
export async function updateStandRouteStatus(
  routeId: string,
  status: StandRouteStatus,
  extraData?: Partial<StandPoolingRoute>
): Promise<void> {
  const routeRef = doc(db, 'stand_pooling_routes', routeId);
  const payload: any = {
    status,
    updatedAt: serverTimestamp(),
    ...(extraData || {}),
  };

  if (status === 'completed' || status === 'cancelled') {
    payload.isActive = false;
  } else if (status === 'boarding') {
    payload.isActive = true;
  }

  await updateDoc(routeRef, payload);
}

/**
 * Cancels or frees up a passenger's seat
 */
export async function cancelStandPassengerSeat(
  routeId: string,
  passengerId: string
): Promise<void> {
  const routeRef = doc(db, 'stand_pooling_routes', routeId);

  await runTransaction(db, async (transaction) => {
    const routeSnap = await transaction.get(routeRef);
    if (!routeSnap.exists()) return;

    const data = routeSnap.data() as StandPoolingRoute;
    const currentPassengers = data.passengers || [];
    const target = currentPassengers.find((p) => p.passengerId === passengerId && p.status === 'booked');

    if (!target) return;

    const seatsFreed = target.seats || 1;
    const newPassengers = currentPassengers.map((p) => {
      if (p.passengerId === passengerId && p.status === 'booked') {
        return { ...p, status: 'cancelled' as const };
      }
      return p;
    });

    const newAvailable = Math.min(data.totalSeats, (data.availableSeats || 0) + seatsFreed);
    const newOccupied = Math.max(0, (data.occupiedSeats || 0) - seatsFreed);

    transaction.update(routeRef, {
      passengers: newPassengers,
      availableSeats: newAvailable,
      occupiedSeats: newOccupied,
      status: newAvailable > 0 ? 'boarding' : data.status,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Driver updates live GPS location on stand route
 */
export async function updateStandDriverLocation(
  driverId: string,
  location: { lat: number; lng: number; heading?: number }
): Promise<void> {
  const routeRef = doc(db, 'stand_pooling_routes', driverId);
  try {
    await updateDoc(routeRef, {
      driverLocation: {
        lat: location.lat,
        lng: location.lng,
        heading: location.heading ?? 0,
        timestamp: new Date().toISOString()
      },
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    // Non-critical, ignore if route closed
  }
}

/**
 * Real-time listener for the passenger/rider's active stand pooling trip
 */
export function listenRiderActiveStandRoute(
  userId: string | null | undefined,
  callback: (route: StandPoolingRoute | null, passenger: StandPassenger | null) => void
): () => void {
  let savedTripMeta: { routeId: string; passengerId: string } | null = null;
  try {
    const raw = localStorage.getItem('papo_active_stand_trip');
    if (raw) savedTripMeta = JSON.parse(raw);
  } catch (e) {
    console.warn("Error reading papo_active_stand_trip", e);
  }

  // If we have a saved route ID, listen to that route document directly for zero latency
  if (savedTripMeta?.routeId) {
    const routeRef = doc(db, 'stand_pooling_routes', savedTripMeta.routeId);
    const unsubDoc = onSnapshot(routeRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as StandPoolingRoute;
        data.id = docSnap.id;

        const pass = (data.passengers || []).find(
          (p) =>
            (savedTripMeta && p.passengerId === savedTripMeta.passengerId) ||
            (userId && p.passengerId === userId)
        );

        if (data.isActive && ['boarding', 'full', 'started'].includes(data.status) && pass && pass.status === 'booked') {
          callback(data, pass);
          return;
        } else if (data.status === 'completed' && pass) {
          callback(data, pass);
          return;
        }
      }

      // If no longer valid or cancelled, remove cached entry
      try {
        localStorage.removeItem('papo_active_stand_trip');
      } catch {}
      callback(null, null);
    }, (err) => {
      console.warn("Error listening to saved stand route", err);
      callback(null, null);
    });

    return unsubDoc;
  }

  // Fallback: query active routes if no local storage or user opened app elsewhere
  const q = query(
    collection(db, 'stand_pooling_routes'),
    where('isActive', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    let matchedRoute: StandPoolingRoute | null = null;
    let matchedPassenger: StandPassenger | null = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as StandPoolingRoute;
      data.id = docSnap.id;
      if (['boarding', 'full', 'started'].includes(data.status)) {
        const pass = (data.passengers || []).find(
          (p) => userId && p.passengerId === userId && p.status === 'booked'
        );
        if (pass) {
          matchedRoute = data;
          matchedPassenger = pass;
        }
      }
    });

    if (matchedRoute && matchedPassenger) {
      try {
        localStorage.setItem(
          'papo_active_stand_trip',
          JSON.stringify({
            routeId: (matchedRoute as StandPoolingRoute).id,
            passengerId: (matchedPassenger as StandPassenger).passengerId
          })
        );
      } catch {}
    }

    callback(matchedRoute, matchedPassenger);
  }, (err) => {
    console.warn("Error querying active stand routes for rider", err);
    callback(null, null);
  });
}
