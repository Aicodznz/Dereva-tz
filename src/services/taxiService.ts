import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, getDoc, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

export interface RideLocation {
  lat: number;
  lng: number;
}

export interface RideRequest {
  id?: string;
  customerId: string;
  customerName?: string;
  customerPhoto?: string;
  driverId: string | null;
  driverName?: string;
  driverPhoto?: string;
  vehicleNumber?: string;
  pickup: RideLocation;
  destination: RideLocation;
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  duration: number;
  estimatedFare: number;
  status: 'pending' | 'accepted' | 'arrived' | 'started' | 'completed' | 'cancelled';
  vehicleType: 'pikipiki' | 'bajaji' | 'gari';
  createdAt: any;
  updatedAt: any;
  paymentMethod?: 'cash' | 'mpesa' | 'wallet';
  rating?: number;
  review?: string;
}

export const taxiService = {
  // Create a new ride request
  requestRide: async (rideData: Omit<RideRequest, 'id' | 'createdAt' | 'updatedAt' | 'driverId' | 'status'>) => {
    const rideRef = collection(db, 'rides');
    const newRide = {
      ...rideData,
      driverId: null,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(rideRef, newRide);
    return { id: docRef.id, ...newRide };
  },

  // Listen for ride updates (for Customer)
  listenToRide: (rideId: string, callback: (ride: RideRequest) => void) => {
    const docRef = doc(db, 'rides', rideId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as RideRequest);
      }
    });
  },

  // Listen for nearby ride requests (for Driver)
  listenForRequests: (vehicleType: string, callback: (requests: RideRequest[]) => void) => {
    const rideRef = collection(db, 'rides');
    const q = query(
      rideRef, 
      where('status', '==', 'pending'), 
      where('vehicleType', '==', vehicleType)
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideRequest));
      callback(requests);
    });
  },

  // Driver accepts a ride
  acceptRide: async (rideId: string, driverId: string, driverInfo: { name: string, photo: string, vehicleNumber: string }) => {
    const rideRef = doc(db, 'rides', rideId);
    
    // In Firestore, we should use a transaction or simply check status before update
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) throw new Error('Ride not found');
    if (rideSnap.data().status !== 'pending') throw new Error('Ride already taken');

    await updateDoc(rideRef, {
      driverId,
      driverName: driverInfo.name,
      driverPhoto: driverInfo.photo,
      vehicleNumber: driverInfo.vehicleNumber,
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
    
    const updatedSnap = await getDoc(rideRef);
    return { id: updatedSnap.id, ...updatedSnap.data() };
  },

  // Update ride status
  updateRideStatus: async (rideId: string, status: RideRequest['status']) => {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status,
      updatedAt: serverTimestamp()
    });
    const updatedSnap = await getDoc(rideRef);
    return { id: updatedSnap.id, ...updatedSnap.data() };
  },

  // Rate a ride
  rateRide: async (rideId: string, rating: number, review: string) => {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      rating,
      review,
      updatedAt: serverTimestamp()
    });
    const updatedSnap = await getDoc(rideRef);
    return { id: updatedSnap.id, ...updatedSnap.data() };
  },

  // Update driver location (for Driver)
  updateDriverLocation: async (driverId: string, location: RideLocation, vehicleType: string, isOnline: boolean) => {
    const driverRef = doc(db, 'drivers', driverId);
    await setDoc(driverRef, {
      id: driverId,
      location,
      vehicleType,
      isOnline,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    const updatedSnap = await getDoc(driverRef);
    return { id: updatedSnap.id, ...updatedSnap.data() };
  },

  // Listen for nearby online drivers (for Customer)
  listenToNearbyDrivers: (vehicleType: string, callback: (drivers: any[]) => void) => {
    const driverRef = collection(db, 'drivers');
    const q = query(
      driverRef,
      where('isOnline', '==', true),
      where('vehicleType', '==', vehicleType)
    );

    return onSnapshot(q, (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(drivers);
    });
  }
};
