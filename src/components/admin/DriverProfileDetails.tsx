import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, Edit, Trash2, Ban, UserCheck, ShieldAlert, FileText, 
  Car, MessageSquare, Wallet, BarChart3, Bell, Star, Clock, 
  Check, X, DollarSign, ArrowUpRight, ArrowDownLeft, Shield, MapPin, Send, MessageCircle,
  User, Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

interface UserRecord {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone?: string;
  password?: string;
  status: 'active' | 'blocked';
  approvalStatus?: 'pending' | 'approved' | 'suspended';
  driverType?: string;
  vehicleType?: string;
  vehicleColor?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  licensePlate?: string;
  balance?: number;
  totalEarnings?: number;
  currentPosition?: { lat: number; lng: number };
  heading?: number;
  speed?: number;
  battery?: number;
  networkStatus?: 'online' | 'offline';
  createdAt: any;
  photoURL?: string;
  rating?: number;
  licenseFrontUrl?: string;
  licenseBackUrl?: string;
  licenseNumber?: string;
  licenseStatus?: 'pending' | 'approved' | 'rejected' | 'not_uploaded';
  licenseExpiry?: string;
  licenseRejectionReason?: string;
  nidaUrl?: string;
  nidaNumber?: string;
  nidaStatus?: 'pending' | 'approved' | 'rejected' | 'not_uploaded';
  nidaRejectionReason?: string;
  latraUrl?: string;
  latraNumber?: string;
  latraStatus?: 'pending' | 'approved' | 'rejected' | 'not_uploaded';
  latraExpiry?: string;
  latraRejectionReason?: string;
}

interface DriverProfileDetailsProps {
  driver: UserRecord;
  onBack: () => void;
  db: any;
  driverLocations: any[];
  payouts: any[];
  trips: any[];
}

const getNormalizedCoords = (coords: any): [number, number][] => {
  if (!coords || !Array.isArray(coords)) return [];
  return coords.map((c: any) => {
    if (Array.isArray(c)) {
      return [Number(c[0]), Number(c[1])] as [number, number];
    }
    if (c && typeof c === "object") {
      const lat = c.lat !== undefined ? c.lat : c.latitude;
      const lng = c.lng !== undefined ? c.lng : c.longitude;
      if (lat !== undefined && lng !== undefined) {
        return [Number(lat), Number(lng)] as [number, number];
      }
    }
    return null;
  }).filter((c): c is [number, number] => c !== null);
};

function MapBoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      try {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        console.error("Error fitting bounds:", e);
      }
    }
  }, [points, map]);
  return null;
}

const formatDistance = (dist: any) => {
  if (dist === undefined || dist === null) return 'N/A';
  const num = Number(dist);
  if (isNaN(num)) return String(dist);
  if (num > 100) return (num / 1000).toFixed(1) + ' km';
  return num.toFixed(1) + ' km';
};

const getDocBadgeAndLabel = (status: 'pending' | 'approved' | 'rejected' | 'not_uploaded' | string) => {
  switch (status) {
    case 'approved':
      return {
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-none font-bold text-[8px] uppercase',
        label: 'Approved',
        swahiliHali: 'Hali: Imethibitishwa'
      };
    case 'rejected':
      return {
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-none font-bold text-[8px] uppercase',
        label: 'Rejected',
        swahiliHali: 'Hali: Imekataliwa'
      };
    case 'pending':
      return {
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-none font-bold text-[8px] uppercase animate-pulse',
        label: 'Pending Review',
        swahiliHali: 'Hali: Inasubiri Kukaguliwa'
      };
    case 'not_uploaded':
    default:
      return {
        badgeClass: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border-none font-bold text-[8px] uppercase',
        label: 'Not Uploaded',
        swahiliHali: 'Hali: Haijapakiwa bado'
      };
  }
};

const formatDuration = (dur: any) => {
  if (dur === undefined || dur === null) return 'N/A';
  const num = Number(dur);
  if (isNaN(num)) return String(dur);
  if (num > 120) return Math.round(num / 60) + ' min';
  return Math.round(num) + ' min';
};

