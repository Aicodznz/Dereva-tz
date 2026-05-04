export type UserRole = 'customer' | 'vendor' | 'rider' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName: string;
  photoURL: string;
  role: UserRole;
  phoneNumber?: string;
  address?: string;
  createdAt: any;
  approvalStatus?: 'pending' | 'approved' | 'suspended';
  status?: string;
  driverType?: 'taxi' | 'delivery';
  vehicleType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  vehicleYear?: string;
  carryingCapacity?: string;
  rating?: number;
  category?: VendorCategory;
  walletBalance?: number;
  points?: number;
}

export type VendorCategory = 'pharmacy' | 'grocery' | 'restaurant' | 'parcel' | 'taxi' | 'car_rental' | 'salon' | 'hotel' | 'ecommerce' | 'bus_ticket';
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
  bannerUrl?: string;
  phoneNumber?: string;
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
  status?: 'active' | 'out_of_stock' | 'discontinued';
  imageUrl?: string;
  imageUrls?: string[];
  unit?: string;
  vendorCategory?: VendorCategory;
  expiryDate?: string;
  medicationType?: 'otc' | 'prescription';
  variations?: { name: string; price?: number }[];
  addOns?: { name: string; price: number }[];
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'prepared' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'completed';

export interface Order {
  id?: string;
  customerId: string;
  vendorId: string;
  vendorOwnerUid?: string;
  riderId?: string;
  items: any[];
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  status: OrderStatus;
  type: VendorCategory;
  orderSource?: 'online' | 'pos';
  orderType?: 'walk_in' | 'pickup' | 'delivery';
  tableNumber?: string | null;
  customerName?: string;
  customerPhone?: string;
  prescriptionUrl?: string;
  deliveryAddress: string;
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  createdAt: any;
  updatedAt: any;
}

export interface RiderProfile {
  uid: string;
  vehicleDetails: string;
  status: 'available' | 'busy' | 'offline';
  approvalStatus: 'pending' | 'approved' | 'suspended';
  currentPosition?: { lat: number; lng: number };
  rating: number;
}

export interface DiningTable {
  id: string;
  vendorId: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  qrCodeUrl?: string;
}

export interface Coupon {
  id: string;
  vendorId: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  expiryDate: any;
  status: 'active' | 'expired' | 'disabled';
  usageLimit?: number;
  usageCount: number;
}
