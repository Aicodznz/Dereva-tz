export type ParcelStatus = 
  | 'pending' 
  | 'accepted' 
  | 'at_sender' 
  | 'picked_up' 
  | 'in_transit' 
  | 'arrived_recipient' 
  | 'delivered' 
  | 'rated';

export type ParcelCategory = 
  | 'gift' 
  | 'document' 
  | 'electronics' 
  | 'package' 
  | 'medicine' 
  | 'pet_supplies'
  | 'house_shifting';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Parcel {
  id: string;
  status: ParcelStatus;
  category: ParcelCategory;
  categoryDetails: any;
  sender: {
    name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
    notes?: string;
  };
  recipient: {
    name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
    notes?: string;
  };
  partnerId: string | null;
  partnerInfo?: {
    name: string;
    plate: string;
    phone: string;
    rating: number;
  };
  pricing: {
    baseFare: number;
    distanceFare: number;
    categoryFee: number;
    total: number;
    partnerEarnings: number;
  };
  paymentMethod?: 'cash' | 'mongike' | 'lipanamba' | 'qr';
  paymentStatus?: 'unpaid' | 'pending_verification' | 'paid';
  photos: {
    pickup?: string;
    delivery?: string;
  };
  timestamps: {
    createdAt: any;
    acceptedAt?: any;
    pickedUpAt?: any;
    deliveredAt?: any;
  };
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  location: {
    lat: number;
    lng: number;
    updatedAt: any;
  };
  earnings: {
    today: number;
    week: number;
    total: number;
  };
  activeParcelIds: string[];
}
