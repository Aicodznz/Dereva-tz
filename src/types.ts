export type UserRole = 'customer' | 'vendor' | 'rider' | 'driver' | 'admin';

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
  businessName?: string;
  tinNumber?: string;
  hotelDescription?: string;
  location?: { lat: number; lng: number };
  servicePreferences?: {
    gocarL?: boolean;
    gosendInstant?: boolean;
    gocarComfort?: boolean;
    gocarPrioritas?: boolean;
    gocarHemat?: boolean;
    gocarSend?: boolean;
  };
  phone?: string;
  city?: string;
  gender?: string;
  subscription?: {
    planId: string;
    planName: string;
    expiresAt: string | null;
    status: 'active' | 'inactive';
  };
  registrationDocs?: {
    license_front?: boolean;
    license_back?: boolean;
    national_id?: boolean;
  };
  vehiclePhotos?: {
    vehicle_front?: boolean;
    vehicle_side?: boolean;
  };
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
}

export type VendorCategory = 'pharmacy' | 'grocery' | 'restaurant' | 'parcel' | 'taxi' | 'car_rental' | 'car_sale' | 'salon' | 'hotel' | 'ecommerce' | 'bus_ticket';
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
  ratingCount?: number;
  distance?: string;
  hideProducts?: boolean;
  socialLinks?: {
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    website?: string;
  };
  deliveryFees?: Record<string, number>;
  orderInstructions?: string;
  createdAt: any;
  
  // Hotel specific fields
  hotelCategory?: 'Hotel' | 'Lodge' | 'Guest House' | 'Resort' | 'Apartment' | 'Hostel' | 'Villa';
  hotelStatus?: 'Available' | 'Fully Booked' | 'Under Maintenance';
  galleryPhotos?: string[];
  amenities?: string[];
  numberOfRooms?: number;
  roomPricing?: {
    single?: number;
    double?: number;
    vip?: number;
  };
  ownerInfo?: {
    firstName: string;
    lastName: string;
    phone: string;
    whatsapp?: string;
    email: string;
    nationalId?: string;
  };
  businessDocs?: {
    tinNumber: string;
    licenseUrl: string;
    taxCertUrl?: string;
    verificationDocs?: string[];
  };
  country?: string;
  city?: string;
  ticketConfig?: {
    bgPreset: string;
    primaryColor?: string;
    secondaryColor?: string;
    watermarkIcon?: 'none' | 'bus' | 'shield' | 'ticket' | 'star' | 'globe' | string;
    rulesText?: string;
  };
  
  // AR / Map Setup fields
  arDirections?: string;
  arIcon?: string;
  arColor?: string;
  arImageUrl?: string;
}

export interface Product {
  id?: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  category: string;
  stock: number;
  status?: 'active' | 'out_of_stock' | 'discontinued';
  hidden?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  unit?: string;
  vendorCategory?: VendorCategory;
  expiryDate?: string;
  medicationType?: 'otc' | 'prescription';
  variations?: { name: string; price?: number }[];
  addOns?: { name: string; price: number }[];
  branchId?: string;
  rating?: number;
  ratingCount?: number;
  model3dUrl?: string;
  // Hotel specific
  capacity?: number;
  roomAmenities?: string;
  amenities?: string[];
  isCleaning?: boolean;
  highlights?: string[];
  story?: string;
  qualityPromise?: {
    description: string;
    certifiedBy?: string;
  };
  // Car Rental & Car Sale specific
  carType?: string;
  transmission?: string;
  fuel?: string;
  seats?: number;
  engine?: string;
  ac?: boolean;
  carNumber?: string;
  features?: string[];
  year?: number | string;
  mileage?: number;
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
  branchId?: string;
  status: OrderStatus;
  type: VendorCategory;
  orderSource?: 'online' | 'pos' | 'reception';
  orderType?: 'walk_in' | 'pickup' | 'delivery' | 'booking';
  tableNumber?: string | null;
  peopleCount?: number;
  customerName?: string;
  customerPhone?: string;
  prescriptionUrl?: string;
  deliveryAddress?: string;
  customerLocation?: { lat: number; lng: number } | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  deliveryFee?: number;
  riderAssignmentType?: 'app' | 'vendor' | 'platform' | 'self';
  riderName?: string;
  riderPhone?: string;
  prepTime?: string;
  arrivalTime?: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  billRequested?: boolean;
  createdAt: any;
  updatedAt: any;
  // Hotel specific
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  numberOfNights?: number;
  guestIdType?: string;
  guestIdNumber?: string;
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
  allowSharing?: boolean;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  qrCodeUrl?: string;
}

export interface Coupon {
  id: string;
  vendorId: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  productId?: string;
  expiryDate: any;
  status: 'active' | 'expired' | 'disabled';
  usageLimit?: number;
  usageCount: number;
  createdAt?: any;
  createdBy: 'admin' | 'vendor';
}

export interface ReviewReply {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  createdAt: any;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  targetId: string;
  targetType: 'vendor' | 'product';
  rating: number;
  comment: string;
  images: string[];
  likes?: string[];
  replies?: ReviewReply[];
  createdAt: any;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  createdAt: any;
}
