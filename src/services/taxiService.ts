import { 
  collection, addDoc, updateDoc, doc, onSnapshot, 
  query, where, serverTimestamp, getDocs, getDoc,
  Timestamp,
  GeoPoint
} from 'firebase/firestore';
import { db } from '../firebase';

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
    return await addDoc(collection(db, 'rides'), {
      ...rideData,
      driverId: null,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  // Listen for ride updates (for Customer)
  listenToRide: (rideId: string, callback: (ride: RideRequest) => void) => {
    return onSnapshot(doc(db, 'rides', rideId), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as RideRequest);
      }
    });
  },

  // Listen for nearby ride requests (for Driver)
  listenForRequests: (vehicleType: string, callback: (requests: RideRequest[]) => void) => {
    const q = query(
      collection(db, 'rides'), 
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
    const rideSnap = await getDoc(rideRef);
    
    if (!rideSnap.exists()) throw new Error('Ride not found');
    if (rideSnap.data().status !== 'pending') throw new Error('Ride already taken');

    return await updateDoc(rideRef, {
      driverId,
      driverName: driverInfo.name,
      driverPhoto: driverInfo.photo,
      vehicleNumber: driverInfo.vehicleNumber,
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
  },

  // Update ride status
  updateRideStatus: async (rideId: string, status: RideRequest['status']) => {
    return await updateDoc(doc(db, 'rides', rideId), {
      status,
      updatedAt: serverTimestamp()
    });
  },

  // Rate a ride
  rateRide: async (rideId: string, rating: number, review: string) => {
    return await updateDoc(doc(db, 'rides', rideId), {
      rating,
      review,
      updatedAt: serverTimestamp()
    });
  }
};
