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
  driverRegVehicle?: string;
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
  balance?: number;
  licenseNumber?: string;
  licenseExpiry?: string;
  nidaNumber?: string;
  licenseFrontUrl?: string;
  licenseBackUrl?: string;
  nidaUrl?: string;
  licenseStatus?: string;
  nidaStatus?: string;
  subscription?: {
    planId: string;
    planName: string;
    expiresAt: string | null;
    status: 'active' | 'inactive';
  };
  saccoGroup?: {
    groupId: string;
    groupName: string;
    branchName?: string;
    role: 'leader' | 'member' | 'treasurer';
    membersCount: number;
    poolBalance: number;
    guaranteeLimit: number;
    joinedAt: string;
    code: string;
  };
  aiCreditScore?: {
    score: number;
    tier: 'Bronze Rookie' | 'Silver Active' | 'Gold Champion' | 'Platinum Legend';
    overdraftLimit: number;
    usedOverdraft: number;
    completedTrips: number;
    acceptanceRate: number;
    customerRating: number;
    repaymentRate: number;
    enabled: boolean;
  };
  registrationDocs?: {
    license_front?: string | boolean;
    license_back?: string | boolean;
    national_id?: string | boolean;
  };
  vehiclePhotos?: {
    vehicle_front?: string | boolean;
    vehicle_side?: string | boolean;
  };
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
}

export type VendorCategory = 'pharmacy' | 'grocery' | 'restaurant' | 'parcel' | 'taxi' | 'car_rental' | 'car_sale' | 'salon' | 'hotel' | 'ecommerce' | 'bus_ticket' | 'handyman' | 'home_services';
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

  // WhatsApp Automation & Kitchen settings
  kitchenWhatsappPhone?: string;
  managerWhatsappPhone?: string;
  autoSendKitchenWhatsapp?: boolean;

  // Digital Loyalty Stamps & Rewards settings
  loyaltyProgram?: {
    enabled: boolean;
    programType: 'stamps' | 'points';
    stampsRequired: number; // e.g. 5
    rewardDescription: string; // e.g. "Chakula cha 6 Bure!"
    pointsPer1000Tzs: number; // e.g. 10 points
    pointValueTzs: number; // 1 point = 1 TZS
    minRedeemPoints?: number;
  };
}

export interface Product {
  id?: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
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
  // Meta MCP Promotion & Catalog Integration
  metaMcpPromo?: boolean;
  metaCatalogSynced?: boolean;
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
  discountAmount?: number;
  couponCode?: string;
  originalSubtotal?: number;
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

export type WaiterCallType = 'waiter' | 'bill' | 'water' | 'napkins' | 'clean' | 'custom';
export type WaiterCallStatus = 'pending' | 'attending' | 'completed' | 'cancelled';

export interface WaiterCall {
  id?: string;
  vendorId: string;
  tableNumber: string;
  requestType: WaiterCallType;
  customNote?: string;
  status: WaiterCallStatus;
  customerName?: string;
  customerPhone?: string;
  clientTimestamp?: number;
  createdAt: any;
  updatedAt?: any;
  attendedBy?: string;
  resolvedAt?: any;
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
  isHappyHour?: boolean;
  happyHourStart?: string; // e.g. "16:00"
  happyHourEnd?: string;   // e.g. "20:00"
  activeDays?: string[];   // e.g. ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  isTableOnly?: boolean;   // true for table QR scan orders only
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

export interface CustomerLoyaltyCard {
  id?: string;
  vendorId: string;
  customerPhone: string;
  customerName?: string;
  currentStamps: number; // e.g. 3 out of 5
  totalStampsEarned: number;
  availableRewards: number; // unredeemed completed cards
  currentPoints: number;
  totalPointsEarned: number;
  redeemedRewardsCount: number;
  lastOrderDate?: any;
  createdAt: any;
  updatedAt?: any;
}

export interface AiSalesInsightReport {
  executiveSummary: string;
  salesHealthScore: number; // 0-100
  topPerformers: { name: string; salesCount: number; revenue: number; insight: string }[];
  slowMovers: { name: string; suggestion: string }[];
  cogsAndProfitAnalysis: {
    estimatedRevenue: number;
    estimatedCogs: number;
    grossProfitMarginPercent: number;
    profitAdvice: string;
  };
  inventoryForecast: {
    ingredientOrItem: string;
    action: 'increase_stock' | 'reduce_stock' | 'maintain';
    quantityRecommendation: string;
    reasoning: string;
  }[];
  peakHoursAdvice: string;
  marketingActionTips: string[];
  generatedAt: string;
}

export interface ThermalPrintOptions {
  paperWidth: '58mm' | '80mm';
  printMode: 'customer_bill' | 'kitchen_kot' | 'compact_receipt';
  showQrCode: boolean;
  showBarCode?: boolean;
  customHeader?: string;
  customFooter?: string;
}
