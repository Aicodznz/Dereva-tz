import React, { useState, useEffect, useRef } from 'react';
import { 
  Bus, MapPin, Calendar, Clock, ArrowRight, User, 
  Check, CheckCircle2, ChevronLeft, ChevronRight, 
  Smartphone, Sparkles, CreditCard, Wallet, Copy, 
  FileText, Terminal, Star, Wifi, ShieldCheck, HelpCircle, 
  Award, Send, Trash2, Info, Lock, X, Loader2, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { useTheme } from 'next-themes';
import { toPng } from 'html-to-image';

interface MabasiMaarufuFlowProps {
  product?: any;
  vendor?: any;
  onBackToTripSelection?: () => void;
  standalone?: boolean;
}

export default function MabasiMaarufuFlow({ product, vendor, onBackToTripSelection, standalone = false }: MabasiMaarufuFlowProps) {
  const { user, profile } = useAuth();
  const { theme, resolvedTheme } = useTheme();

  // Mobile Simulator State
  const [step, setStep] = useState<number>(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [activeDeck, setActiveDeck] = useState<'lower' | 'upper'>('lower');
  const [couponCode, setCouponCode] = useState<string>('');
  const [isCouponApplied, setIsCouponApplied] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [dbCoupons, setDbCoupons] = useState<any[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [useWallet, setUseWallet] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('mpesa');

  // Real database coupon synchronize hook
  useEffect(() => {
    if (!db) return;
    const q = collection(db, 'coupons');
    const unsub = onSnapshot(q, (snap) => {
      const all: any[] = [];
      snap.docs.forEach(docSnap => {
        all.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDbCoupons(all);
    }, (err) => {
      console.warn("Error fetching coupons:", err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!dbCoupons) return;
    const currentVendorId = product?.vendorId || vendor?.id || '';
    const currentProductId = product?.id || '';
    
    const eligible = dbCoupons.filter(c => {
      if (c.status !== 'active') return false;
      
      const isVendorMatch = c.vendorId && (c.vendorId === currentVendorId);
      const isAdminCoupon = c.createdBy === 'admin' || !c.vendorId;
      
      if (!isVendorMatch && !isAdminCoupon) return false;
      
      if (c.productId && c.productId !== currentProductId) return false;
      
      return true;
    });
    setAvailableCoupons(eligible);
  }, [dbCoupons, product?.vendorId, vendor?.id, product?.id]);
  
  // Passenger state
  const [passengers, setPassengers] = useState<any[]>([]);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('+255 712 987654');
  const [saveProfile, setSaveProfile] = useState<boolean>(true);
  const [isFrequent, setIsFrequent] = useState<boolean>(false);
  const [ticketPrintMode, setTicketPrintMode] = useState<'consolidated' | 'individual'>('consolidated');

  // My tickets state and realtimes data integration
  const [showMyTickets, setShowMyTickets] = useState<boolean>(false);
  const [myTicketsList, setMyTicketsList] = useState<any[]>([]);
  const [myTicketsLoading, setMyTicketsLoading] = useState<boolean>(false);
  const [viewingTicketDetail, setViewingTicketDetail] = useState<any | null>(null);
  const [activeTicketsTab, setActiveTicketsTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  useEffect(() => {
    if (!user?.uid || !db) return;
    setMyTicketsLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const tickets: any[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const isBusTicket = data.selectedSeats || data.departureDate || data.vendorId === 'mabasi_maarufu_vendor';
        if (isBusTicket) {
          tickets.push({
            id: docSnap.id,
            ...data
          });
        }
      });
      tickets.sort((a, b) => {
        const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dB - dA;
      });
      setMyTicketsList(tickets);
      setMyTicketsLoading(false);
    }, (error) => {
      console.warn("Could not load user's tickets from Firestore:", error.message);
      setMyTicketsLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // Reference for stable ticket layout and download
  const ticketRef = useRef<HTMLDivElement>(null);
  const viewingTicketRef = useRef<HTMLDivElement>(null);
  const [ticketRefId, setTicketRefId] = useState<string>('');

  useEffect(() => {
    if (step === 4 && !ticketRefId) {
      setTicketRefId(`${Math.floor(10000000 + Math.random() * 90000000)}`);
    }
  }, [step, ticketRefId]);

  const downloadTicketAsImage = (element: HTMLDivElement | null, tId: string, bName: string) => {
    if (!element) {
      toast.error("Haikupata kadi ya tiketi ya kupakuliwa!");
      return;
    }

    const loaderId = toast.loading("Inatayarisha kupakua tiketi yako...");

    toPng(element, {
      cacheBust: true,
      backgroundColor: resolvedTheme === 'dark' ? '#171717' : '#ffffff',
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `Tiketi_${(bName || 'Basi').replace(/\s+/g, '_')}_${tId || 'PAY'}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Tiketi imepakuliwa kwa mafanikio kama picha ya HD!", { id: loaderId });
      })
      .catch((error) => {
        console.error("html-to-image error:", error);
        toast.error("Imeshindwa kutengeneza picha otomatiki. Tafadhali chukua picha ya skrini (Screenshot) au fanya Print!", { id: loaderId });
      });
  };

  const handleDownloadTicketImage = () => {
    downloadTicketAsImage(ticketRef.current, ticketRefId, busName);
  };

  // Firestore Booked Seats connection
  const [bookedSeats, setBookedSeats] = useState<string[]>(['3', '4', '8', '11', '12', '18', '22', '31']);

  // Dynamic Route details from Product
  const origin = product?.origin || 'Dar es Salaam';
  const destination = product?.destination || 'Arusha';
  const busName = product?.name || product?.vendorName || 'Kilimanjaro Royal Bus';
  const departureTime = product?.departureTime || '07:00 AM';
  const travelDate = product?.travelDate || product?.departureDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Sync logged in user profile to checkout billing inputs
  useEffect(() => {
    if (user) {
      setBuyerName(profile?.displayName || user.displayName || '');
      setBuyerEmail(user.email || '');
      setBuyerPhone((profile as any)?.phone || (profile as any)?.phoneNumber || '');
    }
  }, [user, profile]);

  // Synchronize Firestore Booked Seats
  useEffect(() => {
    if (!product?.id || !db) return;
    const q = query(
      collection(db, 'tables'),
      where('productId', '==', product.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const booked: string[] = [];
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const isPendingActive = data.status === 'pending' && data.expiresAt && data.expiresAt > Date.now();
        const isBooked = data.status === 'booked' || data.status === 'completed' || data.status === 'confirmed';
        if (isBooked || isPendingActive) {
          booked.push(String(data.seatNum));
        }
      });
      if (booked.length > 0) {
        setBookedSeats(booked);
      }
    }, (error) => {
      console.warn("Could not lead booked seats from Firestore:", error.message);
    });
    return () => unsub();
  }, [product?.id]);

  // Form Validation errors
  const [errors, setErrors] = useState<any>({});

  // Code Exporter State
  const [selectedFile, setSelectedFile] = useState<string>('bookingStore.ts');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const basePricePerSeat = product?.price || 35000;
  const originalTotalPrice = selectedSeats.length * basePricePerSeat;
  const couponDiscount = isCouponApplied && appliedCoupon
    ? (appliedCoupon.discountType === 'percentage'
        ? (originalTotalPrice * appliedCoupon.discountValue) / 100
        : appliedCoupon.discountValue)
    : 0;
  const walletDeduction = useWallet ? 15000 : 0;
  const serviceFee = 2500;
  const finalTotalAmount = Math.max(0, originalTotalPrice - couponDiscount - walletDeduction + serviceFee);

  // Initialize passengers based on selected seats
  useEffect(() => {
    const existingPassengersMap = new Map(passengers.map(p => [p.seat, p]));
    const list = selectedSeats.map((seat, index) => {
      if (existingPassengersMap.has(seat)) {
        return existingPassengersMap.get(seat);
      }
      return {
        id: index + 1,
        seat: seat,
        fullName: index === 0 ? (buyerName || '') : '',
        age: index === 0 ? '28' : '',
        nationality: 'Tanzanian',
        gender: 'male',
      };
    });
    setPassengers(list);
  }, [selectedSeats, buyerName]);

  // Demo hardcoded female occupied and VIP seats
  const femaleOccupiedSeats = ['6', '7', '19', '20'];
  const vipSeats = ['1', '2', '5', '6', '9', '10'];

  const toggleSeat = (seatNum: string) => {
    if (bookedSeats.includes(seatNum) || femaleOccupiedSeats.includes(seatNum)) {
      toast.error(`Kiti hiki kimeshahifadhiwa tayari! (Seat ${seatNum} is already booked)`);
      return;
    }
    setSelectedSeats(prev => {
      if (prev.includes(seatNum)) {
        return prev.filter(s => s !== seatNum);
      } else {
        return [...prev, seatNum];
      }
    });
  };

  const handleApplyCoupon = () => {
    const codeToSearch = couponCode.trim().toUpperCase();
    if (!codeToSearch) {
      toast.error('Tafadhali ingiza namba au jina la kuponi!');
      return;
    }
    const found = availableCoupons.find(c => c.code.trim().toUpperCase() === codeToSearch);
    if (found) {
      setAppliedCoupon(found);
      setIsCouponApplied(true);
      const calculatedDisc = found.discountType === 'percentage'
        ? (originalTotalPrice * found.discountValue) / 100
        : found.discountValue;
      toast.success(`Kuponi imekubaliwa! Umepata punguzo la TZS ${calculatedDisc.toLocaleString()}`);
    } else {
      setAppliedCoupon(null);
      setIsCouponApplied(false);
      toast.error('Kuponi hii haipo, imekwisha muda wake au si ya mtoa huduma huyu.');
    }
  };

  const validateStep2 = () => {
    const errs: any = {};
    passengers.forEach(p => {
      if (!p.fullName.trim()) {
        errs[`name-${p.seat}`] = 'Tafadhali ingiza jina kamili';
      }
      if (!p.age || isNaN(Number(p.age)) || Number(p.age) <= 0) {
        errs[`age-${p.seat}`] = 'Kuanzia miaka 1';
      }
    });
    if (!buyerName.trim()) errs['buyerName'] = 'Ingiza jina la mnunuaji';
    if (!buyerPhone.trim()) errs['buyerPhone'] = 'Ingiza namba ya simu';
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };


  const handleNextStep = async () => {
    if (step === 1) {
      if (selectedSeats.length === 0) {
        toast.error('Tafadhali chagua viti kabla ya kuendelea');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) {
        toast.error('Tafadhali kamilisha maelezo yote ya abiria yenye makosa');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Submit order to Firebase for real!
      const userUid = user?.uid || 'anonymous';
      const orderPayload = {
        vendorId: product?.vendorId || vendor?.id || 'mabasi_maarufu_vendor',
        vendorOwnerUid: vendor?.ownerUid || null,
        customerId: userUid,
        customerName: buyerName || 'Mteja Mabasi',
        customerPhone: buyerPhone,
        customerEmail: buyerEmail,
        branchId: product?.branchId || null,
        items: [{
          productId: product?.id || 'demo_bus_trip',
          name: `${busName} - Kiti ${selectedSeats.join(', ')}`,
          price: basePricePerSeat,
          quantity: selectedSeats.length,
          selectedSeats: selectedSeats,
          departureDate: travelDate,
          origin: origin,
          destination: destination
        }],
        selectedSeats: selectedSeats,
        passengers: passengers, // Save passengers details!
        departureDate: travelDate,
        type: 'bus_ticket',
        orderType: 'booking', // represented as Booking
        totalAmount: finalTotalAmount,
        status: 'pending',
        paymentStatus: 'paid', // Mark as paid for simulating quick successful payment
        paymentMethod: paymentMethod,
        orderSource: 'app_direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const loaderId = toast.loading('Inatuma taarifa za tiketi kwenye hifadhi ya mifumo...');
      
      try {
        // 1. Create order
        await addDoc(collection(db, 'orders'), orderPayload);

        // 2. Lock seats in 'tables' collection
        for (const seat of selectedSeats) {
          const docId = `seat_${product?.id || 'demo_bus_trip'}_${seat}`;
          await setDoc(doc(db, 'tables', docId), {
            id: docId,
            productId: product?.id || 'demo_bus_trip',
            seatNum: seat,
            customerId: userUid,
            status: 'booked',
            updatedAt: Date.now()
          });
        }

        toast.success('Malipo na Tiketi imethibitishwa kikamilifu!', { id: loaderId });
        setStep(4);
      } catch (err: any) {
        toast.error('Imeshindwa kukamilisha uhifadhi: ' + err.message, { id: loaderId });
      }
    }
  };

  // Files for the Exporter
  const sourceFiles: any = {
    'bookingStore.ts': `import create from 'zustand';

interface Passenger {
  fullName: string;
  age: string;
  gender: 'male' | 'female';
  nationality: string;
  seat: string;
}

interface BookingState {
  selectedSeats: string[];
  deck: 'lower' | 'upper';
  passengers: Passenger[];
  couponCode: string;
  discount: number;
  useWallet: boolean;
  paymentMethod: string;
  buyerPhone: string;
  buyerEmail: string;
  setSelectedSeats: (seats: string[]) => void;
  toggleSeat: (seat: string) => void;
  setDeck: (deck: 'lower' | 'upper') => void;
  updatePassenger: (seat: string, data: Partial<Passenger>) => void;
  setCouponCode: (code: string) => void;
  setDiscount: (discount: number) => void;
  setUseWallet: (use: boolean) => void;
  setPaymentMethod: (method: string) => void;
  setBuyerInfo: (phone: string, email: string) => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedSeats: ['14', '15'],
  deck: 'lower',
  passengers: [],
  couponCode: '',
  discount: 0,
  useWallet: false,
  paymentMethod: 'mpesa',
  buyerPhone: '',
  buyerEmail: '',

  setSelectedSeats: (seats) => set({ selectedSeats: seats }),
  
  toggleSeat: (seat) => set((state) => {
    const exists = state.selectedSeats.includes(seat);
    const selectedSeats = exists 
      ? state.selectedSeats.filter(s => s !== seat)
      : [...state.selectedSeats, seat];
    return { selectedSeats };
  }),

  setDeck: (deck) => set({ deck }),

  updatePassenger: (seat, data) => set((state) => {
    const passengers = [...state.passengers];
    const idx = passengers.findIndex(p => p.seat === seat);
    if (idx !== -1) {
      passengers[idx] = { ...passengers[idx], ...data };
    } else {
      passengers.push({ fullName: '', age: '', gender: 'male', nationality: 'Tanzanian', seat, ...data });
    }
    return { passengers };
  }),

  setCouponCode: (couponCode) => set({ couponCode }),
  setDiscount: (discount) => set({ discount }),
  setUseWallet: (useWallet) => set({ useWallet }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setBuyerInfo: (phone, email) => set({ buyerPhone: phone, buyerEmail: email }),
}));`,

    'SeatSelectionScreen.tsx': `import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { useBookingStore } from '../store/bookingStore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

export default function SeatSelectionScreen({ navigation }) {
  const { selectedSeats, toggleSeat, deck, setDeck } = useBookingStore();
  
  const totalSeats = 40;
  const bookedSeats = ['3', '4', '8', '11', '12', '18', '22', '31'];
  const femaleOccupied = ['6', '7', '19', '20'];
  const vipSeats = ['1', '2', '5', '6', '9', '10'];

  const renderSeat = (num: string) => {
    const isBooked = bookedSeats.includes(num);
    const isFemale = femaleOccupied.includes(num);
    const isVIP = vipSeats.includes(num);
    const isSelected = selectedSeats.includes(num);

    let bgStyle = styles.availableSeat;
    let textStyle = styles.availableText;

    if (isBooked) {
      bgStyle = styles.bookedSeat;
      textStyle = styles.bookedText;
    } else if (isFemale) {
      bgStyle = styles.femaleSeat;
      textStyle = styles.femaleText;
    } else if (isSelected) {
      return (
        <TouchableOpacity key={num} onPress={() => toggleSeat(num)}>
          <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.selectedSeatGradient}>
            <Icon name="armchair" size={20} color="#FFF" />
            <Text style={styles.selectedText}>{num}</Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        key={num} 
        disabled={isBooked} 
        onPress={() => toggleSeat(num)}
        style={[
          styles.seatBase, 
          bgStyle,
          isVIP && styles.vipBorder
        ]}
      >
        <Icon name="armchair" size={20} color={isBooked ? '#6B7280' : isFemale ? '#EC4899' : '#374151'} />
        <Text style={textStyle}>{num}</Text>
        {isVIP && <View style={styles.vipBadgeDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-left" size={28} color="#000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mabasi Maarufu</Text>
          <Text style={styles.headerSubtitle}>Dar es Salaam → Arusha</Text>
        </View>
        <Icon name="bus" size={24} color="#7C3AED" />
      </View>

      {/* Deck Selector */}
      <View style={styles.deckTabs}>
        <TouchableOpacity onPress={() => setDeck('lower')} style={[styles.deckTab, deck === 'lower' && styles.activeDeckTab]}>
          <Text style={deck === 'lower' ? styles.activeDeckLabel : styles.deckLabel}>Lower Deck (Chini)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDeck('upper')} style={[styles.deckTab, deck === 'upper' && styles.activeDeckTab]}>
          <Text style={deck === 'upper' ? styles.activeDeckLabel : styles.deckLabel}>Upper Deck (Juu)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Driver Cabin Indicator */}
        <View style={styles.cabin}>
          <Icon name="steering" size={26} color="#4B5563" />
          <Text style={styles.cabinText}>Mbere ya Basi / Driver</Text>
        </View>

        {/* Seat Grid */}
        <View style={styles.gridContainer}>
          {Array.from({ length: totalSeats / 4 }).map((_, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {renderSeat(String(rowIndex * 4 + 1))}
              {renderSeat(String(rowIndex * 4 + 2))}
              <View style={styles.aisle} />
              {renderSeat(String(rowIndex * 4 + 3))}
              {renderSeat(String(rowIndex * 4 + 4))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer sticky bar */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{selectedSeats.length} Viti Vilivyochaguliwa</Text>
          <Text style={styles.footerSeats}>{selectedSeats.join(', ') || 'N/A'}</Text>
        </View>
        <TouchableOpacity style={styles.continueButton} onPress={() => navigation.navigate('PassengerDetails')}>
          <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradientBtn}>
            <Text style={styles.btnText}>ENDELEA</Text>
            <Icon name="arrow-right" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, color: '#6B7280' },
  deckTabs: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, margin: 16, padding: 4 },
  deckTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeDeckTab: { backgroundColor: '#FFF' },
  activeDeckLabel: { color: '#7C3AED', fontWeight: '700' },
  deckLabel: { color: '#4B5563' },
  scrollContent: { paddingHorizontal: 16 },
  cabin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#F3F4F6', borderRadius: 16, gap: 8, marginBottom: 16 },
  cabinText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  gridContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  aisle: { width: 32 },
  seatBase: { width: 54, height: 54, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB' },
  availableSeat: { backgroundColor: '#FFF', borderColor: '#E5E7EB' },
  availableText: { fontSize: 10, color: '#1F2937', fontWeight: '600' },
  bookedSeat: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  bookedText: { fontSize: 10, color: '#9CA3AF' },
  selectedSeatGradient: { width: 54, height: 54, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  selectedText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
  femaleSeat: { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' },
  femaleText: { fontSize: 10, color: '#EC4899', fontWeight: '600' },
  vipBorder: { borderWidth: 2, borderColor: '#F59E0B' },
  vipBadgeDot: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', alignItems: 'center' },
  footerLabel: { fontSize: 12, color: '#6B7280' },
  footerSeats: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  continueButton: { flex: 1, marginLeft: 16 },
  gradientBtn: { flexDirection: 'row', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});`,

    'PassengerDetailsScreen.tsx': `import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useBookingStore } from '../store/bookingStore';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function PassengerDetailsScreen({ navigation }) {
  const { selectedSeats, passengers, updatePassenger } = useBookingStore();
  const [saveProfile, setSaveProfile] = React.useState(true);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Taarifa za Abiria</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll}>
        {passengers.map((p, index) => (
          <View key={p.seat} style={styles.card}>
            <Text style={styles.passengerTitle}>Seat {p.seat} (Abiria {index + 1})</Text>
            
            <Text style={styles.label}>Jina Kamili (Full Name)</Text>
            <TextInput 
              style={styles.input}
              placeholder="Mf. Jane Doe"
              value={p.fullName}
              onChangeText={(txt) => updatePassenger(p.seat, { fullName: txt })}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Umri (Age)</Text>
                <TextInput 
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Mf. 28"
                  value={p.age}
                  onChangeText={(txt) => updatePassenger(p.seat, { age: txt })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Utaifa</Text>
                <TextInput 
                  style={styles.input}
                  value={p.nationality}
                  onChangeText={(txt) => updatePassenger(p.seat, { nationality: txt })}
                />
              </View>
            </View>

            {/* Gender Selection */}
            <Text style={styles.label}>Jinsia (Gender)</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity 
                onPress={() => updatePassenger(p.seat, { gender: 'male' })}
                style={[styles.genderBtn, p.gender === 'male' && styles.activeGender]}
              >
                <Icon name="gender-male" size={20} color={p.gender === 'male' ? '#7C3AED' : '#4B5563'} />
                <Text style={p.gender === 'male' ? styles.activeText : styles.inactiveText}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => updatePassenger(p.seat, { gender: 'female' })}
                style={[styles.genderBtn, p.gender === 'female' && styles.activeGender]}
              >
                <Icon name="gender-female" size={20} color={p.gender === 'female' ? '#7C3AED' : '#4B5563'} />
                <Text style={p.gender === 'female' ? styles.activeText : styles.inactiveText}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Save profile block */}
        <View style={styles.switchRow}>
          <Text style={styles.saveProfileLabel}>Hifadhi Profile kwa Safari za Baadaye</Text>
          <Switch value={saveProfile} onValueChange={setSaveProfile} thumbColor={saveProfile ? "#7C3AED" : "#9CA3AF"} />
        </View>
      </ScrollView>

      {/* Button review */}
      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={() => navigation.navigate('ReviewPayment')}
      >
        <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.gradientBtn}>
          <Text style={styles.btnText}>PitiaUhifadhi / REVIEW</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF' },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  passengerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12, color: '#7C3AED' },
  label: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12, color: '#000' },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12 },
  activeGender: { borderColor: '#7C3AED', backgroundColor: '#F3E8FF' },
  activeText: { fontWeight: '700', color: '#7C3AED' },
  inactiveText: { color: '#4B5563' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 16 },
  saveProfileLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  submitBtn: { margin: 16 },
  gradientBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});`,

    'ReviewPaymentScreen.tsx': `import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useBookingStore } from '../store/bookingStore';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ReviewPaymentScreen({ navigation }) {
  const { selectedSeats, useWallet, setUseWallet, paymentMethod, setPaymentMethod } = useBookingStore();
  const [coupon, setCoupon] = React.useState('');
  const [couponApplied, setCouponApplied] = React.useState(false);

  const priceVal = selectedSeats.length * 35000;
  const finalPrice = priceVal + 2500 - (couponApplied ? 5000 : 0) - (useWallet ? 15000 : 0);

  const paymentProviders = [
    { id: 'mpesa', name: 'M-Pesa', logo: 'phone', color: '#F87171' },
    { id: 'tigo', name: 'Tigo Pesa', logo: 'phone', color: '#60A5FA' },
    { id: 'airtel', name: 'Airtel Money', logo: 'phone', color: '#FCA5A5' },
    { id: 'visa', name: 'Visa / Card', logo: 'credit-card', color: '#3B82F6' }
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Booking Details Summary */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Safari Summary</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.sumKey}>Operator:</Text>
            <Text style={styles.sumVal}>Mabasi Maarufu Express</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.sumKey}>Njia (Route):</Text>
            <Text style={styles.sumVal}>Dar es Salaam → Mwanza</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.sumKey}>Seats Selected:</Text>
            <Text style={styles.sumVal}>{selectedSeats.join(', ')}</Text>
          </View>
        </View>

        {/* Coupons */}
        <View style={styles.couponCard}>
          <TextInput 
            placeholder="Weka Kuponi Code"
            style={styles.couponInput}
            value={coupon}
            onChangeText={setCoupon}
          />
          <TouchableOpacity onPress={() => setCouponApplied(true)} style={styles.couponBtn}>
            <Text style={styles.couponBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet toggle */}
        <View style={styles.panelRow}>
          <View>
            <Text style={styles.walletHeading}>Use Wallet Balance</Text>
            <Text style={styles.walletSub}>Salio: TZS 15,000 available</Text>
          </View>
          <Switch value={useWallet} onValueChange={setUseWallet} thumbColor="#7C3AED" />
        </View>

        {/* Payment Methods */}
        <Text style={styles.paymentTitle}>Select Payment Method</Text>
        <View style={styles.providerGrid}>
          {paymentProviders.map(prov => (
            <TouchableOpacity 
              key={prov.id} 
              onPress={() => setPaymentMethod(prov.id)}
              style={[styles.provBtn, paymentMethod === prov.id && styles.activeProv]}
            >
              <Icon name={prov.logo as any} size={28} color={prov.color} />
              <Text style={styles.provName}>{prov.name}</Text>
              {paymentMethod === prov.id && <View style={styles.activeDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Button submit checkout */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>TOTAL TO PAY</Text>
          <Text style={styles.totalVal}>TZS {finalPrice.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('BookingSuccess')}>
          <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.payGradient}>
            <Text style={styles.payText}>LIPA SASA</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  panel: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  panelTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sumKey: { color: '#6B7280', fontSize: 13 },
  sumVal: { fontWeight: '600', fontSize: 13 },
  couponCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 8, marginBottom: 16 },
  couponInput: { flex: 1, paddingHorizontal: 12, fontSize: 14 },
  couponBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  couponBtnText: { color: '#FFF', fontWeight: '700' },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 20 },
  walletHeading: { fontWeight: '700', fontSize: 14 },
  walletSub: { fontSize: 11, color: '#6B7280' },
  paymentTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  provBtn: { width: '47%', backgroundColor: '#FFF', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#F3F4F6', position: 'relative' },
  activeProv: { borderColor: '#7C3AED' },
  provName: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  activeDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', alignItems: 'center' },
  totalLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  totalVal: { fontSize: 18, fontWeight: '800', color: '#7C3AED' },
  checkoutBtn: { flex: 1, marginLeft: 16 },
  payGradient: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  payText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});`,

    'useFirebaseBooking.ts': `import { useEffect, useState } from 'react';
import { db } from '../firebase'; // Initialize standard Firebase SDK 
import { collection, addDoc, query, where, getDocs, onSnapshot, doc, setDoc } from 'firebase/firestore';

/**
 * Custom React Native Hook for synchronizing seats selection with Firebase Firestore.
 */
export function useFirebaseBooking(tripId: string) {
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to live seat bookings
  useEffect(() => {
    if (!tripId) return;

    const q = query(
      collection(db, 'bus_seat_bookings'),
      where('tripId', '==', tripId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const seats: string[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.seats) {
          seats.push(...data.seats);
        }
      });
      setBookedSeats(Array.from(new Set(seats)));
      setLoading(false);
    }, (error) => {
      console.error("Firebase realtime update failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId]);

  // Create real ticket booking with transaction validation
  const confirmBooking = async (bookingDetails: {
    customerId: string;
    customerPhone: string;
    customerEmail: string;
    seats: string[];
    pricePayable: number;
    passengers: any[];
    paymentProvider: string;
  }) => {
    try {
      const docRef = await addDoc(collection(db, 'bus_seat_bookings'), {
        tripId,
        ...bookingDetails,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString()
      });
      return { success: true, bookingId: docRef.id };
    } catch (err: any) {
      console.error("Firebase write error:", err);
      return { success: false, error: err.message };
    }
  };

  return { bookedSeats, loading, confirmBooking };
}
`
  };

  const renderTicketPass = (ticketData: any, printRef: any = null) => {
    const getNumericTicketId = (idStr: string): string => {
      if (!idStr) return '104928';
      const digitsOnly = idStr.replace(/\D/g, '');
      if (digitsOnly.length >= 6) {
        return digitsOnly;
      }
      let hash = 0;
      for (let i = 0; i < idStr.length; i++) {
        hash = (hash << 5) - hash + idStr.charCodeAt(i);
        hash = Math.abs(hash);
      }
      return ((hash % 90000) + 10000).toString() + (digitsOnly || '582');
    };

    const d_ticketId = getNumericTicketId(ticketData.ticketId || ticketData.id || ticketData.bookingId || ticketRefId || '104928').toUpperCase();
    const d_buyerName = ticketData.customerName || ticketData.buyerName || buyerName || 'Mteja Msafiri';
    const d_seats = ticketData.selectedSeats || (ticketData.items && ticketData.items[0]?.selectedSeats) || selectedSeats || ['18'];
    const d_busName = ticketData.busName || busName || 'Kilimanjaro Royal Bus';
    const d_origin = ticketData.origin || (ticketData.items && ticketData.items[0]?.origin) || origin || 'Dar es Salaam';
    const d_destination = ticketData.destination || (ticketData.items && ticketData.items[0]?.destination) || destination || 'Arusha';
    const d_travelDate = ticketData.travelDate || ticketData.departureDate || (ticketData.items && ticketData.items[0]?.departureDate) || travelDate;
    const d_departureTime = ticketData.departureTime || departureTime || '07:00 AM';
    const d_total = ticketData.totalAmount || ticketData.finalTotalAmount || finalTotalAmount;
    
    // Nauli breakdown
    const d_fare = ticketData.originalTotalPrice || (ticketData.items && ticketData.items[0]?.price * d_seats.length) || originalTotalPrice;
    const d_discount = ticketData.couponDiscount || (ticketData.isCouponApplied ? 14000 : 0) || couponDiscount;

    return (
      <div 
        ref={printRef}
        className="w-full relative overflow-hidden rounded-[2.5rem] border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl transition-all duration-200 select-text text-neutral-900 dark:text-neutral-100 font-sans print-ticket-card"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 items-stretch min-h-[460px]">
          
          {/* Main Ticket */}
          <div className="col-span-1 md:col-span-9 print:col-span-9 p-5 flex flex-col justify-between space-y-5 border-b md:border-b-0 md:border-r print:border-b-0 print:border-r border-dashed border-neutral-300 dark:border-neutral-800 relative">
            
            <div className="hidden md:block print:block absolute -right-3 -top-3 w-6 h-6 bg-neutral-100 dark:bg-neutral-950 rounded-full border border-neutral-200 dark:border-neutral-800 z-10" />
            <div className="hidden md:block print:block absolute -right-3 -bottom-3 w-6 h-6 bg-neutral-100 dark:bg-neutral-950 rounded-full border border-neutral-200 dark:border-neutral-800 z-10" />

            {/* UPPER BRANDING ACCENT SHEET WITH KILIMANJARO BACKDROP */}
            <div className="relative rounded-[1.75rem] overflow-hidden bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 h-44 text-white shadow-md p-5 flex flex-col justify-between">
              
              <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none select-none">
                <svg viewBox="0 0 800 200" className="w-full h-full object-cover" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="scenic-sky-generic" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e3a8a" />
                      <stop offset="50%" stopColor="#1d4ed8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>
                  <rect width="800" height="200" fill="url(#scenic-sky-generic)" />
                  <polygon points="120,200 300,40 480,200" fill="#0f172a" opacity="0.6"/>
                  <polygon points="180,200 300,50 420,200" fill="#1e293b" />
                  <polygon points="265,95 300,50 335,95 320,85 300,98 280,85" fill="#ffffff" />
                  <circle cx="650" cy="70" r="25" fill="#facc15" opacity="0.8" />
                  <path d="M0,170 Q200,140 400,170 T820,150 L800,200 L0,200 Z" fill="#15803d" />
                  <path d="M0,185 Q300,170 600,185 T800,175 L800,200 L0,200 Z" fill="#166534" />
                  <path d="M100,180 L100,165 M90,165 L115,165 M85,160 Q100,155 120,160 Z" stroke="#064e3b" strokeWidth="2.5" fill="#064e3b"/>
                  <path d="M680,185 L680,168 M670,168 L695,168 M660,163 Q680,158 700,163 Z" stroke="#064e3b" strokeWidth="2.5" fill="#064e3b"/>
                  <g transform="translate(480, 145) scale(0.6)">
                    <rect x="0" y="5" width="125" height="42" rx="10" fill="#ffffff" />
                    <rect x="100" y="10" width="22" height="15" rx="3" fill="#0f172a" />
                    <rect x="80" y="10" width="16" height="15" fill="#1d4ed8" />
                    <rect x="15" y="10" width="60" height="15" fill="#1d4ed8" />
                    <circle cx="25" cy="48" r="9" fill="#000" />
                    <circle cx="25" cy="48" r="4" fill="#64748b" />
                    <circle cx="98" cy="48" r="9" fill="#000" />
                    <circle cx="98" cy="48" r="4" fill="#64748b" />
                    <path d="M5,25 L120,25" stroke="#22c55e" strokeWidth="3" />
                  </g>
                </svg>
              </div>

              {/* Dynamic route/ticket number and bus shape overlay match */}
              <div className="absolute right-50 bottom-16 z-10 hidden sm:flex print:flex items-center gap-1.5 opacity-90 scale-90">
                <span className="text-[10px] font-mono font-black tracking-widest text-[#22c55e] bg-black/45 px-2.5 py-1 rounded border border-white/10 uppercase">
                  NO: {d_ticketId}
                </span>
              </div>

              <div className="relative z-10 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-md">
                    <span className="text-xl">🚌</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[8px] bg-red-600 font-black text-white px-2 py-0.5 rounded uppercase tracking-wider">
                        PREMIUM INTER-REGIONAL
                      </span>
                      <span className="text-[8px] bg-violet-600 font-extrabold text-white px-2 py-0.5 rounded uppercase tracking-wider">
                        PAPO HAPO
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-black uppercase tracking-tight leading-none mt-1 text-white">
                      {d_origin.toUpperCase()} TU {d_destination.toUpperCase()}
                    </h4>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-[9.5px] bg-white/20 backdrop-blur-sm border border-white/35 text-white font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    BOARDING PASS
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-tight text-emerald-300 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> CONFIRMED STATUS
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex justify-between items-end border-t border-white/15 pt-2">
                <div className="flex flex-col text-left">
                  <span className="text-[9.5px] text-sky-205 font-black uppercase tracking-widest leading-none">
                    TIKETI YA ABIRIA (TRAVEL TICKET)
                  </span>
                  <span className="text-[9px] text-white/95 font-extrabold uppercase mt-0.5">
                    Mtoa Huduma: <span className="text-amber-300">{d_busName}</span>
                  </span>
                </div>
                <div className="text-right font-mono text-[9.5px] font-extrabold text-amber-200">
                  Ticket ID: {d_ticketId}
                </div>
              </div>
            </div>

            {/* TWO-COLUMN DETAILED DATA GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-5 gap-y-4 text-xs font-semibold">
              <div className="col-span-2 print:col-span-2 py-1.5 border-b border-neutral-105 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  JINA LA ABIRIA (PASSENGER NAME)
                </span>
                <p className="font-extrabold text-neutral-900 dark:text-white text-sm uppercase leading-none mt-2 font-sans truncate">
                  {d_buyerName}
                </p>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-105 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  KITI (SEAT NO)
                </span>
                <p className="font-black text-violet-600 dark:text-violet-404 text-base leading-none mt-2 font-mono">
                  {Array.isArray(d_seats) ? d_seats.join(', ') : d_seats}
                </p>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-105 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  NAMBA YA BASI
                </span>
                <p className="font-extrabold text-neutral-800 dark:text-neutral-200 text-xs mt-2 uppercase">
                  T 315 DCS (AC)
                </p>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-150 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  KUTOKA (FROM)
                </span>
                <p className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm uppercase mt-1.5 font-sans leading-none">
                  {d_origin}
                </p>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 block mt-1 font-medium font-sans">Bus Terminal Center</span>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-110 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  KWENDA (TO)
                </span>
                <p className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm uppercase mt-1.5 font-sans leading-none">
                  {d_destination}
                </p>
                <span className="text-[8px] text-neutral-400 dark:text-neutral-500 block mt-1 font-medium font-sans">Destination Hub</span>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-150 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  TAREHE YA SAFARI
                </span>
                <p className="font-extrabold text-neutral-850 dark:text-neutral-200 text-xs mt-2 uppercase font-sans">
                  {d_travelDate}
                </p>
              </div>

              <div className="col-span-1 print:col-span-1 py-1.5 border-b border-neutral-110 dark:border-neutral-800">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase block leading-none tracking-wider">
                  MUDA WA BASI (TIME)
                </span>
                <p className="font-extrabold text-neutral-850 dark:text-neutral-200 text-xs mt-2 uppercase font-sans">
                  {d_departureTime}
                </p>
              </div>
            </div>

            {/* LOWER GHARAMA/MALIPO BANNER WITH QR CODE */}
            <div className="bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800 p-4 rounded-3xl grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-4 items-center">
              <div className="col-span-1 sm:col-span-6 print:col-span-6 space-y-1 text-[11px] font-semibold">
                <span className="text-[9px] font-black text-violet-750 dark:text-violet-405 uppercase tracking-widest block mb-1">
                  Gharama za Safari (Malipo)
                </span>
                <div className="flex justify-between border-b border-neutral-200/50 dark:border-neutral-800 pb-1">
                  <span className="text-neutral-400 font-bold">Nauli Kuu (Fare):</span>
                  <span className="text-neutral-800 dark:text-neutral-250 font-mono font-bold">TZS {d_fare ? d_fare.toLocaleString() : '35,000'}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-200/50 dark:border-neutral-800 pb-1">
                  <span className="text-neutral-400 font-bold">Punguzo / Waive:</span>
                  <span className="text-red-500 dark:text-red-400 font-mono font-bold">-{d_discount ? d_discount.toLocaleString() : '0'}</span>
                </div>
                <div className="flex justify-between pt-0.5 font-black text-neutral-900 dark:text-white">
                  <span className="uppercase text-[9px] tracking-tight">JUMLA KUU:</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">TZS {d_total ? d_total.toLocaleString() : '35,000'}</span>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-3 print:col-span-3 flex flex-col items-center justify-center text-center p-1 border-l border-r border-neutral-200/60 dark:border-neutral-800">
                <div className="w-16 h-16 bg-white p-1 rounded-xl border border-neutral-200 flex items-center justify-center shadow-sm select-none">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(d_ticketId)}`}
                    alt="LIPA QR"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[7.5px] font-black uppercase text-neutral-450 dark:text-neutral-550 tracking-wide mt-1.5 block leading-none">
                  LIPA KIELEKTRONIKI
                </span>
              </div>

              <div className="col-span-1 sm:col-span-3 print:col-span-3 text-center sm:text-right space-y-1 font-mono">
                <span className="text-[8px] font-bold text-neutral-400 uppercase block tracking-wider">SIMBA-PAY NO</span>
                <p className="text-[10px] font-black text-neutral-800 dark:text-neutral-205 tracking-tight leading-none">{d_ticketId}</p>
                
                <div className="h-6 w-full flex items-stretch gap-[1.5px] justify-center sm:justify-end opacity-75 mt-2">
                  {Array.from({ length: 22 }).map((_, bIdx) => {
                    const widths = ['w-[1px]', 'w-[2px]', 'w-[3px]', 'w-[0.5px]'];
                    const chosenWidth = widths[bIdx % widths.length];
                    return (
                      <div key={`ticket-sub-bar-${bIdx}`} className={`bg-neutral-900 dark:bg-neutral-205 ${chosenWidth}`} />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center text-[8.5px] font-extrabold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider leading-none border-t border-neutral-100 dark:border-neutral-800 pt-3 gap-2">
              <span>⚠️ HAKUNA KURUDISHA NAULI • MASHARTS YANAZINGATIWA • KUPITIA PAPO HAPO</span>
              <span>Msaada wa Wateja: +255 711 123 456</span>
            </div>
          </div>

          {/* Passenger Stub */}
          <div className="col-span-1 md:col-span-3 print:col-span-3 p-5 bg-neutral-50/50 dark:bg-neutral-950/25 flex flex-col justify-between space-y-5 relative">
            <div className="hidden md:block print:block absolute left-0 top-0 bottom-0 border-l border-dashed border-neutral-200 dark:border-neutral-800" />

            <div className="rounded-xl bg-violet-600 dark:bg-violet-955 p-3.5 text-white text-center shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-550 to-indigo-750 opacity-90" />
              <div className="relative z-10 flex flex-col items-center">
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">
                  Traveler Copy
                </span>
                <h4 className="text-xs font-extrabold uppercase mt-1.5 leading-tight">
                  PASSENGER STUB
                </h4>
                <p className="text-[9px] text-amber-250 font-black uppercase mt-0.5 truncate tracking-wide">
                  {d_origin.substring(0, 3).toUpperCase()} ➔ {d_destination.substring(0, 3).toUpperCase()}
                </p>
                <span className="text-[7px] text-white/70 block uppercase font-mono font-bold mt-1">Platform: PAPO HAPO</span>
              </div>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                <span className="text-[8.5px] font-bold text-neutral-400 block leading-none">Ticket Number</span>
                <p className="font-extrabold text-neutral-850 dark:text-neutral-105 font-mono mt-1 text-[10px] uppercase font-bold text-violet-650 dark:text-violet-400">
                  {d_ticketId}
                </p>
              </div>

              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                <span className="text-[8.5px] font-bold text-neutral-400 block leading-none">Abiria (Name)</span>
                <p className="font-extrabold text-neutral-850 dark:text-neutral-105 mt-1 truncate uppercase">
                  {d_buyerName}
                </p>
              </div>

              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                <span className="text-[8.5px] font-bold text-neutral-400 block leading-none">Njia (Route)</span>
                <p className="font-extrabold text-neutral-800 dark:text-neutral-200 mt-1 uppercase text-[11px]">
                  {d_origin.substring(0, 3).toUpperCase()} ➔ {d_destination.substring(0, 3).toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                <div>
                  <span className="text-[8.5px] font-bold text-neutral-400 block leading-none">Kiti No</span>
                  <p className="font-bold text-violet-600 dark:text-violet-404 mt-1 font-mono">
                    {Array.isArray(d_seats) ? d_seats.join(',') : d_seats}
                  </p>
                </div>
                <div>
                  <span className="text-[8.5px] font-bold text-neutral-400 block leading-none">Nauli</span>
                  <p className="font-bold text-neutral-850 dark:text-neutral-300 mt-1 font-mono text-[10px]">
                    TZS {d_total ? d_total.toLocaleString() : '35,000'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center pt-2">
              <div className="w-20 h-20 bg-white p-1 rounded-2xl border border-neutral-200 flex items-center justify-center shadow-sm select-none">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(d_ticketId)}`}
                  alt="Official QR Pass"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[8px] font-black text-neutral-405 dark:text-neutral-500 uppercase tracking-widest mt-1.5">
                OFFICIAL QR PASS
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  };

  if (standalone) {
    return (
      <div className="w-full flex flex-col font-sans transition-colors duration-200">
        
        {/* 1. PROGRESSIVE HEADER */}
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-850 rounded-3xl p-4 md:p-6 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onBackToTripSelection && (
              <button 
                onClick={onBackToTripSelection}
                className="p-2 sm:p-2.5 bg-neutral-105 dark:bg-neutral-800 hover:bg-violet-605 dark:hover:bg-violet-600 hover:text-white dark:hover:text-white rounded-xl text-neutral-850 dark:text-neutral-200 transition-all active:scale-95 shrink-0"
                title="Rudi kwenye Orodha"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg md:text-xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight leading-none truncate uppercase font-sans">
                {busName}
              </h2>
              <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-bold mt-1.5 uppercase tracking-wide truncate">
                {origin} → {destination} • {travelDate} | {departureTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar py-1">
            {[
              { label: 'Viti (Seats)', stepNum: 1 },
              { label: 'Wasafiri (Details)', stepNum: 2 },
              { label: 'Hakiki & Lipa (Review)', stepNum: 3 },
              { label: 'Risiti (Ticket)', stepNum: 4 }
            ].map((s, sIdx) => (
              <React.Fragment key={`stepper-act-${s.stepNum}`}>
                {sIdx > 0 && <div className={`w-4 sm:w-6 h-0.5 rounded ${step >= s.stepNum ? 'bg-violet-600' : 'bg-neutral-250 dark:bg-neutral-850'}`} />}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step === s.stepNum 
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/10' 
                      : step > s.stepNum 
                        ? 'bg-green-500 text-white' 
                        : 'bg-neutral-105 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-550'
                  }`}>
                    {step > s.stepNum ? '✓' : s.stepNum}
                  </div>
                  <span className={`text-[10px] sm:text-xs ${step === s.stepNum ? 'text-neutral-900 dark:text-neutral-50 font-black' : 'text-neutral-400 dark:text-neutral-500 font-semibold'}`}>
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Sub Navigation to switch between New Booking flow and Booked Tickets History list */}
        <div className="mb-6 flex flex-col xs:flex-row justify-between items-stretch xs:items-center bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-850 p-2 rounded-2xl shadow-sm gap-2 transition-colors">
          <div className="flex gap-2 w-full xs:w-auto font-sans">
            <button
              onClick={() => {
                setShowMyTickets(false);
                setViewingTicketDetail(null);
              }}
              className={`flex-1 xs:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                !showMyTickets 
                  ? 'bg-violet-600 text-white shadow-md' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              🚌 Kata Tiketi mpya
            </button>
            <button
              onClick={() => {
                setShowMyTickets(true);
                setViewingTicketDetail(null);
              }}
              className={`flex-1 xs:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 relative ${
                showMyTickets 
                  ? 'bg-violet-600 text-white shadow-md' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              🎟️ Tiketi Zangu
              {myTicketsList.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-500 text-[10px] font-black italic rounded-full flex items-center justify-center text-white scale-90 select-none animate-bounce">
                  {myTicketsList.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950/40 rounded-xl border border-neutral-200/50 dark:border-neutral-830">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-450 dark:text-neutral-500 font-black">
              Mfumo uko Live (Online)
            </span>
          </div>
        </div>

        {/* CONDITIONALLY RENDER MY BOOKED TICKETS SECTION OR STANDARD STEP FLOW */}
        {showMyTickets ? (
          <div className="space-y-6 font-sans">
            
            {/* If viewing a single ticket boarding pass detail */}
            {viewingTicketDetail ? (
              <div className="space-y-6">
                <div className="flex flex-col xs:flex-row justify-between items-stretch xs:items-center bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-850 p-4 rounded-3xl shadow-sm gap-3 transition-colors print:hidden">
                  <button
                    onClick={() => setViewingTicketDetail(null)}
                    className="px-4 py-2.5 bg-neutral-105 dark:bg-neutral-800 hover:bg-violet-600 dark:hover:bg-violet-600 text-xs text-neutral-850 dark:text-neutral-200 hover:text-white dark:hover:text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Rudi (Back)
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const tId = viewingTicketDetail.ticketId || viewingTicketDetail.id || viewingTicketDetail.bookingId || '104928';
                        const bName = viewingTicketDetail.busName || viewingTicketDetail.name || 'Kilimanjaro Royal Bus';
                        downloadTicketAsImage(viewingTicketRef.current, tId, bName);
                      }}
                      className="flex-1 xs:flex-none px-4 py-2.5 bg-violet-600 hover:bg-violet-750 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span>Pakua (Download PNG) 📥</span>
                    </button>

                    <button
                      onClick={() => {
                        window.print();
                      }}
                      className="flex-1 xs:flex-none px-4 py-2.5 bg-neutral-900 border border-neutral-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <span>Print (PDF) 🖨️</span>
                    </button>
                  </div>
                </div>

                <div id="my-ticket-detail-render" className="p-1 rounded-[2.5rem] bg-white dark:bg-neutral-100 printable-ticket-view">
                  {renderTicketPass(viewingTicketDetail, viewingTicketRef)}
                </div>
              </div>
            ) : (
              // MULTI-TAB SCENIC TICKETS HISTORY ARCHITECTURE (matching Image 1)
              <div className="space-y-6">
                
                {/* 3 tabs: Upcoming, Completed, Cancelled */}
                <div className="grid grid-cols-3 gap-1 bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-850 p-1 rounded-2xl shadow-sm">
                  {[
                    { id: 'upcoming', label: 'Zinazokuja' },
                    { id: 'completed', label: 'Zilizopita' },
                    { id: 'cancelled', label: 'Zilizofutwa' }
                  ].map((tab) => {
                    const isActive = activeTicketsTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTicketsTab(tab.id as any)}
                        className={`py-3 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all leading-none ${
                          isActive
                            ? 'bg-violet-600 text-white shadow-sm font-bold'
                            : 'text-neutral-450 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-850/40'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {myTicketsLoading ? (
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-805 rounded-3xl p-16 text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-violet-600 animate-spin mx-auto" />
                    <p className="text-xs uppercase font-mono tracking-widest text-neutral-400 dark:text-neutral-500 font-extrabold animate-pulse">
                      Inajaza taarifa za safari...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Filter local booking orders */}
                    {(() => {
                      const filtered = myTicketsList.filter((ticket) => {
                        const s_status = (ticket.status || 'pending').toLowerCase();
                        
                        if (activeTicketsTab === 'cancelled') {
                          return s_status === 'cancelled' || s_status === 'failed';
                        }
                        
                        let isPast = false;
                        if (ticket.departureDate || ticket.travelDate) {
                          const dateVal = ticket.travelDate || ticket.departureDate;
                          const dateObj = new Date(dateVal);
                          if (!isNaN(dateObj.getTime())) {
                            isPast = dateObj.getTime() < new Date().setHours(0,0,0,0);
                          }
                        }
                        
                        if (activeTicketsTab === 'completed') {
                          return s_status === 'completed' || isPast;
                        }
                        
                        return s_status !== 'cancelled' && s_status !== 'failed' && !isPast;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-805 rounded-3xl p-12 text-center space-y-4 shadow-sm transition-colors">
                            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                              <span className="text-3xl">🎟️</span>
                            </div>
                            <div className="space-y-1.5 max-w-sm mx-auto">
                              <h4 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-200 uppercase tracking-tight">Hukuna tiketi zenye hadhi hii</h4>
                              <p className="text-xs text-neutral-401 dark:text-neutral-500 leading-relaxed">Hauna tiketi yoyote hapa. Unaweza kukata tiketi yako sasa hivi kwa sekunde chache.</p>
                            </div>
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  setShowMyTickets(false);
                                  setViewingTicketDetail(null);
                                }}
                                className="px-5 py-3.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                              >
                                🚌 Kata tiketi yako sasa!
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3.5">
                          {filtered.map((ticket) => {
                            const d_id = ticket.id;
                            const d_busName = ticket.busName || (ticket.items && ticket.items[0]?.name?.split(' - ')[0]) || 'Simba Express';
                            const d_seats = ticket.selectedSeats || (ticket.items && ticket.items[0]?.selectedSeats) || [];
                            const d_from = ticket.origin || (ticket.items && ticket.items[0]?.origin) || 'Dar es Salaam';
                            const d_to = ticket.destination || (ticket.items && ticket.items[0]?.destination) || 'Arusha';
                            const d_date = ticket.travelDate || ticket.departureDate || (ticket.items && ticket.items[0]?.departureDate) || 'Today';
                            const d_price = ticket.totalAmount || ticket.finalTotalAmount || 35000;

                            return (
                              <div
                                key={`history-tkt-${d_id}`}
                                className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-805 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-l-4 border-l-violet-600"
                              >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className="w-12 h-12 rounded-2xl bg-neutral-105 dark:bg-neutral-850 flex items-center justify-center text-xl shrink-0">
                                    🚌
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="text-xs sm:text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                                        {d_busName}
                                      </h4>
                                      <span className="px-2 py-0.5 bg-neutral-105 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[9px] font-bold uppercase tracking-wide">
                                        Viti: {d_seats.join(', ') || 'N/A'}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3.5 py-1 text-xs">
                                      <div className="min-w-[80px] shrink-0 font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-tight truncate leading-none font-sans">
                                        {d_from}
                                      </div>
                                      
                                      <div className="flex-1 flex items-center justify-center gap-1 min-w-[60px] relative">
                                        <div className="border-b border-dashed border-neutral-300 dark:border-neutral-800 w-full relative top-[1px]" />
                                        <div className="absolute bg-white dark:bg-neutral-900 px-1.5 text-violet-500 scale-90">
                                          🚌
                                        </div>
                                      </div>
                                      
                                      <div className="min-w-[80px] text-right shrink-0 font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-tight truncate leading-none font-sans">
                                        {d_to}
                                      </div>
                                    </div>

                                    <div className="text-[10px] text-neutral-450 dark:text-neutral-500 font-bold uppercase tracking-wide flex flex-wrap gap-x-3 gap-y-1">
                                      <span>Tarehe: {d_date}</span>
                                      <span>•</span>
                                      <span>Ondoka: {departureTime}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex sm:flex-row md:flex-col items-center justify-between md:justify-center md:items-end gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-805">
                                  <div className="text-left md:text-right">
                                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold block leading-none">Jumla ya Malipo</span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 block font-sans">
                                      TZS {d_price.toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setViewingTicketDetail(ticket)}
                                      className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-950 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm shrink-0 font-sans"
                                    >
                                      Fungua Tiketi / View Boarding Pass 🎟️
                                    </button>
                                  </div>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}

              </div>
            )}

          </div>
        ) : step < 4 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT SIDE PANEL (Active Step Forms) - 7 cols */}
            <div className="col-span-1 lg:col-span-7 space-y-5">
              
              {/* STEP 1: SEAT SELECTION */}
              {step === 1 && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-805 rounded-[1.75rem] p-4 sm:p-6 shadow-sm space-y-5 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                    <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 uppercase tracking-tight flex items-center gap-2 font-sans">
                       Chagua Nafasi ya Kiti <span className="text-[11px] text-neutral-400 lowercase italic font-medium">(Choose seat numbers)</span>
                    </h3>
                    <div className="bg-neutral-100 dark:bg-neutral-800 p-1 flex gap-1 border border-neutral-200 dark:border-neutral-700 max-w-sm sm:w-56 shadow-inner shrink-0 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setActiveDeck('lower')}
                        className={`flex-1 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${activeDeck === 'lower' ? 'bg-white dark:bg-neutral-900 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-200 dark:hover:bg-neutral-750/50'}`}
                      >
                        Lower (Chini)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveDeck('upper')}
                        className={`flex-1 py-1.5 text-[10px] sm:text-xs font-black rounded-lg transition-all ${activeDeck === 'upper' ? 'bg-white dark:bg-neutral-900 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-200 dark:hover:bg-neutral-750/50'}`}
                      >
                        Upper (Juu)
                      </button>
                    </div>
                  </div>

                  {/* Steering wheel illustration */}
                  <div className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-950/40 p-3 sm:p-4 rounded-2xl border border-neutral-200 dark:border-neutral-850">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-450 animate-spin-slow">
                        ⚙️
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase leading-none">Mbele ya Basi</span>
                        <p className="text-xs font-black text-neutral-800 dark:text-neutral-200 leading-none mt-0.5 font-sans">Driver Cabin</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase bg-neutral-150 dark:bg-neutral-850 px-2.5 py-1 rounded-lg">40 Viti (Seats) Max</span>
                  </div>

                  {/* Main Interactive Seat Selection Grid */}
                  <div className="bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-200/50 dark:border-neutral-850 rounded-2xl p-3 sm:p-5">
                    <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 sm:pr-2 no-scrollbar">
                      {Array.from({ length: 10 }).map((_, rIndex) => {
                        const base = activeDeck === 'lower' ? 0 : 40;
                        const seat1 = String(base + (rIndex * 4 + 1));
                        const seat2 = String(base + (rIndex * 4 + 2));
                        const seat3 = String(base + (rIndex * 4 + 3));
                        const seat4 = String(base + (rIndex * 4 + 4));

                        const renderSeatBtn = (seatNum: string) => {
                          const isBooked = bookedSeats.includes(seatNum);
                          const isFemale = femaleOccupiedSeats.includes(seatNum);
                          const isVIP = vipSeats.includes(seatNum);
                          const isSelected = selectedSeats.includes(seatNum);

                          return (
                            <button
                              key={`resp-seat-btn-${seatNum}`}
                              type="button"
                              onClick={() => toggleSeat(seatNum)}
                              className={`aspect-square w-full rounded-xl flex flex-col items-center justify-center text-[11px] font-black border transition-all relative ${
                                isBooked ? 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 opacity-40 cursor-not-allowed' :
                                isFemale ? 'bg-pink-100 dark:bg-pink-950/20 border-pink-300 dark:border-pink-850 hover:bg-pink-100 text-pink-600 dark:text-pink-400 font-extrabold shadow-sm' :
                                isSelected ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-violet-500 scale-105 shadow-md shadow-violet-500/20' :
                                isVIP ? 'bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 hover:bg-amber-100/60 text-amber-805 dark:text-amber-400 hover:border-amber-500' :
                                'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-violet-500 text-neutral-800 dark:text-neutral-205 hover:bg-violet-50/20 dark:hover:bg-violet-900/10'
                              }`}
                            >
                              {isFemale ? (
                                <span className="text-[14px]">👱‍♀️</span>
                              ) : isVIP && !isSelected ? (
                                <span className="text-[13px] text-amber-600 font-sans">👑</span>
                              ) : (
                                <span className="text-[14px] opacity-75">🪑</span>
                              )}
                              <span className="text-[9px] mt-0.5 leading-none font-bold">{seatNum}</span>
                              {isVIP && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                            </button>
                          );
                        };

                        return (
                          <div key={`resp-row-${rIndex}`} className="grid grid-cols-5 gap-2.5 items-center">
                            <div className="col-span-2 grid grid-cols-2 gap-2.5">
                              {renderSeatBtn(seat1)}
                              {renderSeatBtn(seat2)}
                            </div>
                            <div className="text-center text-[9px] uppercase font-black tracking-widest text-neutral-300 dark:text-neutral-700 select-none font-sans">
                              Aisle
                            </div>
                            <div className="col-span-2 grid grid-cols-2 gap-2.5">
                              {renderSeatBtn(seat3)}
                              {renderSeatBtn(seat4)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legends list */}
                  <div className="border-t border-neutral-100 dark:border-neutral-805 pt-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 leading-none">Legend (Alama za Viti)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-[10px] font-bold text-neutral-605 dark:text-neutral-400 font-sans">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" />
                        <span>Wazi (Free)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gradient-to-r from-violet-605 to-fuchsia-650" />
                        <span>Chaguo Lako</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 opacity-45" />
                        <span>Imejaa</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-pink-100 dark:bg-pink-950/20 border border-pink-300 flex items-center justify-center text-[9px]">👱‍♀️</div>
                        <span>Kike (Female)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-400 flex items-center justify-center text-[9px]">👑</div>
                        <span>VIP Class</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PASSENGER FORMS */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-4 rounded-2xl shadow-sm text-xs font-bold text-neutral-700 dark:text-neutral-300 flex justify-between items-center transition-colors">
                    <span>Katiza maelezo sahihi kiti chako kithibitishwe</span>
                    <span className="px-2.5 py-1 bg-violet-100 dark:bg-violet-900/20 text-violet-750 dark:text-violet-400 rounded-full font-black text-[10px] uppercase">
                      Traveler Profiles Needed
                    </span>
                  </div>

                  {passengers.map((p, idx) => (
                    <div key={`p-desc-${p.seat}`} className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-5 rounded-[1.75rem] shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-805 pb-2.5">
                        <h4 className="text-xs font-black text-violet-700 dark:text-violet-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                          👤 Passenger {idx + 1}
                        </h4>
                        <span className="text-[10px] bg-violet-600 text-white font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                          Seat {p.seat}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Jina Kamili (Full Name)</label>
                          <input 
                            type="text" 
                            className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-950 dark:text-neutral-50 focus:border-violet-500 transition-colors"
                            placeholder="Mf. Mfalme Juma"
                            value={p.fullName}
                            onChange={(e) => {
                              const list = [...passengers];
                              list[idx].fullName = e.target.value;
                              setPassengers(list);
                            }}
                          />
                          {errors[`name-${p.seat}`] && (
                            <p className="text-[9px] text-red-500 font-extrabold">{errors[`name-${p.seat}`]}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Umri (Age)</label>
                          <input 
                            type="number" 
                            className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-955 dark:text-neutral-50 focus:border-violet-500"
                            placeholder="Mf. 28"
                            value={p.age}
                            onChange={(e) => {
                              const list = [...passengers];
                              list[idx].age = e.target.value;
                              setPassengers(list);
                            }}
                          />
                          {errors[`age-${p.seat}`] && (
                            <p className="text-[9px] text-red-500 font-extrabold">{errors[`age-${p.seat}`]}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Utaifa (Nationality)</label>
                          <select 
                            className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-955 dark:text-neutral-50 focus:border-violet-500"
                            value={p.nationality}
                            onChange={(e) => {
                              const list = [...passengers];
                              list[idx].nationality = e.target.value;
                              setPassengers(list);
                            }}
                          >
                            <option value="Tanzanian">🇹🇿 Mtanzania</option>
                            <option value="Kenyan">🇰🇪 Mkenya</option>
                            <option value="Ugandan">🇺🇬 Mganda</option>
                            <option value="Rwandan">🇷🇼 Mnyarwanda</option>
                            <option value="Other">🌍 Raia wa Kigeni / Other</option>
                          </select>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">Jinsia (Gender)</label>
                          <div className="flex gap-2.5 font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...passengers];
                                list[idx].gender = 'male';
                                setPassengers(list);
                              }}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-2 transition-all ${
                                p.gender === 'male'
                                  ? 'border-violet-605 bg-violet-100/10 text-violet-700 dark:text-violet-400 font-black'
                                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400'
                              }`}
                            >
                              <span>👨</span> Male
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...passengers];
                                list[idx].gender = 'female';
                                setPassengers(list);
                              }}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-2 transition-all ${
                                p.gender === 'female'
                                  ? 'border-fuchsia-605 bg-fuchsia-100/10 text-fuchsia-700 dark:text-fuchsia-400 font-black'
                                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400'
                              }`}
                            >
                              <span>👩</span> Female
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Buyer detail box */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-5 rounded-[1.75rem] shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-100 dark:border-neutral-805 pb-2 font-sans">
                      📦 Taarifa za Mnunuzi (Billing Contact)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Jina la Mnunuzi</label>
                        <input 
                          type="text"
                          className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-955 dark:text-neutral-50 focus:border-violet-500"
                          placeholder="Juma Selemani"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Namba ya Simu</label>
                        <input 
                          type="text"
                          className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-805 text-xs font-bold text-neutral-955 dark:text-neutral-50 focus:border-violet-500"
                          placeholder="+255 712 345678"
                          value={buyerPhone}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Email Address</label>
                        <input 
                          type="email"
                          className="w-full h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-955 dark:text-neutral-50 focus:border-violet-500"
                          placeholder="abiria@gmail.com"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW DETAILS AND NETWORKS ACCENTS */}
              {step === 3 && (
                <div className="space-y-5">
                  {/* Passenger names review */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-5 rounded-[1.75rem] shadow-sm space-y-3 font-sans">
                    <h4 className="text-xs font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-widest border-b border-neutral-100 dark:border-neutral-800 pb-2.5 flex items-center gap-1.5 font-sans">
                       Hakiki Orodha ya Wasafiri (Traveling Details)
                    </h4>
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {passengers.map((p, idx) => (
                        <div key={`resp-rev-${p.seat}`} className="flex justify-between items-center text-xs py-2 border-b border-neutral-50 dark:border-neutral-805 last:border-0 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-[10px] font-black text-neutral-700 dark:text-neutral-205">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-neutral-955 dark:text-neutral-50 leading-none">{p.fullName || 'Abiria (Passenger)'}</p>
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 leading-none">Jinsia: {p.gender === 'male' ? 'Kiume' : 'Kike'} | Utaifa: {p.nationality} ({p.age} Yrs)</p>
                            </div>
                          </div>
                          <span className="bg-violet-50 dark:bg-violet-900/20 text-violet-750 dark:text-violet-400 font-black px-2.5 py-1 rounded-lg text-[10px] border border-violet-100/55 dark:border-violet-800">
                            Seat {p.seat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Wallet Balance toggle */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-5 rounded-2xl shadow-sm flex items-center justify-between transition-colors">
                    <div className="space-y-0.5 font-sans">
                      <div className="flex items-center gap-2 font-extrabold text-xs text-neutral-900 dark:text-neutral-100">
                        <Wallet className="w-4 h-4 text-violet-650 dark:text-violet-400" />
                        <span>Use Tigo Pesa Wallet Balance</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Balance: TZS 150,000</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setUseWallet(prev => !prev)}
                      className={`w-12 h-6.5 rounded-full p-1 transition-all ${useWallet ? 'bg-violet-600' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                    >
                      <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transition-all transform ${useWallet ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Payment provider selectors with colorful indicators */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 p-5 rounded-[1.75rem] shadow-sm space-y-3 font-sans">
                    <p className="text-[10px] font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-widest leading-none">Chagua Mtandao wa Lipa (Payment Channels)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'mpesa', name: 'M-Pesa', logo: '🔴' },
                        { id: 'tigo', name: 'Tigo Pesa', logo: '🔵' },
                        { id: 'airtel', name: 'Airtel Money', logo: '🔴' },
                        { id: 'halo', name: 'HaloPesa', logo: '🟠' },
                        { id: 'visa', name: 'Visa', logo: '💳' },
                        { id: 'mastercard', name: 'Mastercard', logo: '💳' }
                      ].map((prov) => (
                        <button
                          type="button"
                          key={`resp-prov-btn-${prov.id}`}
                          onClick={() => setPaymentMethod(prov.id)}
                          className={`p-3.5 rounded-2l border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                            paymentMethod === prov.id 
                              ? 'border-violet-600 bg-violet-50/20 dark:bg-violet-950/20 ring-2 ring-violet-500/10' 
                              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <span className="text-xl">{prov.logo}</span>
                          <span className="text-[10px] font-black uppercase text-neutral-800 dark:text-neutral-200 mt-0.5">{prov.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDE PANEL (Dynamic pricing summary invoice card) - 5 cols */}
            <div className="col-span-1 lg:col-span-5 h-full">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-[1.75rem] p-5 sm:p-6 shadow-sm space-y-5 flex flex-col justify-between h-full transition-colors">
                <div className="space-y-5">
                  
                  {/* Direct details brief */}
                  <div className="bg-violet-50/50 dark:bg-violet-950/15 p-4 rounded-2xl border border-violet-100/50 dark:border-violet-900/25 text-xs text-neutral-900 dark:text-neutral-50 transition-colors">
                    <span className="text-[9px] font-black bg-violet-600 text-white px-2.5 py-0.5 rounded uppercase tracking-wider">Muhtasari wa Nauli (Summary)</span>
                    <div className="flex justify-between items-center mt-3 font-extrabold text-neutral-850 dark:text-neutral-100">
                      <span>{origin}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-violet-500 font-extrabold" />
                      <span>{destination}</span>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-neutral-500 dark:text-neutral-400 leading-relaxed font-sans font-medium">
                      <p>• Operator: <b className="text-neutral-850 dark:text-neutral-100 font-bold">{busName}</b></p>
                      <p>• Tarehe (Date): <b className="text-neutral-850 dark:text-neutral-100 font-bold">{travelDate}</b></p>
                      <p>• Muda (Time): <b className="text-neutral-850 dark:text-neutral-100 font-bold font-sans">07:00 AM</b></p>
                      <p>• Viti Vilivyoteuliwa: <b className="text-violet-600 dark:text-violet-400 font-extrabold">{selectedSeats.join(', ') || 'N/A'}</b></p>
                    </div>
                  </div>

                  {/* Promo coupon input and validation feedback */}
                  {availableCoupons.length > 0 && (
                    <div className="space-y-1.5 font-sans">
                      <label className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none block">Weka Kuponi la Punguzo (Coupon Code)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="flex-1 h-11 bg-neutral-50 dark:bg-neutral-950 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-black text-neutral-955 dark:text-neutral-100 uppercase tracking-widest"
                          placeholder="Mf. MABASI20"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4.5 bg-neutral-900 dark:bg-neutral-800 hover:bg-violet-605 dark:hover:bg-violet-600 text-white rounded-xl text-xs font-black uppercase transition-colors"
                        >
                          Sajili
                        </button>
                      </div>
                      {isCouponApplied && appliedCoupon && (
                        <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50 p-2.5 rounded-xl flex items-center justify-between text-green-700 dark:text-green-400">
                          <span className="text-[10px] font-bold">✓ Punguzo Limesajiliwa ({appliedCoupon.code})</span>
                          <span className="text-[10px] font-black">-TZS {couponDiscount.toLocaleString()} Saved</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invoice breakdown table */}
                  <div className="space-y-2.5 border-t border-neutral-100 dark:border-neutral-805 pt-4">
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-500 dark:text-neutral-400">
                      <span>Nauli ({selectedSeats.length} Viti)</span>
                      <span className="tabular-nums font-black text-neutral-850 dark:text-neutral-200">
                        TZS {originalTotalPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-500 dark:text-neutral-400 font-sans">
                      <span>Kuponi ya Ofa</span>
                      <span className="tabular-nums text-green-600 dark:text-green-400 font-extrabold font-sans">
                        -TZS {couponDiscount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-500 dark:text-neutral-400 font-sans">
                      <span>Pochi ya Kidijitali</span>
                      <span className="tabular-nums text-green-600 dark:text-green-400 font-extrabold font-sans">
                        -TZS {walletDeduction.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-500 dark:text-neutral-400 font-sans">
                      <span>Ada ya Mfumo (Service Fee)</span>
                      <span className="tabular-nums font-black text-neutral-800 dark:text-neutral-200 font-sans">
                        TZS {serviceFee.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
                    <div className="flex justify-between items-center text-xs font-black uppercase text-neutral-950 dark:text-neutral-100 font-sans">
                      <span className="text-[10px] tracking-tight">Kiwango cha Kulipa</span>
                      <span className="text-base text-violet-600 dark:text-violet-400 tracking-tight font-black font-sans">
                        TZS {finalTotalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirm and travel CTA action */}
                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={step === 1 && selectedSeats.length === 0}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-650 to-fuchsia-650 hover:opacity-95 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-sans"
                  >
                    <span>
                      {step === 1 && "KATA TIKETI / PROCEED"}
                      {step === 2 && "HAKIKI MAELEZO / REVIEW"}
                      {step === 3 && `LIPA SASA (TZS ${finalTotalAmount.toLocaleString()})`}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <a
                    href={`https://wa.me/14155238886?text=${encodeURIComponent(`Hi! Nataka kukata tiketi ya basi kutoka ${product?.origin || 'Dar es Salaam'} kwenda ${product?.destination || 'Mwanza'} - Basi: ${product?.name}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Kata kwa WhatsApp Bot (Automatic)</span>
                  </a>

                  {step === 1 && selectedSeats.length === 0 && (
                    <p className="text-[10px] text-red-500 font-bold text-center mt-2 uppercase font-sans">Chagua angalau Kiti kimoja kwanza!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          
          /* STEP 4: PRINTABLE AND HIGH-FIDELITY MODERN TICKET ACCENT */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start printable-step-4-area">
            <div className="col-span-1 xl:col-span-8 space-y-6">
              
              {/* Congratulations Message Banner with Light Mode Harmony */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-3xl p-5 text-center space-y-2 print:hidden">
                <div className="flex justify-center">
                  <div className="relative w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-md">
                    <Check className="w-7 h-7 text-white stroke-[3.5]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">🎉 SAFARI YAKO IMETHIBITISHWA!</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase mt-1">Tiketi yako imetengenezwa vizuri. Unaweza kuipakua sasa hivi chini.</p>
                </div>
              </div>

              {/* Selector for Consolidated vs Individual Tickets */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200/65 dark:border-neutral-850 p-5 rounded-3xl shadow-sm space-y-4 mb-6 transition-colors print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-neutral-900 dark:text-neutral-50 flex items-center gap-1.5 font-sans">
                      <span>🎟️ Chaguzi za Kuchapa Tiketi (Ticket Print Options)</span>
                      <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-950 text-violet-750 dark:text-violet-300 text-[8.5px] rounded-full uppercase font-black tracking-wide">Mpya</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-bold uppercase mt-1">
                      Chagua kuprinti tiketi moja ya pamoja au kila abiria aweze kupata tiketi yake tofauti binafsi.
                    </p>
                  </div>

                  <div className="flex bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => setTicketPrintMode('consolidated')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        ticketPrintMode === 'consolidated'
                          ? 'bg-violet-600 text-white shadow-md font-bold'
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                      }`}
                    >
                      Tiketi Moja
                    </button>
                    <button
                      onClick={() => setTicketPrintMode('individual')}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        ticketPrintMode === 'individual'
                          ? 'bg-violet-600 text-white shadow-md font-bold'
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                      }`}
                    >
                      Kila Abiria (Individual)
                    </button>
                  </div>
                </div>
              </div>

              {ticketPrintMode === 'consolidated' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2 text-[10px] text-neutral-400 uppercase font-bold tracking-widest leading-none print:hidden">
                    <span>Tiketi ya Pamoja (Consolidated boarding pass)</span>
                    <span className="text-violet-600 dark:text-violet-400">Viti vyote vimetajwa pamoja</span>
                  </div>
                  <div className="p-1 bg-white dark:bg-neutral-950 rounded-[2.5rem] border border-neutral-150 dark:border-neutral-850 shadow-md">
                    {renderTicketPass({
                      ticketId: ticketRefId,
                      buyerName,
                      selectedSeats,
                      busName,
                      origin,
                      destination,
                      travelDate,
                      departureTime,
                      totalAmount: finalTotalAmount,
                      originalTotalPrice,
                      couponDiscount,
                      isCouponApplied,
                      passengers
                    }, ticketRef)}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2 text-[10px] text-neutral-400 uppercase font-bold tracking-widest border-b border-dashed border-neutral-200 dark:border-neutral-800 pb-2 print:hidden font-sans">
                    <span>Tiketi za Kila Abiria Binafsi ({passengers.length} Tickets)</span>
                    <span className="text-emerald-500">Kila kiti kina tiketi yake kamili</span>
                  </div>
                  
                  {passengers.map((passenger, pIdx) => {
                    const singleSeatTotal = finalTotalAmount / passengers.length;
                    const singleSeatFare = originalTotalPrice / passengers.length;
                    const singleSeatDiscount = couponDiscount / passengers.length;
                    const p_ticketId = `${ticketRefId || '93847291'}${passenger.seat}`;

                    return (
                      <div key={`p-tkt-frame-${pIdx}`} className="bg-neutral-55 dark:bg-neutral-950/20 p-4 border border-neutral-200/50 dark:border-neutral-850 shadow-sm rounded-[3rem] space-y-4 print-card-item">
                        <div className="flex items-center justify-between px-4 pb-1 print:hidden">
                          <h5 className="font-extrabold text-xs uppercase text-violet-600 dark:text-violet-400 tracking-wider font-sans">
                            👤 Abiria {pIdx + 1}: <span className="text-neutral-950 dark:text-white font-black">{passenger.fullName || buyerName || 'Mteja Msafiri'}</span> (Kiti: {passenger.seat})
                          </h5>
                        </div>
                        
                        <div id={`digital-individual-pass-${passenger.seat}`} className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-1">
                          {renderTicketPass({
                            ticketId: p_ticketId,
                            buyerName: passenger.fullName || buyerName || 'Mteja Msafiri',
                            selectedSeats: [passenger.seat],
                            busName,
                            origin,
                            destination,
                            travelDate,
                            departureTime,
                            totalAmount: singleSeatTotal,
                            originalTotalPrice: singleSeatFare,
                            couponDiscount: singleSeatDiscount,
                            isCouponApplied,
                            passengers: [passenger]
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: HIGHLY EXPLAINED DOWNLOADING DESKTOP & PRINT CTA BUTTONS */}
            <div className="col-span-1 xl:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 rounded-[2.25rem] p-6 shadow-sm flex flex-col justify-between space-y-6 font-sans print:hidden">
              
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
                  <h4 className="font-black text-xs uppercase text-neutral-900 dark:text-neutral-50 tracking-wider">
                    CHAGUA NJIA YA KUCHAPISHA
                  </h4>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-bold uppercase">
                  Chapa tiketi yako kwa PDF au karatasi safi kusafiri salama.
                </p>

                {/* Info Card box */}
                <div className="bg-neutral-55 sm:bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-850 text-[10.5px] font-bold text-neutral-600 dark:text-neutral-400 space-y-2.5">
                  <p className="flex items-start gap-2">
                    <span className="text-violet-600">✓</span>
                    <span>Sajili zilizowekwa hazipotei, ziko live kwenye hifadhi (Firebase).</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-violet-600">✓</span>
                    <span>Picha inajumuisha Kilimanjaro background mapambo yote ya kisasa.</span>
                  </p>
                </div>
              </div>

              {/* Direct Touch Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownloadTicketImage}
                  className="w-full py-4 bg-gradient-to-r from-violet-650 to-indigo-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-violet-500 shadow-md"
                >
                  📥 PAKUA TIKETI KAMA PICHA (DOWNLOAD)
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-4 bg-neutral-900 hover:bg-neutral-950 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-neutral-800 shadow-md"
                >
                  🖨️ CHAPISHA TIKETI (PRINT / PDF)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedSeats([]);
                  }}
                  className="w-full py-4 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-extrabold text-xs uppercase rounded-xl transition-all cursor-pointer"
                >
                  Katisha & Chagua upya / Nunua Mpya
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={standalone ? "w-full flex flex-col gap-0 bg-transparent text-neutral-900 dark:text-neutral-105 relative overflow-hidden select-none" : "w-full flex flex-col gap-8 bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-105 p-2 md:p-6 rounded-[2.5rem] border border-neutral-305 dark:border-neutral-800 shadow-2xl relative overflow-hidden transition-colors duration-200"}>
      
      {/* Background radial effects */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-violet-600/30 via-transparent to-transparent blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-fuchsia-600/20 via-transparent to-transparent blur-2xl" />
      </div>

      {/* Main Container Header */}
      {!standalone && (
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-250 dark:border-neutral-804 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-violet-500/20 text-violet-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-violet-500/30">
                Mabasi Maarufu Leo
              </span>
              <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-md text-[9px] font-mono tracking-widest uppercase border border-neutral-700/50">
                V2.1 - Luxury Edition
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 uppercase tracking-tighter">
              Premium Tanzanian Booking Architecture
            </h2>
            <p className="text-neutral-400 text-xs font-semibold">
              An interactive simulator representing full mobile screens paired with cross-platform React Native / NativeWind components.
            </p>
          </div>

          {onBackToTripSelection && (
            <button 
              type="button"
              onClick={onBackToTripSelection}
              className="px-5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl hover:bg-violet-600 hover:border-violet-500 hover:text-white transition-all text-xs font-bold flex items-center gap-2 text-neutral-300"
            >
              <ChevronLeft className="w-4 h-4" /> Safari Zingine (Other Trips)
            </button>
          )}
        </div>
      )}

      {/* Dual Panel workspace */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* LEFT COLUMN: The Interactive Phone Simulator (5 Cols) */}
        <div className={standalone ? "col-span-1 lg:col-span-12 flex justify-center" : "col-span-1 lg:col-span-5 flex justify-center"}>
          <div className="w-full max-w-[420px] aspect-[9/19.5] bg-neutral-900 rounded-[3rem] p-3.5 shadow-[0_0_80px_rgba(124,58,237,0.15)] border-[8px] border-neutral-800 relative flex flex-col overflow-hidden">
            
            {/* Phone Ear Speaker & Punch-hole Camera */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-40 h-5 bg-black rounded-full flex items-center justify-between px-6 z-50">
              <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full border border-neutral-800" />
              <div className="w-16 h-1 bg-neutral-850 rounded-full" />
              <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full" />
            </div>

            {/* Simulated Phone Status Bar */}
            <div className="flex items-center justify-between text-[11px] font-black text-neutral-300 px-4 pt-1 pb-2 tracking-wide select-none">
              <span>08:00 AM</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-neutral-300" />
                <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[9px] font-bold text-violet-400 border border-violet-500/20">LTE</span>
                <span className="font-bold text-green-500">98%</span>
              </div>
            </div>

            {/* SCREEN VIEWPORT */}
            <div className="flex-1 rounded-[2.25rem] bg-[#f8f9fa] text-neutral-900 relative flex flex-col overflow-hidden select-none">
              
              {/* STICKY PHONE HEADER */}
              <div className="bg-white px-4 py-3.5 flex items-center justify-between border-b border-neutral-100 shadow-sm shrink-0">
                <button 
                  disabled={step === 1}
                  onClick={() => setStep(prev => prev - 1)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    step === 1 
                      ? 'bg-transparent text-neutral-300' 
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 active:scale-95'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div className="text-center">
                  <h3 className="text-sm font-extrabold text-neutral-950 uppercase tracking-tight leading-none">
                    {step === 1 && "Select Your Seats"}
                    {step === 2 && "Passenger Details"}
                    {step === 3 && "Review & Payment"}
                    {step === 4 && "Booking Confirmed"}
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                    {step === 1 && "Mabasi Maarufu Leo"}
                    {step === 2 && `Buyer Profile - ${selectedSeats.length} Seats`}
                    {step === 3 && "Weka Malipo Salama"}
                    {step === 4 && "Uhifadhi Umethibitishwa"}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-violet-50/80 border border-violet-100 flex items-center justify-center">
                  <Bus className="w-4 h-4 text-violet-600" />
                </div>
              </div>

              {/* DYNAMIC SCROLLABLE SCREEN CONTENT */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

                {/* STEP 1: SEAT SELECTION */}
                {step === 1 && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    {/* Bus Route Details Header Card */}
                    <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-4 rounded-2xl shadow-md border border-violet-500/30 space-y-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-violet-100">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {departureTime}
                        </span>
                        <span>{travelDate}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[10px] font-black uppercase text-violet-200">Kutoka (From)</p>
                          <h4 className="text-sm font-black text-white leading-tight">{origin}</h4>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-violet-200">Kwenda (To)</p>
                          <h4 className="text-sm font-black text-white leading-tight">{destination}</h4>
                        </div>
                      </div>
                      <div className="h-px bg-white/20 my-1" />
                      <div className="flex justify-between text-[11px] font-bold text-violet-100">
                        <span>{busName}</span>
                        <span>Muda: 8h 30m</span>
                      </div>
                    </div>

                    {/* Lower / Upper Deck Selector Tabs */}
                    <div className="bg-neutral-200/60 p-1 rounded-xl flex gap-1 border border-neutral-300/20 shrink-0">
                      <button 
                        onClick={() => setActiveDeck('lower')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeDeck === 'lower' ? 'bg-white text-violet-700 shadow-sm' : 'text-neutral-500 hover:bg-neutral-200'}`}
                      >
                        Lower Deck (Lower)
                      </button>
                      <button 
                        onClick={() => setActiveDeck('upper')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeDeck === 'upper' ? 'bg-white text-violet-700 shadow-sm' : 'text-neutral-500 hover:bg-neutral-200'}`}
                      >
                        Upper Deck (Sleeper)
                      </button>
                    </div>

                    {/* Bus seat selection card structure */}
                    <div className="bg-white rounded-3xl p-4 border border-neutral-200/50 shadow-md">
                      
                      {/* Steer representation at driver cabin */}
                      <div className="flex justify-between items-center pb-4 mb-4 border-b border-neutral-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 animate-spin-slow">
                            {/* steering wheel */}
                            ⚙️
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase leading-none">Mbele ya Basi</span>
                            <p className="text-xs font-extrabold text-neutral-800 leading-none mt-0.5">Driver Cabin</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase bg-neutral-100 px-2 py-1 rounded-lg">40 viti (Seats)</span>
                      </div>

                      {/* Main Seat Grid of 4 columns */}
                      <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1 no-scrollbar pt-1">
                        {Array.from({ length: 10 }).map((_, rIndex) => {
                          const base = activeDeck === 'lower' ? 0 : 40;
                          const seat1 = String(base + (rIndex * 4 + 1));
                          const seat2 = String(base + (rIndex * 4 + 2));
                          const seat3 = String(base + (rIndex * 4 + 3));
                          const seat4 = String(base + (rIndex * 4 + 4));

                          const renderSeatButton = (seatNum: string) => {
                            const isBooked = bookedSeats.includes(seatNum);
                            const isFemale = femaleOccupiedSeats.includes(seatNum);
                            const isVIP = vipSeats.includes(seatNum);
                            const isSelected = selectedSeats.includes(seatNum);

                            return (
                              <button
                                key={`sim-seat-${seatNum}`}
                                onClick={() => toggleSeat(seatNum)}
                                className={`aspect-square w-full rounded-xl flex flex-col items-center justify-center text-[10px] font-black border transition-all relative ${
                                  isBooked ? 'bg-neutral-800 border-neutral-900 text-neutral-400 opacity-55 cursor-not-allowed' :
                                  isFemale ? 'bg-pink-100 border-pink-300 hover:bg-pink-150 text-pink-600 font-extrabold' :
                                  isSelected ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-violet-500 scale-105 shadow-md shadow-violet-500/20' :
                                  isVIP ? 'bg-amber-50 border-2 border-amber-400 hover:bg-amber-100/60 text-amber-800 shadow-sm' :
                                  'bg-white border-neutral-200/80 hover:border-violet-400 hover:bg-violet-50/30 text-neutral-805'
                                }`}
                              >
                                {isFemale ? (
                                  <span className="text-[12px] leading-tight">👱‍♀️</span>
                                ) : isVIP && !isSelected ? (
                                  <span className="text-[11px] leading-tight text-amber-600">👑</span>
                                ) : (
                                  <span className="text-[12px] opacity-75">🪑</span>
                                )}
                                <span className="text-[8px] mt-0.5 leading-none font-sans font-black">{seatNum}</span>
                                {isVIP && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500" />}
                              </button>
                            );
                          };

                          return (
                            <div key={`sim-row-${rIndex}`} className="grid grid-cols-5 gap-2.5 items-center">
                              <div className="col-span-2 grid grid-cols-2 gap-2">
                                {renderSeatButton(seat1)}
                                {renderSeatButton(seat2)}
                              </div>
                              <div className="text-center text-[10px] font-bold text-neutral-300 tracking-wider">
                                Aisle
                              </div>
                              <div className="col-span-2 grid grid-cols-2 gap-2">
                                {renderSeatButton(seat3)}
                                {renderSeatButton(seat4)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Luxury Legend section */}
                    <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/50 shadow-sm space-y-2.5">
                      <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none">Legend (Alama za Viti)</p>
                      
                      <div className="grid grid-cols-3 gap-2.5 text-[10px] font-bold text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 bg-white border border-neutral-300 rounded" />
                          <span>Wazi (Available)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded" />
                          <span className="font-bold text-violet-700">Chaguo Lako</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 bg-neutral-800 rounded" />
                          <span>Zimejaa (Booked)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 bg-pink-100 border border-pink-300 rounded flex items-center justify-center text-[8px]">👱‍♀️</div>
                          <span className="text-pink-600 font-extrabold">Dada (Female)</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <div className="w-4 h-4 bg-amber-50 border-2 border-amber-400 rounded flex items-center justify-center text-[8px]">👑</div>
                          <span className="text-amber-800 font-extrabold">VIP (+ Gold Premium)</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: PASSENGER DETAILS FORM */}
                {step === 2 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4 text-left"
                  >
                    {/* Header quick route info */}
                    <div className="bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
                      <span className="text-xs font-extrabold text-neutral-800">{origin} → {destination}</span>
                      <span className="text-[9px] bg-violet-100 text-violet-700 font-black px-2.5 py-1 rounded-full uppercase">
                        {travelDate}
                      </span>
                    </div>

                    {/* Spawn dynamic cards for passengers */}
                    {passengers.map((p, idx) => (
                      <div key={`p-card-${p.seat}`} className="bg-white p-4 rounded-2xl border border-neutral-200/50 shadow-md space-y-3">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                          <h4 className="text-xs font-black text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                            👤 Passenger {idx + 1}
                          </h4>
                          <span className="text-[10px] bg-violet-600 text-white font-black px-3 py-1 rounded-full">
                            Seat {p.seat}
                          </span>
                        </div>

                        {/* Name form */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                            Jina Kamili (Full Name)
                          </label>
                          <input 
                            type="text" 
                            className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-900 focus:border-violet-500 transition-colors"
                            placeholder="Mfalme Juma Seleman"
                            value={p.fullName}
                            onChange={(e) => {
                              const list = [...passengers];
                              list[idx].fullName = e.target.value;
                              setPassengers(list);
                            }}
                          />
                          {errors[`name-${p.seat}`] && (
                            <p className="text-[9px] text-red-500 font-extrabold">{errors[`name-${p.seat}`]}</p>
                          )}
                        </div>

                        {/* Age and nationality row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                              Umri (Age)
                            </label>
                            <input 
                              type="number" 
                              className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-900 focus:border-violet-500"
                              placeholder="Kuanzia 1 mpaka 100"
                              value={p.age}
                              onChange={(e) => {
                                const list = [...passengers];
                                list[idx].age = e.target.value;
                                setPassengers(list);
                              }}
                            />
                            {errors[`age-${p.seat}`] && (
                              <p className="text-[9px] text-red-500 font-extrabold">{errors[`age-${p.seat}`]}</p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                              Utaifa (Nationality)
                            </label>
                            <select 
                              className="w-full h-11 bg-neutral-50 px-2 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-900 focus:border-violet-500"
                              value={p.nationality}
                              onChange={(e) => {
                                const list = [...passengers];
                                list[idx].nationality = e.target.value;
                                setPassengers(list);
                              }}
                            >
                              <option value="Tanzanian">🇹🇿 Mtanzania</option>
                              <option value="Kenyan">🇰🇪 Mkenya</option>
                              <option value="Ugandan">🇺🇬 Mganda</option>
                              <option value="Rwandan">🇷🇼 Mnyarwanda</option>
                              <option value="Other">🌍 Raia wa Kigeni</option>
                            </select>
                          </div>
                        </div>

                        {/* Gender options with segmented button avatars */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                            Jinsia (Gender Selection)
                          </label>
                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...passengers];
                                list[idx].gender = 'male';
                                setPassengers(list);
                              }}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold border-2 flex items-center justify-center gap-2 transition-all ${
                                p.gender === 'male'
                                  ? 'border-violet-600 bg-violet-50/50 text-violet-700 font-black'
                                  : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                              }`}
                            >
                              <span>👨</span> Male
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...passengers];
                                list[idx].gender = 'female';
                                setPassengers(list);
                              }}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold border-2 flex items-center justify-center gap-2 transition-all ${
                                p.gender === 'female'
                                  ? 'border-violet-600 bg-violet-50/50 text-violet-700 font-black'
                                  : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                              }`}
                            >
                              <span>👩</span> Female
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Save profile profile checklist switch */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-250/50 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-neutral-700">Hifadhi profile ya abiria</label>
                        <input 
                          type="checkbox" 
                          checked={saveProfile} 
                          onChange={(e) => setSaveProfile(e.target.checked)}
                          className="w-5 h-5 accent-violet-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-neutral-700">Frequent Traveler Service (Haraka)</label>
                        <input 
                          type="checkbox" 
                          checked={isFrequent} 
                          onChange={(e) => setIsFrequent(e.target.checked)}
                          className="w-5 h-5 accent-violet-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Buyer and Contacts */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/50 shadow-md space-y-3">
                      <h4 className="text-xs font-black text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-2">
                        📞 Buyer Contact Details
                      </h4>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Wakati wa dharura (Emergency Contact Phone)</label>
                        <input 
                          type="text" 
                          className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-900 focus:border-violet-500"
                          placeholder="+255 712 987 654"
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Mnunuaji (Buyer Name)</label>
                          <input 
                            type="text" 
                            className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-900 focus:border-violet-500"
                            placeholder="Jina lako kamili"
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Email Address</label>
                          <input 
                            type="email" 
                            className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-900 focus:border-violet-500"
                            placeholder="jane.doe@email.com"
                            value={buyerEmail}
                            onChange={(e) => setBuyerEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Mobile Number</label>
                          <input 
                            type="text" 
                            className="w-full h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-900 focus:border-violet-500"
                            placeholder="+255 789 123 456"
                            value={buyerPhone}
                            onChange={(e) => setBuyerPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: CHECKOUT & CHECK PAYMENT */}
                {step === 3 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4 text-left"
                  >
                    {/* Booking summary ticket card */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/50 shadow-md space-y-3">
                      <div className="flex justify-between items-center bg-violet-55 p-2.5 rounded-xl border border-violet-100">
                        <span className="text-[10px] font-black text-violet-700 uppercase">{busName}</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      </div>

                      <div className="space-y-2.5 text-xs text-neutral-700">
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Njia (Route):</span>
                          <span className="font-extrabold text-neutral-950">{origin} → {destination}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Muda (Time):</span>
                          <span className="font-extrabold text-neutral-950">{travelDate} | {departureTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Viti Visajiliwa (Seats):</span>
                          <span className="font-black text-violet-750">{selectedSeats.join(', ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Abiria (Passengers):</span>
                          <span className="font-extrabold text-neutral-950">{selectedSeats.length} Persons</span>
                        </div>
                      </div>
                    </div>

                    {/* Coupon promotion application section */}
                    {availableCoupons.length > 0 && (
                      <div className="bg-white p-4 rounded-2xl border border-neutral-250/50 shadow-sm space-y-3">
                        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none">Apply Coupon Code</p>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-955 uppercase tracking-widest"
                            placeholder="Mf. MABASI20"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={handleApplyCoupon}
                            className="px-4 bg-neutral-900 text-white rounded-xl text-xs font-black uppercase hover:bg-violet-605 transition-colors"
                          >
                            Apply
                          </button>
                        </div>

                        {isCouponApplied && appliedCoupon && (
                          <div className="bg-green-50 border border-green-200 p-2.5 rounded-xl flex items-center justify-between text-green-700">
                            <span className="text-[10px] font-black uppercase flex items-center gap-1">
                              ✓ Kuponi Imekubaliwa! ({appliedCoupon.code})
                            </span>
                            <span className="text-[10px] font-black text-green-850">
                              Saved TZS {couponDiscount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Simulated Tigo Pesa Wallet deduction toggle */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/50 shadow-md flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-extrabold text-xs text-neutral-900">
                          <Wallet className="w-4 h-4 text-violet-600" />
                          <span>Use Tigo Pesa Wallet</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Balance: TZS 150,000</p>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setUseWallet(prev => !prev)}
                        className={`w-12 h-6.5 rounded-full p-1 transition-all ${useWallet ? 'bg-violet-600' : 'bg-neutral-200'}`}
                      >
                        <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transition-all transform ${useWallet ? 'translate-x-5.5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Detailed Invoice Pricing Breakdown */}
                    <div className="bg-white p-4 rounded-2xl border border-neutral-200/50 shadow-md space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                        <span>Nauli ya Basi (Base Fare)</span>
                        <span className="tabular-nums font-extrabold text-neutral-805">
                          TZS {originalTotalPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                        <span>Kuponi na Punguzo</span>
                        <span className="tabular-nums text-green-600 font-extrabold">
                          -TZS {couponDiscount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                        <span>Pochi ya Tigo Pesa</span>
                        <span className="tabular-nums text-green-600 font-extrabold">
                          -TZS {walletDeduction.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-500">
                        <span>Ada ya Mtandao (Fee)</span>
                        <span className="tabular-nums font-extrabold text-neutral-805">
                          TZS {serviceFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-px bg-neutral-100 my-1.5" />
                      <div className="flex justify-between items-center text-xs font-black uppercase text-neutral-950">
                        <span className="text-[11px] tracking-tight">Kiwango cha Kulipa (Total)</span>
                        <span className="text-base text-violet-700 tracking-tight">
                          TZS {finalTotalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Premium Tanzanian checkout networks selection */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest">Chagua Njia ya Malipo (Payment Method)</p>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'mpesa', name: 'M-Pesa', logo: '🔴' },
                          { id: 'tigo', name: 'Tigo Pesa', logo: '🔵' },
                          { id: 'airtel', name: 'Airtel', logo: '🔴' },
                          { id: 'halo', name: 'HaloPesa', logo: '🟠' },
                          { id: 'visa', name: 'Visa', logo: '💳' },
                          { id: 'mastercard', name: 'Master', logo: '💳' }
                        ].map((prov) => (
                          <button
                            type="button"
                            key={`prov-grid-${prov.id}`}
                            onClick={() => setPaymentMethod(prov.id)}
                            className={`p-2 rounded-xl border-2 bg-white flex flex-col items-center justify-center gap-1 transition-all ${
                              paymentMethod === prov.id 
                                ? 'border-violet-600 ring-2 ring-violet-500/10' 
                                : 'border-neutral-200/60'
                            }`}
                          >
                            <span className="text-lg">{prov.logo}</span>
                            <span className="text-[9px] font-black uppercase text-neutral-850 mt-0.5">{prov.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: SUCCESS CONFIRMATION CELEBRATION CARD */}
                {step === 4 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4 text-center"
                  >
                    {/* Glowing ticket custom drawing */}
                    <div className="flex justify-center pt-2">
                      <div className="relative w-24 h-24 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <div className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping" />
                        <Check className="w-12 h-12 text-white stroke-[4]" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-neutral-900 leading-tight">🎉 Uhifadhi Umefanikiwa!</h4>
                      <p className="text-xs text-neutral-400 font-bold mt-1 max-w-[280px] mx-auto uppercase tracking-wide">
                        Seat Reservation Confirmed and Live on Database
                      </p>
                    </div>

                    {/* QR Code container */}
                    <div className="bg-white p-4 rounded-3xl border border-neutral-200/50 shadow-md space-y-3.5 relative overflow-hidden">
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-neutral-100 rounded-full border-r border-neutral-205/40" />
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-neutral-100 rounded-full border-l border-neutral-205/40" />

                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block leading-none">
                        Mizigo & Tiketi Code (QR Ticket)
                      </span>

                      {/* Real dynamic QR Code block */}
                      <div className="w-36 h-36 mx-auto bg-white p-2 rounded-2xl border border-neutral-200 flex items-center justify-center">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketRefId || '93847291')}`}
                          alt="Ticket Success QR Code"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Ticket details list */}
                      <div className="border-t border-dashed border-neutral-200 pt-3.5 space-y-2 text-left text-xs bg-neutral-50/50 p-2.5 rounded-2xl">
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Booking ID:</span>
                          <span className="text-neutral-950 font-black">{ticketRefId}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Jina (Name):</span>
                          <span className="text-neutral-950 font-black">{buyerName || 'Jane Doe'}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Viti (Seats):</span>
                          <span className="text-violet-700 font-extrabold">{selectedSeats.join(', ')}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Tarehe (Date):</span>
                          <span className="text-neutral-950 font-sans">{travelDate} | {departureTime}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* STICKY FOOTER PRESTIGE LAYOUT */}
              <div className="bg-white p-4 border-t border-neutral-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0 select-none">
                
                {/* Real-time total breakdown row during step 1-3 */}
                {step < 4 && (
                  <div className="flex items-center justify-between pb-3 text-left">
                    <div>
                      <span className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">
                        {step === 1 && `${selectedSeats.length} Seats Selected`}
                        {step === 2 && `${passengers.length} Passenger Profiles`}
                        {step === 3 && "Payable Total"}
                      </span>
                      <h4 className="text-sm font-extrabold text-neutral-900 leading-tight">
                        {step === 1 && `Seats: ${selectedSeats.join(', ') || 'N/A'}`}
                        {step === 2 && `Buyer: ${buyerName}`}
                        {step === 3 && `${paymentMethod.toUpperCase()} Checkout`}
                      </h4>
                    </div>

                    <div className="text-right">
                      {step === 1 && (
                        <>
                          <p className="text-xs font-black text-neutral-40s leading-none">TZS {basePricePerSeat.toLocaleString()}/seat</p>
                          <p className="text-base font-black text-[#7C3AED] tracking-tight mt-0.5">TZS {originalTotalPrice.toLocaleString()}</p>
                        </>
                      )}
                      {step === 2 && (
                        <>
                          <p className="text-xs font-extrabold text-neutral-400">Incl. Service Fee</p>
                          <p className="text-base font-black text-[#7C3AED] leading-none mt-0.5">TZS {(originalTotalPrice + serviceFee).toLocaleString()}</p>
                        </>
                      )}
                      {step === 3 && (
                        <>
                          <p className="text-xs font-extrabold text-neutral-400">Final Total</p>
                          <p className="text-base font-black text-[#7C3AED] leading-none mt-0.5">TZS {finalTotalAmount.toLocaleString()}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Trigger Buttons CTA */}
                {step < 4 ? (
                  <div className="flex flex-col gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 hover:scale-[1.01] active:scale-95 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>
                        {step === 1 && "KATA TIKETI / CONTINUE"}
                        {step === 2 && "ENDELEA PITIA / REVIEW"}
                        {step === 3 && `LIPA SASA (TZS ${finalTotalAmount.toLocaleString()})`}
                      </span>
                      <ChevronRight className="w-4 h-4 stroke-[2.5] animate-pulse" />
                    </button>

                    <a
                      href={`https://wa.me/14155238886?text=${encodeURIComponent(`Hi! Nataka kukata tiketi ya basi kutoka ${product?.origin || 'Dar es Salaam'} kwenda ${product?.destination || 'Mwanza'} - Basi: ${product?.name}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>Kata kwa WhatsApp Bot (Automatic)</span>
                    </a>
                  </div>
                ) : (
                  <div className="flex gap-2.5 font-sans">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-950 text-white border border-neutral-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🖨️ Chapisha / Print
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setSelectedSeats([]);
                      }}
                      className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-750 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Nenda Nyumbani
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {!standalone && (
          <div className="col-span-1 lg:col-span-7 flex flex-col bg-neutral-900 rounded-[2rem] border border-neutral-800 overflow-hidden shadow-inner">
          
          {/* Mock IDE Titlebar header */}
          <div className="bg-neutral-950 px-5 py-4 flex items-center justify-between border-b border-neutral-850">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="h-4 w-px bg-neutral-800" />
              <span className="text-[10px] font-mono font-black tracking-widest uppercase text-neutral-400">
                React Native + Expo Platform IDE Codes
              </span>
            </div>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(sourceFiles[selectedFile]);
                setCopiedFile(selectedFile);
                toast.success('Msimbo umenakiliwa! (Code Copied to Clipboard)');
                setTimeout(() => setCopiedFile(null), 2500);
              }}
              className="px-4 py-2 bg-neutral-850 text-white hover:bg-violet-600 rounded-xl transition-all text-xs font-bold flex items-center gap-2"
            >
              {copiedFile === selectedFile ? '✓ Copied' : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
            </button>
          </div>

          {/* IDE workspace pane (Sidebar + Code viewer) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
            
            {/* Folder-explorer sidebar (4 cols) */}
            <div className="col-span-1 md:col-span-4 bg-neutral-950/70 border-r border-neutral-850 p-4 space-y-4">
              <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider flex items-center gap-1.5">
                📁 Project Workspace Files
              </span>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="text-neutral-405 font-bold flex items-center gap-1.5 italic py-1">
                  🌐 App Shell & Config
                </div>
                {[
                  { file: 'useFirebaseBooking.ts', label: 'hooks/useFirebase.ts', isHook: true },
                  { file: 'bookingStore.ts', label: 'store/bookingStore.ts', isStore: true },
                  { file: 'SeatSelectionScreen.tsx', label: 'screens/SeatSelection.tsx', isScreen: true },
                  { file: 'PassengerDetailsScreen.tsx', label: 'screens/PassengerDetails.tsx', isScreen: true },
                  { file: 'ReviewPaymentScreen.tsx', label: 'screens/ReviewPayment.tsx', isScreen: true }
                ].map((item) => (
                  <button
                    key={`explorer-file-${item.file}`}
                    onClick={() => setSelectedFile(item.file)}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-all ${
                      selectedFile === item.file 
                        ? 'bg-violet-600/10 border border-violet-500/25 text-violet-400 font-bold' 
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-neutral-505">
                        {item.isHook && '⚓'}
                        {item.isStore && '📦'}
                        {item.isScreen && '📱'}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {selectedFile === item.file && <span className="text-[10px]">●</span>}
                  </button>
                ))}
              </div>

              {/* Specs parameters & quality audit notes */}
              <div className="border-t border-neutral-850 pt-4 space-y-2 text-[11px] text-neutral-400 leading-relaxed font-sans">
                <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1 mt-1">
                  ⭐ Architecture Highlights ⭐
                </span>
                <p>✓ <b>NativeWind (Tailwind CSS)</b> for seamless multi-platform responsive styles.</p>
                <p>✓ <b>Zustand</b> for lightweight type-safe offline states caching.</p>
                <p>✓ <b>Firebase Firestore</b> hook setup for synchronization and safety blocks.</p>
              </div>
            </div>

            {/* Syntactic-highlighting Code viewer container (8 cols) */}
            <div className="col-span-1 md:col-span-8 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-350 leading-relaxed overflow-x-auto whitespace-pre no-scrollbar overflow-y-auto max-h-[580px]">
              {sourceFiles[selectedFile]}
            </div>

          </div>

        </div>
        )}

      </div>

    </div>
  );
}
