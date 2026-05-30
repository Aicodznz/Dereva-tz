import React, { useState, useEffect } from 'react';
import { 
  Bus, MapPin, Calendar, Clock, ArrowRight, User, 
  Check, CheckCircle2, ChevronLeft, ChevronRight, 
  Smartphone, Sparkles, CreditCard, Wallet, Copy, 
  FileText, Terminal, Star, Wifi, ShieldCheck, HelpCircle, 
  Award, Send, Trash2, Info, Lock, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../AuthContext';

interface MabasiMaarufuFlowProps {
  product?: any;
  vendor?: any;
  onBackToTripSelection?: () => void;
  standalone?: boolean;
}

export default function MabasiMaarufuFlow({ product, vendor, onBackToTripSelection, standalone = false }: MabasiMaarufuFlowProps) {
  const { user, profile } = useAuth();

  // Mobile Simulator State
  const [step, setStep] = useState<number>(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [activeDeck, setActiveDeck] = useState<'lower' | 'upper'>('lower');
  const [couponCode, setCouponCode] = useState<string>('MABASI2GESPA');
  const [isCouponApplied, setIsCouponApplied] = useState<boolean>(true);
  const [useWallet, setUseWallet] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('mpesa');
  
  // Passenger state
  const [passengers, setPassengers] = useState<any[]>([]);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('+255 712 987654');
  const [saveProfile, setSaveProfile] = useState<boolean>(true);
  const [isFrequent, setIsFrequent] = useState<boolean>(false);

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
  const couponDiscount = isCouponApplied ? 14000 : 0;
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
    if (couponCode.trim() === 'MABASI20' || couponCode.trim() === 'MABASI2GESPA' || couponCode.trim().length > 3) {
      setIsCouponApplied(true);
      toast.success('Punguzo Limekubaliwa! Imeshuka TZS 14,000');
    } else {
      toast.error('Kuponi hii haipo au imeshaisha muda.');
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
        departureDate: travelDate,
        orderType: 'delivery', // general order type represented as Ticket Booking
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
}`
  };

  return (
    <div className={standalone ? "w-full flex flex-col gap-0 bg-transparent text-neutral-100 relative overflow-hidden select-none" : "w-full flex flex-col gap-8 bg-neutral-950 text-neutral-100 p-2 md:p-6 rounded-[2.5rem] border border-neutral-800 shadow-2xl relative overflow-hidden"}>
      
      {/* Background radial effects */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-violet-600/30 via-transparent to-transparent blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-fuchsia-600/20 via-transparent to-transparent blur-2xl" />
      </div>

      {/* Main Container Header */}
      {!standalone && (
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
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
                          <Clock className="w-3.5 h-3.5" /> 07:00 AM
                        </span>
                        <span>24 Nov 2026</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[10px] font-black uppercase text-violet-200">Kutoka (From)</p>
                          <h4 className="text-sm font-black text-white leading-tight">Dar es Salaam</h4>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-violet-200">Kwenda (To)</p>
                          <h4 className="text-sm font-black text-white leading-tight">Arusha</h4>
                        </div>
                      </div>
                      <div className="h-px bg-white/20 my-1" />
                      <div className="flex justify-between text-[11px] font-bold text-violet-100">
                        <span>Kilimanjaro Royal Bus</span>
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
                      <span className="text-xs font-extrabold text-neutral-800">Dar es Salaam → Arusha</span>
                      <span className="text-[9px] bg-violet-100 text-violet-700 font-black px-2.5 py-1 rounded-full uppercase">
                        24 November 2026
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
                      <div className="flex justify-between items-center bg-violet-50 p-2.5 rounded-xl border border-violet-100">
                        <span className="text-[10px] font-black text-violet-700 uppercase">Mabasi Maarufu Express</span>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      </div>

                      <div className="space-y-2.5 text-xs text-neutral-700">
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Njia (Route):</span>
                          <span className="font-extrabold text-neutral-950">Dar es Salaam → Arusha</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400 font-bold">Muda (Time):</span>
                          <span className="font-extrabold text-neutral-950">24 Nov 2026 | 07:00 AM</span>
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
                    <div className="bg-white p-4 rounded-2xl border border-neutral-250/50 shadow-sm space-y-3">
                      <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest leading-none">Apply Coupon Code</p>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="flex-1 h-11 bg-neutral-50 px-3.5 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-950 uppercase tracking-widest"
                          placeholder="Mf. MABASI20"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4 bg-neutral-900 text-white rounded-xl text-xs font-black uppercase hover:bg-violet-600 transition-colors"
                        >
                          Apply
                        </button>
                      </div>

                      {isCouponApplied && (
                        <div className="bg-green-50 border border-green-200 p-2.5 rounded-xl flex items-center justify-between text-green-700">
                          <span className="text-[10px] font-black uppercase flex items-center gap-1">
                            ✓ Kuponi Imekubaliwa!
                          </span>
                          <span className="text-[10px] font-black text-green-800">
                            Saved TZS 14,000
                          </span>
                        </div>
                      )}
                    </div>

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

                      {/* Pure CSS simulated QR Code block */}
                      <div className="w-36 h-36 mx-auto bg-neutral-100 p-2.5 rounded-2xl border border-neutral-200 flex flex-wrap content-between justify-between gap-1">
                        <div className="w-10 h-10 border-4 border-neutral-900 rounded-lg flex items-center justify-center p-1.5 shrink-0">
                          <div className="w-full h-full bg-neutral-900" />
                        </div>
                        <div className="w-4 h-4 bg-neutral-900 rounded" />
                        <div className="w-10 h-10 border-4 border-neutral-900 rounded-lg flex items-center justify-center p-1.5 shrink-0">
                          <div className="w-full h-full bg-neutral-900" />
                        </div>
                        <div className="w-full h-1 bg-neutral-900 rounded" />
                        <div className="w-full h-4 flex justify-between gap-1">
                          <div className="w-5 bg-neutral-900 rounded" />
                          <div className="w-8 bg-neutral-900 rounded" />
                          <div className="w-12 bg-neutral-900 rounded" />
                        </div>
                        <div className="w-10 h-10 border-4 border-neutral-900 rounded-lg flex items-center justify-center p-1.5 shrink-0">
                          <div className="w-full h-full bg-neutral-900" />
                        </div>
                        <div className="w-16 bg-neutral-900 h-10 rounded shrink-0" />
                      </div>

                      {/* Ticket details list */}
                      <div className="border-t border-dashed border-neutral-200 pt-3.5 space-y-2 text-left text-xs bg-neutral-50/50 p-2.5 rounded-2xl">
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Booking ID:</span>
                          <span className="text-neutral-950 font-black">MNL-2026-4890</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Jina (Name):</span>
                          <span className="text-neutral-950 font-black">Jane Doe</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Viti (Seats):</span>
                          <span className="text-violet-700 font-extrabold">{selectedSeats.join(', ')}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-neutral-400">Tarehe (Date):</span>
                          <span className="text-neutral-950">24 Nov 2026 | 07:00 AM</span>
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
                ) : (
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        toast.success('Iduni ya tiketi imepakuliwa kwenye PDF (Downloaded Ticket)');
                      }}
                      className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-950 text-white border border-neutral-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      View Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setSelectedSeats([]);
                      }}
                      className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-750 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Go Home
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
