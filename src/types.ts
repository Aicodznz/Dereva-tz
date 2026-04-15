export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  phoneNumber?: string;
  address?: string;
  createdAt: any;
}

export type VendorCategory = 'pharmacy' | 'grocery' | 'restaurant' | 'parcel' | 'taxi' | 'car_rental' | 'salon' | 'hotel' | 'ecommerce';
export type VendorStatus = 'pending' | 'active' | 'suspended';

export interface VendorProfile {
  id?: string;
  ownerUid: string;
  businessName: string;
  category: VendorCategory;
  description: string;
  tin: string;
  address: string;
  location?: { lat: number; lng: number };
  deliveryRadius: number;
  status: VendorStatus;
  logoUrl?: string;
  operatingHours: string;
  rating: number;
  createdAt: any;
}

export interface Product {
  id?: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl?: string;
  unit?: string;
  expiryDate?: string;
  medicationType?: 'otc' | 'prescription';
  variations?: any[];
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface Order {
  id?: string;
  customerId: string;
  vendorId: string;
  riderId?: string;
  items: any[];
  totalAmount: number;
  status: OrderStatus;
  type: VendorCategory;
  prescriptionUrl?: string;
  deliveryAddress: string;
  createdAt: any;
  updatedAt: any;
}

export interface RiderProfile {
  uid: string;
  vehicleDetails: string;
  status: 'available' | 'busy' | 'offline';
  currentPosition?: { lat: number; lng: number };
  rating: number;
}