const createTripMarkerIcon = (type: 'pickup' | 'destination') => {
  const color = type === 'pickup' ? '#10B981' : '#EF4444';
  const label = type === 'pickup' ? 'A' : 'B';
  return L.divIcon({
    className: 'custom-trip-marker',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-8 h-8 rounded-full opacity-30 animate-ping" style="background-color: ${color}"></div>
        <div class="absolute w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-black text-[10px] text-white shadow-lg" style="background-color: ${color}">
          ${label}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export function DriverProfileDetails({ 
  driver, 
  onBack, 
  db, 
  driverLocations, 
  payouts,
  trips
}: DriverProfileDetailsProps) {
  const [subTab, setSubTab] = useState<'profile' | 'documents' | 'vehicle' | 'trips' | 'wallet' | 'performance' | 'notifications'>('profile');
  
  // Real-time Earnings calculation
  const calculatedEarnings = React.useMemo(() => {
    if (!trips || trips.length === 0) return 0;
    return trips
      .filter((t: any) => t.status === 'completed')
      .reduce((sum: number, t: any) => sum + Number(t.price || t.fare || 0), 0);
  }, [trips]);

  const totalEarningsToDisplay = React.useMemo(() => {
    return Math.max(driver.totalEarnings || 0, calculatedEarnings);
  }, [driver.totalEarnings, calculatedEarnings]);

  // Modals & Forms States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTripForMap, setSelectedTripForMap] = useState<any | null>(null);
  const [selectedDocForViewer, setSelectedDocForViewer] = useState<'licenseFront' | 'licenseBack' | 'nida' | 'latra' | 'selfie' | null>(null);
  const [licenseViewSide, setLicenseViewSide] = useState<'front' | 'back'>('front');
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  
  // Edit Form Fields
  const [editName, setEditName] = useState(driver.displayName || '');
  const [editEmail, setEditEmail] = useState(driver.email || '');
  const [editPhone, setEditPhone] = useState(driver.phone || '');
  const [editDriverType, setEditDriverType] = useState(driver.driverType || 'taxi');
  const [editLicensePlate, setEditLicensePlate] = useState(driver.licensePlate || '');
  const [editVehicleBrand, setEditVehicleBrand] = useState(driver.vehicleBrand || '');
  const [editVehicleModel, setEditVehicleModel] = useState(driver.vehicleModel || '');
  const [editVehicleColor, setEditVehicleColor] = useState(driver.vehicleColor || '');
  const [editBalance, setEditBalance] = useState(driver.balance || 0);
  const [editTotalEarnings, setEditTotalEarnings] = useState(driver.totalEarnings || 0);

  // Status Form Fields
  const [newStatus, setNewStatus] = useState<'active' | 'blocked'>(driver.status || 'active');
  const [newApprovalStatus, setNewApprovalStatus] = useState<'pending' | 'approved' | 'suspended'>(driver.approvalStatus || 'approved');

  // Wallet Adjust Fields
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustNote, setAdjustNote] = useState<string>('');
  
  // Notification Fields
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifImportance, setNotifImportance] = useState<'normal' | 'important' | 'critical'>('normal');
  const [notifCategory, setNotifCategory] = useState<'general' | 'ride' | 'payout' | 'promotion'>('general');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // Sync state if driver changes (e.g. real-time updates)
  useEffect(() => {
    setEditName(driver.displayName || '');
    setEditEmail(driver.email || '');
    setEditPhone(driver.phone || '');
    setEditDriverType(driver.driverType || 'taxi');
    setEditLicensePlate(driver.licensePlate || '');
    setEditVehicleBrand(driver.vehicleBrand || '');
    setEditVehicleModel(driver.vehicleModel || '');
    setEditVehicleColor(driver.vehicleColor || '');
    setEditBalance(driver.balance || 0);
    setEditTotalEarnings(driver.totalEarnings || 0);
    setNewStatus(driver.status || 'active');
    setNewApprovalStatus(driver.approvalStatus || 'approved');
  }, [driver]);

  const telemetry = driverLocations.find(d => d.id === driver.id);
  const isOnline = telemetry?.networkStatus === 'online' || telemetry?.status === 'online' || telemetry?.isOnline === true;

  // Handle Edit Driver Save
  const handleSaveDriverEdit = async () => {
    try {
      const driverRef = doc(db, 'users', driver.id);
      await updateDoc(driverRef, {
        displayName: editName,
        email: editEmail,
        phone: editPhone,
        driverType: editDriverType,
        licensePlate: editLicensePlate,
        vehicleBrand: editVehicleBrand,
        vehicleModel: editVehicleModel,
        vehicleColor: editVehicleColor,
        balance: Number(editBalance),
        totalEarnings: Number(editTotalEarnings)
      });
      toast.success('Taarifa za dereva zimeboreshwa kikamilifu!');
      setIsEditModalOpen(false);
    } catch (error: any) {
      toast.error('Imeshindwa kusasisha taarifa: ' + error.message);
    }
  };

  // Handle Status Update
  const handleUpdateStatus = async () => {
    try {
      const driverRef = doc(db, 'users', driver.id);
      await updateDoc(driverRef, {
        status: newStatus,
        approvalStatus: newApprovalStatus
      });
      toast.success('Hali ya dereva imesasishwa kikamilifu!');
      setIsStatusModalOpen(false);
    } catch (error: any) {
      toast.error('Imeshindwa kusasisha hali ya dereva: ' + error.message);
    }
  };

  // Handle Document Approval
  const handleApproveDocument = async (docType: 'licenseFront' | 'licenseBack' | 'nida' | 'latra' | 'selfie') => {
    try {
      const driverRef = doc(db, 'users', driver.id);
      const updates: any = {};
      
      const isLicense = docType === 'licenseFront' || docType === 'licenseBack';
      if (isLicense) {
        updates.licenseStatus = 'approved';
        updates.licenseRejectionReason = '';
      } else if (docType === 'nida') {
        updates.nidaStatus = 'approved';
        updates.nidaRejectionReason = '';
      } else if (docType === 'latra') {
        updates.latraStatus = 'approved';
        updates.latraRejectionReason = '';
      } else if (docType === 'selfie') {
        toast.info('Picha ya wasifu haihitaji kupitishwa rasmi.');
        setSelectedDocForViewer(null);
        return;
      }

      // Compute if we can auto-approve the whole driver's status
      const currentLicenseStatus = isLicense ? 'approved' : (driver.licenseStatus || 'pending');
      const currentNidaStatus = docType === 'nida' ? 'approved' : (driver.nidaStatus || 'pending');
      
      // If both core documents are approved, automatically approve the driver and set status to active!
      if (currentLicenseStatus === 'approved' && currentNidaStatus === 'approved') {
        updates.approvalStatus = 'approved';
        updates.status = 'active';
      }

      await updateDoc(driverRef, updates);
      toast.success(`Nyaraka ya ${isLicense ? 'Leseni' : docType === 'nida' ? 'NIDA' : 'LATRA/Bima'} imethibitishwa kikamilifu!`);
      setSelectedDocForViewer(null);
    } catch (error: any) {
      toast.error('Imeshindwa kuthibitisha nyaraka: ' + error.message);
    }
  };

  // Handle Document Rejection
  const handleRejectDocument = async (docType: 'licenseFront' | 'licenseBack' | 'nida' | 'latra' | 'selfie') => {
    if (!rejectionReasonInput.trim()) {
      toast.error('Tafadhali weka sababu ya kukataa nyaraka hii.');
      return;
    }
    try {
      const driverRef = doc(db, 'users', driver.id);
      const updates: any = {};
      
      const isLicense = docType === 'licenseFront' || docType === 'licenseBack';
      if (isLicense) {
        updates.licenseStatus = 'rejected';
        updates.licenseRejectionReason = rejectionReasonInput;
      } else if (docType === 'nida') {
        updates.nidaStatus = 'rejected';
        updates.nidaRejectionReason = rejectionReasonInput;
      } else if (docType === 'latra') {
        updates.latraStatus = 'rejected';
        updates.latraRejectionReason = rejectionReasonInput;
      } else if (docType === 'selfie') {
        toast.info('Picha ya wasifu haihitaji kukataliwa rasmi.');
        setSelectedDocForViewer(null);
        return;
      }

      // Suspend driver approval status if any document is rejected
      updates.approvalStatus = 'suspended';

      await updateDoc(driverRef, updates);
      toast.success(`Nyaraka ya ${isLicense ? 'Leseni' : docType === 'nida' ? 'NIDA' : 'LATRA/Bima'} imekataliwa na dereva amesimamishwa.`);
      
      // Reset state
      setSelectedDocForViewer(null);
      setRejectionReasonInput('');
      setIsRejecting(false);
    } catch (error: any) {
      toast.error('Imeshindwa kukataa nyaraka: ' + error.message);
    }
  };

  // Handle Wallet Adjustment
  const handleAdjustBalance = async () => {
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error('Tafadhali weka kiasi sahihi cha fedha!');
      return;
    }

    try {
      const driverRef = doc(db, 'users', driver.id);
      const currentBalance = driver.balance || 0;
      const currentEarnings = driver.totalEarnings || 0;
      
      let finalBalance = currentBalance;
      let finalEarnings = currentEarnings;

      if (adjustType === 'credit') {
        finalBalance += amount;
        finalEarnings += amount; // assume manual credits add to earnings too, or just balance
      } else {
        finalBalance = Math.max(0, finalBalance - amount);
      }

      await updateDoc(driverRef, {
        balance: finalBalance,
        totalEarnings: finalEarnings
      });

      // Log transaction in payouts or system log
      await addDoc(collection(db, 'payouts'), {
        amount: amount,
        fee: 0,
        netAmount: amount,
        recipientId: driver.id,
        recipientRole: 'rider',
        method: 'Adjustment: ' + (adjustNote || 'Manual adjust'),
        status: 'processed',
        createdAt: serverTimestamp()
      });

      toast.success('Marekebisho ya mkoba yamefanyika kwa ufanisi!');
      setAdjustAmount('');
      setAdjustNote('');
    } catch (error: any) {
      toast.error('Marekebisho yamegoma: ' + error.message);
    }
  };

  // Handle Delete Driver
  const handleDeleteDriver = async () => {
    const confirmDelete = window.confirm(`Je, uko tayari KUFUTA kabisa dereva ${driver.displayName}? Kitendo hiki hakirudishwi!`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'users', driver.id));
      toast.success('Dereva amefutwa kabisa kwenye mfumo.');
      onBack();
    } catch (error: any) {
      toast.error('Imeshindwa kufuta dereva: ' + error.message);
    }
  };

  // Handle Quick Toggle Status
  const handleQuickBlockToggle = async () => {
    try {
      const driverRef = doc(db, 'users', driver.id);
      const isBlocked = driver.status === 'blocked';
      await updateDoc(driverRef, {
        status: isBlocked ? 'active' : 'blocked',
        approvalStatus: isBlocked ? 'approved' : 'suspended'
      });
      toast.success(isBlocked ? 'Dereva ameruhusiwa kuanza kazi!' : 'Dereva amezuiwa (Blocked) kufanya kazi!');
    } catch (error: any) {
      toast.error('Imeshindwa kubadili hali ya dereva: ' + error.message);
    }
  };

  // Handle Sending Notification
  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody) {
      toast.error('Tafadhali jaza kichwa na ujumbe wa arifa!');
      return;
    }

    setIsSendingNotif(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: notifTitle,
        body: notifBody,
        userId: driver.id,
        type: 'system',
        importance: notifImportance,
        category: notifCategory,
        isRead: false,
        createdAt: serverTimestamp()
      });

      toast.success('Arifa imetumwa kwa dereva kwa ufanisi!');
      setNotifTitle('');
      setNotifBody('');
    } catch (error: any) {
      toast.error('Arifa haijatumwa: ' + error.message);
    } finally {
      setIsSendingNotif(false);
    }
  };

  // Filter payouts for this specific driver
  const driverPayouts = payouts.filter(p => p.recipientId === driver.id);

  return (
    <div className="space-y-6">
      {/* Top Header with Back and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50 dark:bg-neutral-900/40 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="p-3 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-2xl transition-all"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="font-bold text-xs uppercase tracking-wider">Madereva Wote</span>
          </Button>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 hidden md:block" />
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tight text-neutral-900 dark:text-white leading-none">
              {driver.displayName}
            </h2>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
              {driver.driverType || 'TAXI'} • ID: {driver.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button 
            onClick={() => setIsEditModalOpen(true)}
            className="bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl font-bold text-[10px] h-9 px-4 uppercase flex items-center gap-2"
          >
            <Edit className="w-3.5 h-3.5" />
            Hariri Wasifu
          </Button>
          <Button 
            variant="outline" 
            onClick={handleQuickBlockToggle}
            className={`rounded-xl font-bold text-[10px] h-9 px-4 uppercase flex items-center gap-2 border-neutral-200 dark:border-neutral-700 ${driver.status === 'blocked' ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20'}`}
          >
            <Ban className="w-3.5 h-3.5" />
            {driver.status === 'blocked' ? 'Mfungulie' : 'Mzuie (Block)'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleDeleteDriver}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 rounded-xl font-bold text-[10px] h-9 px-4 uppercase flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Futa
          </Button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center overflow-x-auto gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-2xl md:rounded-[1.5rem] scrollbar-none">
        {[
          { id: 'profile', label: 'Wasifu (Profile)', icon: UserCheck },
          { id: 'documents', label: 'Nyaraka (Docs)', icon: FileText },
          { id: 'vehicle', label: 'Chombo (Vehicle)', icon: Car },
          { id: 'trips', label: 'Safari (Trips)', icon: Clock },
          { id: 'wallet', label: 'Mkoba (Wallet)', icon: Wallet },
          { id: 'performance', label: 'Utendaji (Performance)', icon: BarChart3 },
          { id: 'notifications', label: 'Arifa (Alerts)', icon: Bell }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${isActive ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Card: Driver Core Info Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white dark:bg-neutral-900">
            <div className="h-24 bg-gradient-to-r from-orange-500 to-orange-600 relative" />
            <CardContent className="p-6 pt-0 relative flex flex-col items-center text-center">
              {/* Large Avatar */}
              <div className="w-24 h-24 rounded-3xl bg-neutral-100 dark:bg-neutral-800 border-4 border-white dark:border-neutral-900 shadow-lg flex items-center justify-center font-black text-4xl text-orange-600 -mt-12 overflow-hidden">
                {driver.photoURL ? (
                  <img src={driver.photoURL} alt={driver.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  driver.displayName ? driver.displayName[0].toUpperCase() : 'D'
                )}
              </div>

              <h3 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white mt-4">
                {driver.displayName}
              </h3>
              
              <div className="flex flex-wrap gap-2 items-center justify-center mt-2">
                <Badge className={`font-black text-[8px] uppercase tracking-wider ${driver.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {driver.status === 'blocked' ? 'Blocked' : 'Active'}
                </Badge>
                <Badge className={`font-black text-[8px] uppercase tracking-wider ${driver.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : driver.approvalStatus === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {driver.approvalStatus || 'pending'}
                </Badge>
                <Badge className={`font-black text-[8px] uppercase tracking-wider ${isOnline ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>

              {/* Quick Details List */}
              <div className="w-full space-y-3 mt-6 border-t border-neutral-100 dark:border-neutral-800 pt-6 text-left font-medium text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Barua Pepe / Email</span>
                  <span className="text-neutral-800 dark:text-neutral-200 truncate max-w-[180px] font-bold">{driver.email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Namba / Phone</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-bold">{driver.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Chombo cha Kazi</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-bold uppercase italic">{driver.driverType || 'taxi'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Namba ya Gari</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-bold uppercase">{driver.licensePlate || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 uppercase tracking-wider text-[9px] font-black">Amejiunga</span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-bold">
                    {driver.createdAt ? new Date(driver.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Status Action Button */}
              <Button 
                onClick={() => setIsStatusModalOpen(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider h-11 mt-6 flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Badili Hali (Change Status)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Content tabs details */}
        <div className="lg:col-span-8">
          
          {/* PROFILE SUB-TAB */}
          {subTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              {/* Mini Stats 2x2 grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-neutral-900 p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-orange-100 dark:bg-orange-950/30 text-orange-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400">Total Trips</p>
                      <h4 className="text-xl font-black text-neutral-900 dark:text-white leading-none mt-1">
                        {trips.length}
                      </h4>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-neutral-900 p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-950/30 text-blue-600">
                      <Star className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400">Avg Rating</p>
                      <h4 className="text-xl font-black text-neutral-900 dark:text-white leading-none mt-1 flex items-center gap-1">
                        {driver.rating?.toFixed(1) || '5.0'}
                        <span className="text-xs text-neutral-400 font-bold">★</span>
                      </h4>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-neutral-900 p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400">Balance</p>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white leading-none mt-1.5 truncate">
                        {(driver.balance || 0).toLocaleString()} TZS
                      </h4>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-neutral-900 p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-violet-100 dark:bg-violet-950/30 text-violet-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-neutral-400">Total Earnings</p>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white leading-none mt-1.5 truncate">
                        {totalEarningsToDisplay.toLocaleString()} TZS
                      </h4>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Driver detailed parameters Card */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                    Taarifa Zote za Dereva
                  </CardTitle>
                  <CardDescription className="text-xs">Maelezo binafsi na sifa za kiufundi za dereva kwenye mfumo wetu.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-medium">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Jina Kamili</span>
                        <p className="text-neutral-900 dark:text-white font-bold">{driver.displayName}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Barua Pepe</span>
                        <p className="text-neutral-900 dark:text-white font-bold">{driver.email || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Namba ya Simu</span>
                        <p className="text-neutral-900 dark:text-white font-bold">{driver.phone || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Kupitishwa Mfumo (Approval)</span>
                        <Badge className={`font-black text-[9px] uppercase mt-1 ${driver.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {driver.approvalStatus || 'pending'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Chombo cha Kazi (Vehicle Category)</span>
                        <p className="text-neutral-900 dark:text-white font-bold uppercase italic">{driver.driverType || 'taxi'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Namba ya Usajili wa Chombo (Plate)</span>
                        <p className="text-neutral-900 dark:text-white font-bold uppercase">{driver.licensePlate || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Modeli na Rangi ya Gari</span>
                        <p className="text-neutral-900 dark:text-white font-bold uppercase">
                          {driver.vehicleColor ? `${driver.vehicleColor} ` : ''}
                          {driver.vehicleBrand ? `${driver.vehicleBrand} ` : ''}
                          {driver.vehicleModel ? `${driver.vehicleModel}` : ''}
                          {!driver.vehicleColor && !driver.vehicleBrand && !driver.vehicleModel && '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-400 block mb-1">Hali ya Mtandao</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-neutral-300'}`} />
                          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            {isOnline ? 'Hivi Sasa (Online)' : 'Haonekani (Offline)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* DOCUMENTS SUB-TAB */}
          {subTab === 'documents' && (() => {
            const isDelivery = driver.driverType === 'delivery';

            const docsList = [
              {
                id: 'selfie' as const,
                title: 'Picha ya Wasifu (Selfie)',
                englishTitle: 'Profile Photo (Selfie)',
                description: 'Picha ya utambulisho wa dereva inayotumika kwenye wasifu.',
                hasDoc: !!driver.photoURL,
                status: 'view_only',
                expiry: 'N/A',
                number: 'N/A',
                icon: <User className="w-5 h-5" />,
                rejectionReason: null
              },
              {
                id: 'licenseFront' as const,
                title: 'Leseni ya Udereva (Mbele)',
                englishTitle: 'Driver License (Front)',
                description: 'Upande wa mbele wa leseni ya udereva ya dereva huyu.',
                hasDoc: !!driver.licenseFrontUrl,
                status: driver.licenseStatus || 'pending',
                expiry: driver.licenseExpiry || 'N/A',
                number: driver.licenseNumber || 'N/A',
                icon: <FileText className="w-5 h-5" />,
                rejectionReason: driver.licenseRejectionReason
              },
              {
                id: 'licenseBack' as const,
                title: 'Leseni ya Udereva (Nyuma)',
                englishTitle: 'Driver License (Back)',
                description: 'Upande wa nyuma wa leseni ya udereva ya dereva huyu.',
                hasDoc: !!driver.licenseBackUrl,
                status: driver.licenseStatus || 'pending',
                expiry: driver.licenseExpiry || 'N/A',
                number: driver.licenseNumber || 'N/A',
                icon: <FileText className="w-5 h-5" />,
                rejectionReason: driver.licenseRejectionReason
              },
              {
                id: 'nida' as const,
                title: 'Kitambulisho cha NIDA / ID',
                englishTitle: 'NIDA National ID Card',
                description: 'Kitambulisho cha Taifa au Namba ya NIDA ya dereva.',
                hasDoc: !!driver.nidaUrl,
                status: driver.nidaStatus || 'pending',
                expiry: 'Haimaliziki (N/A)',
                number: driver.nidaNumber || 'N/A',
                icon: <Shield className="w-5 h-5" />,
                rejectionReason: driver.nidaRejectionReason
              },
              ...(!isDelivery ? [{
                id: 'latra' as const,
                title: 'Kibali cha LATRA / Bima',
                englishTitle: 'LATRA / Vehicle Insurance',
                description: 'Cheti cha bima na ukaguzi wa chombo cha dereva (kwa madereva taxi).',
                hasDoc: !!driver.latraUrl,
                status: driver.latraStatus || 'pending',
                expiry: driver.latraExpiry || 'N/A',
                number: driver.latraNumber || 'N/A',
                icon: <FileText className="w-5 h-5" />,
                rejectionReason: driver.latraRejectionReason
              }] : [])
            ];

            return (
              <div className="space-y-6 animate-fade-in">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                  <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                          Nyaraka na Vyeti vya Usajili ({isDelivery ? 'Delivery Partner' : 'Taxi Driver'})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Kagua na uidhinishe nyaraka zilizopakiwa na dereva huyu kulingana na vigezo vya kazi.
                        </CardDescription>
                      </div>
                      <Badge className="bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-bold uppercase text-[9px] px-3 py-1">
                        {isDelivery ? 'DELIVERY ONLY' : 'TAXI / RIDE HAILING'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {docsList.map((docItem) => {
                        const meta = getDocBadgeAndLabel(docItem.status);
                        return (
                          <Card key={docItem.id} className="rounded-3xl border border-neutral-100 dark:border-neutral-800 p-5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-2xl">
                                    {docItem.icon}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white uppercase leading-tight">{docItem.title}</h4>
                                    <p className="text-[10px] text-neutral-400 mt-1">{docItem.englishTitle}</p>
                                  </div>
                                </div>
                                <Badge className={meta.badgeClass}>{meta.label}</Badge>
                              </div>

                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3 font-medium">
                                {docItem.description}
                              </p>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950/40 p-3 rounded-2xl border border-neutral-100/50 dark:border-neutral-800/40">
                                <div>
                                  <span className="text-[8px] font-black uppercase text-neutral-400 block">Namba ya Nyaraka:</span>
                                  <span className="font-mono">{docItem.number}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] font-black uppercase text-neutral-400 block">Tarehe ya Mwisho:</span>
                                  <span>{docItem.expiry}</span>
                                </div>
                              </div>

                              {docItem.status === 'rejected' && docItem.rejectionReason && (
                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl">
                                  <p className="text-[9px] font-black uppercase text-red-600">Sababu ya kukataliwa:</p>
                                  <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5">{docItem.rejectionReason}</p>
                                </div>
                              )}
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-dashed border-neutral-100 dark:border-neutral-800 pt-4">
                              <span className="text-[10px] font-black uppercase text-neutral-400">{meta.swahiliHali}</span>
                              <Button 
                                size="sm" 
                                variant={docItem.hasDoc ? "outline" : "ghost"} 
                                disabled={!docItem.hasDoc && docItem.status === 'not_uploaded'}
                                onClick={() => setSelectedDocForViewer(docItem.id)}
                                className="rounded-xl text-[10px] uppercase font-black tracking-wider h-8 px-4"
                              >
                                {docItem.hasDoc ? 'Tazama Nyaraka' : 'Haijapakiwa bado'}
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* VEHICLE SUB-TAB */}
          {subTab === 'vehicle' && (
            <div className="space-y-6 animate-fade-in">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                      Maelezo ya Chombo cha Kazi
                    </CardTitle>
                    <CardDescription className="text-xs">Usimamizi wa sifa, rangi, namba ya gari, na kundi la chombo cha kazi.</CardDescription>
                  </div>
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                    <Car className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-[10px] font-black uppercase text-neutral-400">Aina ya Chombo (Driver Category)</Label>
                        <Select value={editDriverType} onValueChange={(v) => setEditDriverType(v)}>
                          <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                            <SelectValue placeholder="Chagua aina ya chombo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boda">🏍️ Boda Boda (Boda)</SelectItem>
                            <SelectItem value="bajaji">🛺 Bajaji (TukTuk)</SelectItem>
                            <SelectItem value="taxi">🚗 Taxi ya Kawaida (Taxi)</SelectItem>
                            <SelectItem value="delivery">📦 Bodaboda ya Mizigo (Delivery)</SelectItem>
                            <SelectItem value="mini">🚙 Gari Kubwa (MiniVan / SUV)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Usajili / License Plate</Label>
                        <Input 
                          value={editLicensePlate} 
                          onChange={(e) => setEditLicensePlate(e.target.value)}
                          className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-[10px] font-black uppercase text-neutral-400">Brand ya Gari</Label>
                          <Input 
                            value={editVehicleBrand} 
                            onChange={(e) => setEditVehicleBrand(e.target.value)}
                            placeholder="e.g. Toyota"
                            className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-black uppercase text-neutral-400">Modeli ya Gari</Label>
                          <Input 
                            value={editVehicleModel} 
                            onChange={(e) => setEditVehicleModel(e.target.value)}
                            placeholder="e.g. Ist"
                            className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] font-black uppercase text-neutral-400">Rangi ya Chombo</Label>
                        <Input 
                          value={editVehicleColor} 
                          onChange={(e) => setEditVehicleColor(e.target.value)}
                          placeholder="e.g. Silver, Black"
                          className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end border-t border-neutral-100 dark:border-neutral-800 pt-6">
                    <Button onClick={handleSaveDriverEdit} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[10px] h-10 px-6 uppercase tracking-wider">
                      Hifadhi Maelezo ya Chombo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TRIPS SUB-TAB */}
          {subTab === 'trips' && (
            <div className="space-y-6 animate-fade-in">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                      Historia ya Safari za Dereva
                    </CardTitle>
                    <CardDescription className="text-xs">Safari zote zilizofanywa na dereva huyu na hali zao.</CardDescription>
                  </div>
                  <Badge className="bg-orange-600 text-white font-black text-[10px] py-1 px-3 rounded-full">
                    {trips.length} Safari
                  </Badge>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  {trips.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400 italic text-sm font-bold">
                      Hakuna safari zozote zilizosajiliwa kwa dereva huyu.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400">
                            <th className="py-3 px-4">Trip ID</th>
                            <th className="py-3 px-4">Abiria (Customer)</th>
                            <th className="py-3 px-4">Njia (Route)</th>
                            <th className="py-3 px-4">Gharama (Fare)</th>
                            <th className="py-3 px-4">Hali (Status)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trips.map((trip, idx) => (
                            <tr key={trip.id || idx} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 font-medium">
                              <td className="py-4 px-4 font-mono">
                                <Button 
                                  variant="ghost" 
                                  className="h-auto p-0 font-bold font-mono text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1.5"
                                  onClick={() => setSelectedTripForMap(trip)}
                                >
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  #{trip.id ? trip.id.slice(0, 6).toUpperCase() : 'N/A'}
                                </Button>
                              </td>
                              <td className="py-4 px-4">
                                <span className="font-bold text-neutral-900 dark:text-white uppercase italic">{trip.customerName || trip.customerId?.slice(0, 8) || 'N/A'}</span>
                              </td>
                              <td className="py-4 px-4 truncate max-w-[250px]" title={`${trip.pickup?.address || trip.pickupAddress || 'Kuanzia'} to ${trip.destination?.address || trip.dropoffAddress || 'Mwisho'}`}>
                                <span className="font-semibold text-neutral-700 dark:text-neutral-300 block truncate">{trip.pickup?.address || trip.pickupAddress || 'Kuanzia (Start)'}</span>
                                <span className="text-neutral-400 text-[10px] block truncate mt-0.5">{trip.destination?.address || trip.dropoffAddress || 'Mwisho (Destination)'}</span>
                              </td>
                              <td className="py-4 px-4 font-black text-neutral-950 dark:text-white italic">{(trip.price || trip.fare || 0).toLocaleString()} TZS</td>
                              <td className="py-4 px-4">
                                <Badge className={`font-bold text-[8px] uppercase tracking-wider ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : trip.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700 animate-pulse'}`}>
                                  {trip.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* WALLET & EARNINGS SUB-TAB */}
          {subTab === 'wallet' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Adjust balance Form */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                  <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                    <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                      Marekebisho ya Salio (Adjust Balance)
                    </CardTitle>
                    <CardDescription className="text-xs">Ongeza au punguza salio la mkoba wa dereva kwa mikono.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-black uppercase text-neutral-400">Kiasi cha Pesa (TZS)</Label>
                        <Input 
                          type="number"
                          value={adjustAmount} 
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-black uppercase text-neutral-400">Aina ya Marekebisho</Label>
                        <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                          <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                            <SelectValue placeholder="Chagua aina" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">➕ Credit (Ongeza salio)</SelectItem>
                            <SelectItem value="debit">➖ Debit (Punguza salio)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] font-black uppercase text-neutral-400">Sababu / Maelezo Mafupi</Label>
                      <Input 
                        value={adjustNote} 
                        onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="e.g. Manual Bonus, Correction"
                        className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold mt-1"
                      />
                    </div>

                    <Button onClick={handleAdjustBalance} className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[10px] h-10 uppercase tracking-wider">
                      Fanya Marekebisho ya Mkoba
                    </Button>
                  </CardContent>
                </Card>

                {/* Driver Financial core parameters */}
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-orange-50/50 dark:bg-orange-950/10 text-neutral-900 dark:text-white p-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-md font-black uppercase italic tracking-wider text-orange-600">Mkoba na Mapato ya Dereva</h3>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-100 dark:border-orange-900/40">
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Salio Sasa (Balance)</span>
                        <h4 className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                          {(driver.balance || 0).toLocaleString()} <span className="text-xs">TZS</span>
                        </h4>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Jumla ya Mapato (Total)</span>
                        <h4 className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                          {totalEarningsToDisplay.toLocaleString()} <span className="text-xs">TZS</span>
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/40 mt-6 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-neutral-700 dark:text-neutral-300">Njia kuu ya malipo:</p>
                      <p className="font-semibold text-neutral-400">Mobile Money (M-Pesa, Tigopesa)</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 font-bold uppercase text-[8px]">Verified</Badge>
                  </div>
                </Card>
              </div>

              {/* Driver Payout History Table */}
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                      Miamala na Payout za Dereva
                    </CardTitle>
                    <CardDescription className="text-xs">Historia ya malipo yote yaliyoomba au kusasishwa kwa dereva huyu.</CardDescription>
                  </div>
                  <Badge className="bg-neutral-100 text-neutral-500 font-bold text-[10px] py-1 px-3 rounded-full">
                    {driverPayouts.length} Miamala
                  </Badge>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  {driverPayouts.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400 italic text-sm font-bold">
                      Hakuna payout au muamala wowote uliorekodiwa.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black uppercase text-neutral-400">
                            <th className="py-3 px-4">Muamala ID</th>
                            <th className="py-3 px-4">Kiasi cha Malipo (Amount)</th>
                            <th className="py-3 px-4">Njia / Method</th>
                            <th className="py-3 px-4">Hali / Status</th>
                            <th className="py-3 px-4">Tarehe (Date)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driverPayouts.map((p, idx) => (
                            <tr key={p.id || idx} className="border-b border-neutral-50 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 font-medium">
                              <td className="py-4 px-4 font-mono font-bold text-neutral-500">#{p.id ? p.id.slice(0, 6).toUpperCase() : 'N/A'}</td>
                              <td className="py-4 px-4 font-black text-neutral-950 dark:text-white italic">{p.amount?.toLocaleString()} TZS</td>
                              <td className="py-4 px-4 uppercase font-bold text-neutral-600 dark:text-neutral-400">{p.method || 'Mobile Wallet'}</td>
                              <td className="py-4 px-4">
                                <Badge className={`font-bold text-[8px] uppercase tracking-wider ${p.status === 'processed' ? 'bg-green-100 text-green-700' : p.status === 'pending' ? 'bg-orange-100 text-orange-700 animate-pulse' : 'bg-red-100 text-red-700'}`}>
                                  {p.status}
                                </Badge>
                              </td>
                              <td className="py-4 px-4 font-bold text-neutral-400">
                                {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PERFORMANCE SUB-TAB */}
          {subTab === 'performance' && (
            <div className="space-y-6 animate-fade-in">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                    Viwango vya Utendaji Kazi
                  </CardTitle>
                  <CardDescription className="text-xs">Ufanisi, kiwango cha kukubali safari na kuridhika kwa wateja.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Completion rate */}
                    <Card className="rounded-3xl border border-neutral-100 dark:border-neutral-800 p-5 text-center">
                      <span className="text-[10px] font-black uppercase text-neutral-400 block mb-3">Safari Zilizokamilika (Completion)</span>
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-neutral-100 dark:text-neutral-800" />
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * 98) / 100} className="text-orange-600 transition-all duration-1000" />
                        </svg>
                        <span className="absolute text-xl font-black italic text-neutral-900 dark:text-white">98%</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-4">Kiwango Kikubwa Sana</p>
                    </Card>

                    {/* Acceptance rate */}
                    <Card className="rounded-3xl border border-neutral-100 dark:border-neutral-800 p-5 text-center">
                      <span className="text-[10px] font-black uppercase text-neutral-400 block mb-3">Kiwango cha Kukubali (Acceptance)</span>
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-neutral-100 dark:text-neutral-800" />
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * 95) / 100} className="text-blue-600 transition-all duration-1000" />
                        </svg>
                        <span className="absolute text-xl font-black italic text-neutral-900 dark:text-white">95%</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-4">Ufanisi Bora</p>
                    </Card>

                    {/* Customer ratings */}
                    <Card className="rounded-3xl border border-neutral-100 dark:border-neutral-800 p-5 text-center">
                      <span className="text-[10px] font-black uppercase text-neutral-400 block mb-3">Maoni ya Abiria (Satisfaction)</span>
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-neutral-100 dark:text-neutral-800" />
                          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * 96) / 100} className="text-emerald-600 transition-all duration-1000" />
                        </svg>
                        <span className="absolute text-xl font-black italic text-neutral-900 dark:text-white">4.8</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-4">Kiwango cha Nyota (Rating)</p>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* NOTIFICATIONS SUB-TAB */}
          {subTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-neutral-900 p-6">
                <CardHeader className="p-0 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <CardTitle className="text-md font-black uppercase italic tracking-wider text-neutral-900 dark:text-white">
                    Tuma Arifa kwa Dereva Huyu Pekee
                  </CardTitle>
                  <CardDescription className="text-xs">Ujumbe huu utatumwa kama Notification ya Simu au Ujumbe wa Mfumo moja kwa moja kwa dereva.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[10px] font-black uppercase text-neutral-400">Kichwa cha Habari (Title)</Label>
                      <Input 
                        value={notifTitle} 
                        onChange={(e) => setNotifTitle(e.target.value)}
                        placeholder="e.g. Salio la Mkoba limepungua"
                        className="rounded-xl border-neutral-200 dark:border-neutral-700 font-bold mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase text-neutral-400">Kategoria ya Arifa</Label>
                      <Select value={notifCategory} onValueChange={(v) => setNotifCategory(v as any)}>
                        <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                          <SelectValue placeholder="Chagua kategoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">🔔 System Notification (Mawasiliano Mkuu)</SelectItem>
                          <SelectItem value="ride">🚕 Ride Status (Kuhusu Safari)</SelectItem>
                          <SelectItem value="payout">💰 Payout Alert (Kuhusu Malipo/Mkoba)</SelectItem>
                          <SelectItem value="promotion">🎉 Promotion & Bonus (Ziada na Ofa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-[10px] font-black uppercase text-neutral-400">Kiwango cha Umuhimu (Importance)</Label>
                      <Select value={notifImportance} onValueChange={(v) => setNotifImportance(v as any)}>
                        <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                          <SelectValue placeholder="Chagua umuhimu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal (Kawaida)</SelectItem>
                          <SelectItem value="important">Important (Muhimu)</SelectItem>
                          <SelectItem value="critical">🚨 Critical Alert (Ya Dharura Kwenye Simu)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] font-black uppercase text-neutral-400">Ujumbe / Taarifa Kamili (Body)</Label>
                    <Textarea 
                      value={notifBody} 
                      onChange={(e) => setNotifBody(e.target.value)}
                      placeholder="Andika taarifa kamili unayotaka kuifikisha kwa dereva..."
                      rows={4}
                      className="rounded-2xl border-neutral-200 dark:border-neutral-700 mt-1 font-semibold text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <Button 
                      onClick={handleSendNotification} 
                      disabled={isSendingNotif}
                      className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[10px] h-11 px-6 uppercase tracking-wider flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {isSendingNotif ? 'Inatuma...' : 'Tuma Arifa Hivi Sasa'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <Card className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border-none overflow-hidden max-h-[90vh] flex flex-col">
            <CardHeader className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <CardTitle className="text-lg font-black uppercase italic tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-orange-600" />
                Hariri Wasifu wa Dereva
              </CardTitle>
              <CardDescription className="text-xs">Marekebisho ya maelezo binafsi, gari na salio la mkoba la dereva.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Jina Kamili</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Simu</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Barua Pepe (Email)</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Namba ya Usajili wa Gari (Plate)</Label>
                  <Input value={editLicensePlate} onChange={(e) => setEditLicensePlate(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Aina ya Chombo / Type</Label>
                  <Select value={editDriverType} onValueChange={(v) => setEditDriverType(v)}>
                    <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                      <SelectValue placeholder="Chagua aina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boda">Boda Boda</SelectItem>
                      <SelectItem value="bajaji">Bajaji</SelectItem>
                      <SelectItem value="taxi">Taxi ya Kawaida</SelectItem>
                      <SelectItem value="delivery">Bodaboda ya Mizigo</SelectItem>
                      <SelectItem value="mini">MiniVan / Gari Kubwa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Rangi ya Chombo</Label>
                  <Input value={editVehicleColor} onChange={(e) => setEditVehicleColor(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Brand ya Chombo</Label>
                  <Input value={editVehicleBrand} onChange={(e) => setEditVehicleBrand(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Modeli ya Gari</Label>
                  <Input value={editVehicleModel} onChange={(e) => setEditVehicleModel(e.target.value)} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Salio la Mkoba (Balance TZS)</Label>
                  <Input type="number" value={editBalance} onChange={(e) => setEditBalance(Number(e.target.value))} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold text-emerald-600" />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Jumla ya Mapato (Total Earnings TZS)</Label>
                  <Input type="number" value={editTotalEarnings} onChange={(e) => setEditTotalEarnings(Number(e.target.value))} className="rounded-xl border-neutral-200 dark:border-neutral-700 mt-1 font-bold text-violet-600" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl font-bold text-[10px] uppercase h-10 px-4">
                  Ghairi (Cancel)
                </Button>
                <Button onClick={handleSaveDriverEdit} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[10px] h-10 px-6 uppercase tracking-wider">
                  Hifadhi Mabadiliko
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CHANGE STATUS MODAL */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsStatusModalOpen(false)} />
          <Card className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border-none overflow-hidden">
            <CardHeader className="p-6 border-b border-neutral-100 dark:border-neutral-800">
              <CardTitle className="text-lg font-black uppercase italic tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                Badili Hali ya Dereva (Status)
              </CardTitle>
              <CardDescription className="text-xs">Usimamizi wa usalama na ufunguzi / uzuiaji wa dereva katika mfumo.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6 text-xs font-semibold">
              <div className="space-y-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Hali Kuu ya Akaunti (Status)</Label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
                    <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                      <SelectValue placeholder="Hali ya Akaunti" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">🟢 Active (Mruhusu kuingia mfumo)</SelectItem>
                      <SelectItem value="blocked">🔴 Blocked (Mzuie asione chochote)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase text-neutral-400">Hali ya Kupitishwa Nyaraka (Approval)</Label>
                  <Select value={newApprovalStatus} onValueChange={(v) => setNewApprovalStatus(v as any)}>
                    <SelectTrigger className="w-full rounded-xl border-neutral-200 dark:border-neutral-700 font-bold uppercase mt-1">
                      <SelectValue placeholder="Hali ya Nyaraka" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">🟡 Pending (Anasubiri kukaguliwa)</SelectItem>
                      <SelectItem value="approved">🟢 Approved (Leseni na Vyeti vyema)</SelectItem>
                      <SelectItem value="suspended">🔴 Suspended (Nyaraka zimefutwa/feli)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <Button variant="outline" onClick={() => setIsStatusModalOpen(false)} className="rounded-xl font-bold text-[10px] uppercase h-10 px-4">
                  Ghairi (Cancel)
                </Button>
                <Button onClick={handleUpdateStatus} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[10px] h-10 px-6 uppercase tracking-wider">
                  Hifadhi Hali Mpya
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TRIP HISTORY MAP MODAL */}
      {selectedTripForMap && (() => {
        const trip = selectedTripForMap;
        const mapPoints: [number, number][] = [];
        let pickupCoords: [number, number] | null = null;
        let destCoords: [number, number] | null = null;

        if (trip.pickup) {
          const pLat = Number(trip.pickup.lat);
          const pLng = Number(trip.pickup.lng);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            pickupCoords = [pLat, pLng];
            mapPoints.push(pickupCoords);
          }
        }
        if (trip.destination) {
          const dLat = Number(trip.destination.lat);
          const dLng = Number(trip.destination.lng);
          if (!isNaN(dLat) && !isNaN(dLng)) {
            destCoords = [dLat, dLng];
            mapPoints.push(destCoords);
          }
        }
        
        const routePoints = getNormalizedCoords(trip.routeCoords);
        mapPoints.push(...routePoints);

        const center: [number, number] = pickupCoords || destCoords || [-6.7924, 39.2083];

        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 animate-fade-in">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedTripForMap(null)} />
            <Card className="relative w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border-none overflow-hidden max-h-[90vh] flex flex-col md:flex-row z-10">
              
              {/* Left Details Panel */}
              <div className="w-full md:w-[32%] bg-neutral-50 dark:bg-neutral-950/40 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-100 dark:border-neutral-800/80 overflow-y-auto text-xs font-semibold">
                <div className="space-y-6">
                  <div>
                    <Badge className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[9px] uppercase tracking-wider mb-2">
                      Safari Detail
                    </Badge>
                    <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white leading-none">
                      #{trip.id ? trip.id.slice(0, 8).toUpperCase() : 'N/A'}
                    </h4>
                    <p className="text-[10px] text-neutral-400 font-bold mt-1 uppercase tracking-wider">
                      Taarifa na Njia ya Safari
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <div>
                      <span className="text-[9px] font-black uppercase text-neutral-400 block">Abiria (Customer)</span>
                      <span className="text-sm font-black text-neutral-900 dark:text-white uppercase italic mt-1 block">
                        {trip.customerName || trip.customerId?.slice(0, 8) || 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Umbali (Distance)</span>
                        <span className="text-sm font-black text-neutral-900 dark:text-white mt-1 block">
                          {formatDistance(trip.distance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Muda (Duration)</span>
                        <span className="text-sm font-black text-neutral-900 dark:text-white mt-1 block">
                          {formatDuration(trip.duration)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-neutral-400 block">Gharama (Fare)</span>
                      <span className="text-lg font-black text-orange-600 italic mt-0.5 block">
                        {(trip.price || trip.fare || 0).toLocaleString()} TZS
                      </span>
                    </div>

                    <div className="pt-2 space-y-3">
                      <div className="flex gap-2 items-start">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center font-black text-[9px] text-emerald-600 shrink-0 mt-0.5">
                          A
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-neutral-400 block">Kuanzia (Pickup)</span>
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block leading-tight mt-0.5">
                            {trip.pickup?.address || trip.pickupAddress || 'Address haipatikani'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 items-start">
                        <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center font-black text-[9px] text-red-600 shrink-0 mt-0.5">
                          B
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase text-neutral-400 block">Mwisho (Destination)</span>
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block leading-tight mt-0.5">
                            {trip.destination?.address || trip.dropoffAddress || 'Address haipatikani'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-neutral-400 block">Hali ya Safari (Status)</span>
                      <Badge className={`mt-1 font-bold text-[8px] uppercase tracking-wider px-2.5 py-0.5 ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : trip.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {trip.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6 md:mt-0">
                  <Button 
                    onClick={() => setSelectedTripForMap(null)} 
                    className="w-full bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl font-bold text-[10px] h-10 uppercase tracking-wider"
                  >
                    Funga Dirisha
                  </Button>
                </div>
              </div>

              {/* Right Map Canvas Panel */}
              <div className="flex-1 h-[400px] md:h-auto min-h-[350px] relative bg-neutral-100 dark:bg-neutral-950">
                {/* Close Overlay Icon Button */}
                <button 
                  onClick={() => setSelectedTripForMap(null)}
                  className="absolute top-4 right-4 z-[1010] p-2 bg-white/95 dark:bg-neutral-900/95 shadow-lg rounded-full border border-neutral-100 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <MapContainer 
                  center={center} 
                  zoom={14} 
                  maxZoom={22}
                  className="w-full h-full z-0"
                  scrollWheelZoom
                >
                  <TileLayer 
                    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    maxZoom={22}
                    maxNativeZoom={19}
                    attribution="&copy; Google Maps"
                  />
                  
                  {pickupCoords && (
                    <Marker position={pickupCoords} icon={createTripMarkerIcon('pickup')}>
                      <Popup className="rounded-xl overflow-hidden font-sans">
                        <div className="p-1 text-xs">
                          <p className="font-bold text-emerald-600 uppercase tracking-wider text-[9px] mb-0.5">Kuanzia (Pickup)</p>
                          <p className="font-semibold text-neutral-800">{trip.pickup?.address || trip.pickupAddress}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {destCoords && (
                    <Marker position={destCoords} icon={createTripMarkerIcon('destination')}>
                      <Popup className="rounded-xl overflow-hidden font-sans">
                        <div className="p-1 text-xs">
                          <p className="font-bold text-red-600 uppercase tracking-wider text-[9px] mb-0.5">Mwisho (Destination)</p>
                          <p className="font-semibold text-neutral-800">{trip.destination?.address || trip.dropoffAddress}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {routePoints.length > 1 && (
                    <Polyline 
                      positions={routePoints} 
                      color="#F97316" 
                      weight={5} 
                      opacity={0.85} 
                      dashArray="2, 6"
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}

                  <MapBoundsFitter points={mapPoints} />
                </MapContainer>
              </div>

            </Card>
          </div>
        );
      })()}

      {/* DOCUMENT VIEWER & VERIFICATION MODAL */}
      {selectedDocForViewer && (() => {
        const docType = selectedDocForViewer;
        let title = '';
        let englishTitle = '';
        let hasDoc = false;
        let docStatus = 'not_uploaded';
        let docNumber = '—';
        let docExpiry = '—';
        let imageUrls: string[] = [];

        if (docType === 'licenseFront') {
          title = 'Leseni ya Udereva (Mbele)';
          englishTitle = 'Driver License (Front)';
          hasDoc = !!driver.licenseFrontUrl;
          docStatus = driver.licenseStatus || (hasDoc ? 'pending' : 'not_uploaded');
          docNumber = driver.licenseNumber || 'TZ-98234-DL';
          docExpiry = driver.licenseExpiry || '12/2028';
          if (driver.licenseFrontUrl) imageUrls.push(driver.licenseFrontUrl);
        } else if (docType === 'licenseBack') {
          title = 'Leseni ya Udereva (Nyuma)';
          englishTitle = 'Driver License (Back)';
          hasDoc = !!driver.licenseBackUrl;
          docStatus = driver.licenseStatus || (hasDoc ? 'pending' : 'not_uploaded');
          docNumber = driver.licenseNumber || 'TZ-98234-DL';
          docExpiry = driver.licenseExpiry || '12/2028';
          if (driver.licenseBackUrl) imageUrls.push(driver.licenseBackUrl);
        } else if (docType === 'selfie') {
          title = 'Picha ya Wasifu (Selfie)';
          englishTitle = 'Profile Photo (Selfie)';
          hasDoc = !!driver.photoURL;
          docStatus = 'view_only';
          docNumber = 'N/A';
          docExpiry = 'N/A';
          if (driver.photoURL) imageUrls.push(driver.photoURL);
        } else if (docType === 'nida') {
          title = 'Kitambulisho cha NIDA / ID';
          englishTitle = 'NIDA National ID Card';
          hasDoc = !!driver.nidaUrl;
          docStatus = driver.nidaStatus || (hasDoc ? 'pending' : 'not_uploaded');
          docNumber = driver.nidaNumber || '19950812-11112-00001-22';
          docExpiry = 'Haimaliziki (N/A)';
          if (driver.nidaUrl) imageUrls.push(driver.nidaUrl);
        } else if (docType === 'latra') {
          title = 'Kibali cha LATRA / Bima';
          englishTitle = 'LATRA / Vehicle Insurance';
          hasDoc = !!driver.latraUrl;
          docStatus = driver.latraStatus || (hasDoc ? 'pending' : 'not_uploaded');
          docNumber = driver.latraNumber || 'LATRA-TX-77889';
          docExpiry = driver.latraExpiry || '08/2027';
          if (driver.latraUrl) imageUrls.push(driver.latraUrl);
        }

        const meta = getDocBadgeAndLabel(docStatus);

        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8 animate-fade-in">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => {
              setSelectedDocForViewer(null);
              setIsRejecting(false);
              setRejectionReasonInput('');
            }} />
            
            <Card className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border-none overflow-hidden max-h-[90vh] flex flex-col z-10">
              
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950/20">
                <div>
                  <Badge className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[9px] uppercase tracking-wider mb-2">
                    Uthibitishaji Nyaraka (KYC Docs)
                  </Badge>
                  <h4 className="text-xl font-black uppercase italic tracking-tighter text-neutral-900 dark:text-white leading-none">
                    {title}
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-bold mt-1 uppercase tracking-wider">
                    {englishTitle} — Kagua Taarifa na Picha ya Nyaraka
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedDocForViewer(null);
                    setIsRejecting(false);
                    setRejectionReasonInput('');
                  }}
                  className="p-2.5 bg-white dark:bg-neutral-800 shadow-md rounded-full border border-neutral-100 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8">
                
                {/* Left Side: Document Preview (Real Uploaded Image or High-Fidelity Simulator) */}
                <div className="w-full lg:w-[58%] flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-neutral-400">Muonekano wa Nyaraka (Document View)</span>
                  </div>

                  {/* Document Container Box */}
                  <div className="flex-1 min-h-[260px] md:min-h-[300px] border border-neutral-100 dark:border-neutral-800 rounded-[2rem] bg-neutral-50 dark:bg-neutral-950/40 p-4 md:p-6 flex items-center justify-center relative overflow-hidden group">
                    
                    {/* If there is an uploaded image */}
                    {imageUrls.length > 0 ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <img 
                          src={imageUrls[0]} 
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-[280px] rounded-2xl object-contain shadow-lg border border-neutral-200 dark:border-neutral-800 transition-transform group-hover:scale-105 duration-300"
                        />
                        <div className="absolute top-3 left-3 bg-neutral-900/85 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg font-black text-[8px] uppercase tracking-wider">
                          Picha Halisi (Uploaded)
                        </div>
                      </div>
                    ) : (
                      /* HIGH-FIDELITY SIMULATED TANZANIAN DOCUMENT INTERACTIVE PREVIEW */
                      <div className="w-full max-w-[420px] aspect-[1.58/1] relative rounded-3xl overflow-hidden shadow-2xl transition-transform group-hover:scale-[1.02] duration-300">
                        {(docType === 'licenseFront' || docType === 'licenseBack') && (
                          /* Driver License Simulated Graphic */
                          <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-neutral-800 dark:to-neutral-900 border-4 border-orange-500/20 p-5 flex flex-col justify-between font-sans text-[10px] text-neutral-800 dark:text-neutral-200">
                            {/* Watermark Logo */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                              <FileText className="w-48 h-48" />
                            </div>
                            
                            {/* License Header */}
                            <div className="flex justify-between items-start pb-2 border-b border-orange-500/10">
                              <div>
                                <h5 className="font-black text-[9px] uppercase tracking-tight text-neutral-900 dark:text-white leading-none">JAMHURI YA MUUNGANO WA TANZANIA</h5>
                                <p className="text-[7px] font-bold uppercase text-orange-600 mt-0.5">LESENI YA UDEREVA ({docType === 'licenseFront' ? 'MBELE' : 'NYUMA'})</p>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[12px] font-black text-red-600 leading-none">CLASS C</span>
                                <span className="text-[6px] font-black text-neutral-400 mt-0.5">TZ Flag</span>
                              </div>
                            </div>

                            {/* License Body */}
                            <div className="grid grid-cols-3 gap-3 pt-2">
                              {/* Photo Slot */}
                              <div className="col-span-1 bg-neutral-200/50 dark:bg-neutral-800/80 rounded-2xl aspect-[3/4] flex flex-col items-center justify-center relative overflow-hidden border border-neutral-300/30">
                                {driver.photoURL ? (
                                  <img src={driver.photoURL} alt="Driver" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-center p-2 text-neutral-400">
                                    <Car className="w-6 h-6 mx-auto mb-1 text-neutral-400/80" />
                                    <span className="text-[7px] font-bold block uppercase">PICHA</span>
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white" />
                              </div>

                              {/* License Details */}
                              <div className="col-span-2 space-y-1.5 flex flex-col justify-center">
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">1. Jina la Dereva (Name)</span>
                                  <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase leading-none">{driver.displayName}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">2. Namba ya Leseni</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300 font-mono">{docNumber}</span>
                                  </div>
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">3. Tarehe ya Mwisho</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300 font-mono">{docExpiry}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">4. Aina ya Chombo</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300 uppercase">{driver.driverType || 'TAXI'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">5. Nchi (Country)</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300">TANZANIA (E.A)</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* License Footer */}
                            <div className="flex justify-between items-center pt-2 border-t border-orange-500/10 text-[6px] font-black uppercase text-neutral-400">
                              <span>Saini ya Mwenye Leseni: ______</span>
                              <span className="text-orange-600 font-black italic">Mamlaka ya Mapato (TRA)</span>
                            </div>
                          </div>
                        )}

                        {docType === 'selfie' && (
                          /* Profile Photo / Selfie simulated visual container */
                          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950 p-6 flex flex-col justify-between text-white relative">
                            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                              <Camera className="w-32 h-32 text-white" />
                            </div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-black text-[10px] uppercase tracking-wide text-neutral-200">WASIFU WA DEREVA (SELFIE)</h5>
                                <p className="text-[8px] text-neutral-400 mt-0.5">Mlipaji / Delivery Partner Profile Photo</p>
                              </div>
                              <Badge className="bg-blue-600 text-[8px] uppercase font-black tracking-wider text-white">VIEW ONLY</Badge>
                            </div>

                            <div className="flex items-center justify-center py-2">
                              <div className="w-24 h-24 rounded-full border-4 border-neutral-700/80 overflow-hidden bg-neutral-800 flex items-center justify-center shadow-2xl relative">
                                {driver.photoURL ? (
                                  <img src={driver.photoURL} alt="Driver" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-12 h-12 text-neutral-500" />
                                )}
                              </div>
                            </div>

                            <div className="text-center">
                              <h4 className="text-sm font-black uppercase tracking-tight text-white">{driver.displayName}</h4>
                              <p className="text-[8px] text-neutral-400 uppercase tracking-wider mt-0.5 font-mono">ID: {driver.id.substring(0, 8)} | Active Partner</p>
                            </div>
                          </div>
                        )}

                        {docType === 'nida' && (
                          /* NIDA National ID Simulated Graphic */
                          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100/40 dark:from-neutral-800 dark:to-neutral-900 border-4 border-blue-500/20 p-5 flex flex-col justify-between font-sans text-[10px] text-neutral-800 dark:text-neutral-200">
                            {/* Watermark Coat of Arms */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                              <Shield className="w-48 h-48 text-blue-500" />
                            </div>

                            {/* NIDA Header */}
                            <div className="flex justify-between items-start pb-2 border-b border-blue-500/10">
                              <div>
                                <h5 className="font-black text-[9px] uppercase tracking-tight text-neutral-900 dark:text-white leading-none">JAMHURI YA MUUNGANO WA TANZANIA</h5>
                                <p className="text-[7px] font-bold uppercase text-blue-600 mt-0.5">KITAMBULISHO CHA TAIFA (NATIONAL ID)</p>
                              </div>
                              <span className="text-[7px] font-black text-neutral-400">NIDA EMBLEM</span>
                            </div>

                            {/* NIDA Body */}
                            <div className="grid grid-cols-3 gap-3 pt-2">
                              {/* Photo Slot */}
                              <div className="col-span-1 bg-neutral-200/50 dark:bg-neutral-800/80 rounded-2xl aspect-[3/4] flex flex-col items-center justify-center relative overflow-hidden border border-neutral-300/30">
                                {driver.photoURL ? (
                                  <img src={driver.photoURL} alt="Driver" className="w-full h-full object-cover grayscale" />
                                ) : (
                                  <div className="text-center p-2 text-neutral-400">
                                    <Shield className="w-6 h-6 mx-auto mb-1 text-neutral-400/80" />
                                    <span className="text-[7px] font-bold block uppercase">NIDA</span>
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                              </div>

                              {/* NIDA Details */}
                              <div className="col-span-2 space-y-1.5 flex flex-col justify-center">
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Namba ya Kitambulisho (NIDA ID No.)</span>
                                  <span className="text-[11px] font-black text-blue-700 dark:text-blue-400 font-mono tracking-tight leading-none">{docNumber}</span>
                                </div>
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Majina Kamili (Full Name)</span>
                                  <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase leading-none">{driver.displayName}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">Jinsia (Sex)</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300">ME / KE</span>
                                  </div>
                                  <div>
                                    <span className="text-[7px] font-black text-neutral-400 uppercase block">Uraia (Citizenship)</span>
                                    <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300">MTANZANIA</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* NIDA Footer */}
                            <div className="flex justify-between items-center pt-2 border-t border-blue-500/10 text-[6px] font-black uppercase text-neutral-400">
                              <span>Mamlaka ya Vitambulisho vya Taifa</span>
                              <span className="text-blue-600 font-black">NIDA TANZANIA</span>
                            </div>
                          </div>
                        )}

                        {docType === 'latra' && (
                          /* LATRA Certificate Simulated Graphic */
                          <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-100/40 dark:from-neutral-800 dark:to-neutral-900 border-4 border-emerald-500/20 p-5 flex flex-col justify-between font-sans text-[10px] text-neutral-800 dark:text-neutral-200">
                            {/* Watermark official */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                              <FileText className="w-48 h-48 text-emerald-500" />
                            </div>

                            {/* LATRA Header */}
                            <div className="flex justify-between items-start pb-2 border-b border-emerald-500/10">
                              <div>
                                <h5 className="font-black text-[9px] uppercase tracking-tight text-neutral-900 dark:text-white leading-none">MAMLAKA YA UDHIBITI USAFIRI ARDHINI</h5>
                                <p className="text-[7px] font-bold uppercase text-emerald-600 mt-0.5">CHETI CHA UKAGUZI NA BIMA (LATRA VEHICLE CERTIFICATE)</p>
                              </div>
                              <span className="text-[7px] font-black text-neutral-400">LATRA</span>
                            </div>

                            {/* LATRA Body */}
                            <div className="space-y-2 pt-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Namba ya Kibali (Permit No)</span>
                                  <span className="text-[9px] font-bold text-neutral-900 dark:text-white font-mono uppercase">{docNumber}</span>
                                </div>
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Namba ya Gari (Plate No)</span>
                                  <span className="text-[10px] font-black text-emerald-600 font-mono uppercase">{driver.licensePlate || 'T-778-ELW'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Chombo (Vehicle)</span>
                                  <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300 uppercase leading-none">
                                    {driver.vehicleColor ? `${driver.vehicleColor} ` : ''}
                                    {driver.vehicleBrand ? `${driver.vehicleBrand} ` : ''}
                                    {driver.vehicleModel ? `${driver.vehicleModel}` : 'Gari la Abiria'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[7px] font-black text-neutral-400 uppercase block">Muda wa Kumalizika</span>
                                  <span className="text-[9px] font-bold text-neutral-800 dark:text-neutral-300 font-mono">{docExpiry}</span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[7px] font-black text-neutral-400 uppercase block">Mmiliki aliyesajiliwa (Registered Owner)</span>
                                <span className="text-[9px] font-black text-neutral-900 dark:text-white uppercase leading-none">{driver.displayName}</span>
                              </div>
                            </div>

                            {/* LATRA Footer */}
                            <div className="flex justify-between items-center pt-2 border-t border-emerald-500/10 text-[6px] font-black uppercase text-neutral-400">
                              <span>Imekaguliwa kikamilifu</span>
                              <span className="text-emerald-600 font-black">LATRA APPROVED</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-neutral-900/85 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg font-black text-[8px] uppercase tracking-wider">
                          Nyaraka ya Mfumo (Simulated Preview)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Verification details & Actions */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 block">Hali Kuu ya Sasa (Current Status)</span>
                      <Badge className={`mt-1.5 font-black text-[9px] uppercase tracking-wider ${meta.badgeClass} px-3 py-1`}>
                        {docStatus}
                      </Badge>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs font-semibold">
                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Mmiliki (Driver)</span>
                        <span className="text-sm font-black text-neutral-900 dark:text-white uppercase italic mt-1 block">
                          {driver.displayName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[9px] font-black uppercase text-neutral-400 block">Namba ya Nyaraka</span>
                          <span className="text-xs font-bold text-neutral-900 dark:text-white font-mono mt-1 block uppercase">
                            {docNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase text-neutral-400 block">Muda wa Kumalizika</span>
                          <span className="text-xs font-bold text-neutral-900 dark:text-white mt-1 block">
                            {docExpiry}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-black uppercase text-neutral-400 block">Aina ya Chombo</span>
                        <span className="text-xs font-bold text-neutral-950 dark:text-white uppercase italic mt-0.5 block">
                          {driver.driverType || 'taxi'}
                        </span>
                      </div>

                      {docStatus === 'rejected' && (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl">
                          <p className="text-[9px] font-black uppercase text-red-600">Sababu ya kukataliwa kwa sasa:</p>
                          <p className="text-neutral-700 dark:text-neutral-300 mt-1 leading-normal font-medium">
                            {(docType === 'licenseFront' || docType === 'licenseBack') ? driver.licenseRejectionReason : docType === 'nida' ? driver.nidaRejectionReason : driver.latraRejectionReason || 'Haieleweki'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Inline Rejection Field if isRejecting is true */}
                    {isRejecting && (
                      <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800 animate-slide-up">
                        <Label className="text-[10px] font-black uppercase text-red-600 block">Andika sababu ya kukataa nyaraka hii:</Label>
                        <Textarea
                          placeholder="Mfano: Picha ya leseni haionekani vizuri, au namba ya leseni haina uhalali..."
                          value={rejectionReasonInput}
                          onChange={(e) => setRejectionReasonInput(e.target.value)}
                          className="rounded-xl text-xs font-semibold border-neutral-200 dark:border-neutral-700 focus:ring-red-500 h-20"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setIsRejecting(false);
                              setRejectionReasonInput('');
                            }}
                            className="rounded-xl text-[9px] uppercase font-black tracking-wider"
                          >
                            Ghairi
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleRejectDocument(docType)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] uppercase font-black tracking-wider px-4"
                          >
                            Thibitisha Kukataa
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Core Verification Buttons */}
                  {!isRejecting && (
                    docType === 'selfie' ? (
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/20 rounded-2xl text-center text-orange-800 dark:text-orange-200 font-bold text-xs mt-6">
                        ℹ️ Picha ya Wasifu (Selfie) ni ya kutazamwa tu, haihitaji kuidhinishwa rasmi.
                      </div>
                    ) : (
                      <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6 md:mt-0 flex flex-col md:flex-row gap-3">
                        <Button
                          onClick={() => setIsRejecting(true)}
                          className="flex-1 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 text-red-600 dark:text-red-400 rounded-xl font-bold text-[10px] h-10 uppercase tracking-wider flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          Kataa (Reject)
                        </Button>
                        <Button
                          onClick={() => handleApproveDocument(docType)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] h-10 uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
                        >
                          <Check className="w-4 h-4" />
                          Kubali (Approve)
                        </Button>
                      </div>
                    )
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/20 flex justify-end">
                <Button 
                  onClick={() => {
                    setSelectedDocForViewer(null);
                    setIsRejecting(false);
                    setRejectionReasonInput('');
                  }} 
                  className="bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl font-bold text-[10px] h-10 uppercase tracking-wider px-6"
                >
                  Funga Dirisha
                </Button>
              </div>

            </Card>
          </div>
        );
      })()}
    </div>
  );
}
